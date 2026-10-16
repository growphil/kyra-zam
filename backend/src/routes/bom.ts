import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { wsManager } from "../websocket/manager";

export async function bomRoutes(fastify: FastifyInstance) {
  // GET /bom - List all BOM batches
  fastify.get(
    "/",
    { preHandler: [fastify.authenticate] },
    async () => {
      try {
        const boms: any[] = await (prisma as any).$queryRawUnsafe(`
          SELECT b.*, 
          COALESCE(
            json_agg(
              json_build_object(
                'id', bi.id,
                'quantity', bi.quantity,
                'material', json_build_object(
                  'id', m.id,
                  'name', m.name,
                  'sku', m.sku
                )
              )
            ) FILTER (WHERE bi.id IS NOT NULL), 
            '[]'
          ) as items
          FROM "BOM" b
          LEFT JOIN "BOMItem" bi ON bi."bomId" = b.id
          LEFT JOIN "Material" m ON m.id = bi."materialId"
          GROUP BY b.id
          ORDER BY b."createdAt" DESC
        `);
        return boms;
      } catch (error) {
        console.error("BOM Fetch Error:", error);
        return [];
      }
    }
  );

  // POST /bom - Create a new BOM batch and consume inventory
  fastify.post(
    "/",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { name, description, items, kitQuantity = 1 } = request.body as { 
        name: string, 
        description?: string, 
        kitQuantity: number,
        items: { materialId: string, quantity: number }[] 
      };

      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // 1. Verify stock levels for ALL items before proceeding
          for (const item of items) {
            const material: any = await tx.material.findUnique({ where: { id: item.materialId } });
            if (!material) throw new Error(`Material ${item.materialId} not found`);
            
            const totalNeeded = item.quantity * kitQuantity;
            if (material.quantity < totalNeeded) {
              throw new Error(`Insufficient stock for ${material.name}. Need ${totalNeeded} but only have ${material.quantity} available.`);
            }
          }

          // 2. Create the BOM Record (Batch)
          const [bom]: any = await tx.$queryRawUnsafe(`
            INSERT INTO "BOM" (id, name, description, "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, NOW())
            RETURNING *
          `, `${name} (x${kitQuantity})`, description);

          // 3. Create BOM Items and Deduct Inventory
          for (const item of items) {
            const totalNeeded = item.quantity * kitQuantity;

            // Save BOM Item record
            await tx.$queryRawUnsafe(`
              INSERT INTO "BOMItem" (id, "bomId", "materialId", quantity)
              VALUES (gen_random_uuid(), $1, $2, $3)
            `, bom.id, item.materialId, item.quantity);

            // Subtract from Material Stock
            await tx.material.update({
              where: { id: item.materialId },
              data: { quantity: { decrement: totalNeeded } }
            });

            await tx.stockMovement.create({
              data: {
                materialId: item.materialId,
                quantity: -totalNeeded,
                movementType: "ISSUE",
                source: "BOM_ASSEMBLY",
                referenceId: bom.id,
                userId: user.id,
                reason: `BOM consumption for kit: ${bom.name}`
              }
            });

            // Log the consumption
            await tx.auditLog.create({
              data: {
                entityType: "material",
                entityId: item.materialId,
                actorId: user.id,
                action: "BOM_CONSUMPTION",
                newStatus: "consumed",
                metadata: { bomId: bom.id, quantity: totalNeeded }
              }
            });
          }

          return bom;
        });

        // Broadcast realtime updates for BOM & Inventory
        wsManager.broadcastBOM("bom_batch_created", { id: result.id, name: result.name, kitQuantity });
        wsManager.broadcastInventory("inventory_consumed", { source: "BOM_ASSEMBLY", bomName: result.name });

        return result;
      } catch (error: any) {
        console.error("BOM Creation Error:", error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // DELETE /bom/:id - Admin Only
  fastify.delete(
    "/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      
      await prisma.$transaction([
        (prisma as any).$queryRawUnsafe(`DELETE FROM "BOMItem" WHERE "bomId" = $1`, id),
        (prisma as any).$queryRawUnsafe(`DELETE FROM "BOM" WHERE id = $1`, id)
      ]);

      wsManager.broadcastBOM("bom_deleted", { id });
      return { success: true };
    }
  );

  // PATCH /bom/:id - Admin & Inventory Manager
  fastify.patch(
    "/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN", "INVENTORY_MANAGER")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name, description, items } = request.body as { 
        name: string, 
        description?: string, 
        items?: { materialId: string, quantity: number }[] 
      };

      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // 1. Update BOM details
          const [bom]: any = await tx.$queryRawUnsafe(`
            UPDATE "BOM" SET name = $1, description = $2, "updatedAt" = NOW()
            WHERE id = $3
            RETURNING *
          `, name, description, id);

          if (!bom) {
            throw new Error("BOM not found");
          }

          if (items) {
            // Update BOM items (Delete and Re-insert)
            await tx.$queryRawUnsafe(`DELETE FROM "BOMItem" WHERE "bomId" = $1`, id);

            for (const item of items) {
              await tx.$queryRawUnsafe(`
                INSERT INTO "BOMItem" (id, "bomId", "materialId", quantity)
                VALUES (gen_random_uuid(), $1, $2, $3)
              `, id, item.materialId, item.quantity);
            }
          }

          return bom;
        });

        wsManager.broadcastBOM("bom_updated", { id: result.id, name: result.name });
        return result;
      } catch (error: any) {
        console.error("BOM Update Error:", error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );
}

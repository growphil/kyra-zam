import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { wsManager } from "../websocket/manager";

export async function inventoryRoutes(fastify: FastifyInstance) {
  // GET /inventory/materials - List all materials
  fastify.get(
    "/materials",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      console.log("🔍 Fetching materials for user:", (request.user as any).id);
      try {
        const materials = await prisma.material.findMany({
          orderBy: { category: "asc" },
        });
        console.log(`✅ Found ${materials.length} materials`);
        return materials;
      } catch (error) {
        console.error("❌ Error fetching materials:", error);
        throw error;
      }
    }
  );

  // Helper to process a single material inward/creation
  async function processMaterialItem(item: any, user: { id: string; roles: string[] }, tx: any) {
    const { name, category, sku, quantity, unit, minStock, totalAmount, materialType } = item;
    const qty = Number(quantity) || 0;
    const amount = Number(totalAmount) || 0;
    
    // Only PURCHASE_MANAGER or ADMIN can verify price by providing an amount
    const canVerify = user.roles.some(r => ["PURCHASE_MANAGER", "ADMIN", "SUPERADMIN"].includes(r));
    const finalAmount = canVerify ? amount : 0;
    const calculatedUnitPrice = qty > 0 && finalAmount > 0 ? finalAmount / qty : 0;
    const isPriceVerified = canVerify && finalAmount > 0;

    const cleanSku = (sku || "").trim();
    if (!cleanSku) {
      throw new Error("SKU / Part Number is required for every material item.");
    }

    const existing = await tx.material.findUnique({
      where: { sku: cleanSku }
    });

    if (existing) {
      const newQty = existing.quantity + qty;
      const newTotalValue = existing.totalValue + finalAmount;
      const newUnitPrice = calculatedUnitPrice > 0 ? calculatedUnitPrice : existing.unitPrice;

      const mat = await tx.material.update({
        where: { id: existing.id },
        data: {
          name: name?.trim() || existing.name,
          category: category?.trim() || existing.category,
          quantity: newQty,
          unit: unit?.trim() || existing.unit,
          minStock: minStock !== undefined ? Number(minStock) : existing.minStock,
          unitPrice: newUnitPrice,
          totalValue: newTotalValue,
          isPriceVerified: isPriceVerified || existing.isPriceVerified,
          materialType: materialType || existing.materialType,
          isActive: true,
          lastRestock: new Date()
        }
      });

      if (qty > 0) {
        await tx.stockMovement.create({
          data: {
            materialId: mat.id,
            quantity: qty,
            movementType: "RECEIPT",
            source: "INVENTORY_INWARD",
            userId: user.id,
            reason: `Inward stock registration: +${qty} ${mat.unit}`
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "material",
          entityId: mat.id,
          actorId: user.id,
          action: "restocked",
          prevStatus: existing.quantity.toString(),
          newStatus: newQty.toString(),
          metadata: { inwardQuantity: qty, totalStock: newQty }
        }
      });

      return { material: mat, action: "restocked" };
    }

    const mat = await tx.material.create({
      data: {
        name: (name || cleanSku).trim(),
        category: (category || "Components").trim(),
        sku: cleanSku,
        quantity: qty,
        unit: (unit || "pcs").trim(),
        minStock: Number(minStock) || 0,
        unitPrice: calculatedUnitPrice,
        totalValue: finalAmount,
        isPriceVerified,
        materialType: materialType || "QTZ",
        isActive: true
      }
    });

    if (qty > 0) {
      await tx.stockMovement.create({
        data: {
          materialId: mat.id,
          quantity: qty,
          movementType: "RECEIPT",
          source: "INITIAL_REGISTRATION",
          userId: user.id,
          reason: `Initial stock registration: +${qty} ${mat.unit}`
        }
      });
    }

    await tx.auditLog.create({
      data: {
        entityType: "material",
        entityId: mat.id,
        actorId: user.id,
        action: "created",
        newStatus: "in_stock",
        metadata: { quantity: qty }
      }
    });

    return { material: mat, action: "created" };
  }

  // POST /inventory/materials - Create/Add material (Supports single item or multiple items in one request)
  fastify.post(
    "/materials",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const user = request.user as { id: string; roles: string[] };
      const body = request.body as any;

      // Detect multiple items
      const isBatch = Array.isArray(body) || (body?.items && Array.isArray(body.items));
      const itemsList: any[] = isBatch ? (Array.isArray(body) ? body : body.items) : [body];

      if (itemsList.length === 0) {
        return reply.status(400).send({ error: "At least one material item is required." });
      }

      const results = await prisma.$transaction(async (tx) => {
        const processed = [];
        for (const it of itemsList) {
          const res = await processMaterialItem(it, user, tx);
          processed.push(res);
        }
        return processed;
      });

      // Broadcast websockets
      for (const res of results) {
        wsManager.broadcastInventory("inventory:update", { materialId: res.material.id, action: res.action });
        wsManager.broadcastMaterials("materials:update", { materialId: res.material.id });
      }

      if (isBatch) {
        return {
          success: true,
          count: results.length,
          materials: results.map(r => r.material)
        };
      }

      return results[0].material;
    }
  );

  // POST /inventory/materials/batch - Explicit multi-material batch registration
  fastify.post(
    "/materials/batch",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const user = request.user as { id: string; roles: string[] };
      const { items } = (request.body as { items: any[] }) || {};

      if (!items || !Array.isArray(items) || items.length === 0) {
        return reply.status(400).send({ error: "An array of material items is required in the 'items' property." });
      }

      const results = await prisma.$transaction(async (tx) => {
        const processed = [];
        for (const it of items) {
          const res = await processMaterialItem(it, user, tx);
          processed.push(res);
        }
        return processed;
      });

      for (const res of results) {
        wsManager.broadcastInventory("inventory:update", { materialId: res.material.id, action: res.action });
        wsManager.broadcastMaterials("materials:update", { materialId: res.material.id });
      }

      return {
        success: true,
        count: results.length,
        materials: results.map(r => r.material)
      };
    }
  );

  // PATCH /inventory/materials/:id/stock - Update stock levels
  fastify.patch(
    "/materials/:id/stock",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { adjustment, action } = request.body as { adjustment: number, action: "add" | "remove" };
      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Lock the Material row first
          await tx.$executeRawUnsafe(
            `SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`,
            id
          );

          const material = await tx.material.findUnique({ where: { id } });
          if (!material) {
            const err = new Error("Material not found");
            (err as any).statusCode = 404;
            throw err;
          }

          const adj = Number(adjustment) || 0;
          const newQuantity = action === "add" ? material.quantity + adj : material.quantity - adj;

          if (newQuantity < 0) {
            const err = new Error("INSUFFICIENT_STOCK");
            (err as any).statusCode = 400;
            throw err;
          }

          const updated = await tx.material.update({
            where: { id },
            data: { 
              quantity: newQuantity,
              lastRestock: action === "add" ? new Date() : material.lastRestock
            }
          });

          await tx.stockMovement.create({
            data: {
              materialId: id,
              quantity: action === "add" ? adj : -adj,
              movementType: "ADJUSTMENT",
              source: "MANUAL_ADJUSTMENT",
              userId: user.id,
              reason: `Manual adjustment: ${action === "add" ? "Added" : "Removed"} ${adj} units.`
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "material",
              entityId: id,
              actorId: user.id,
              action: action === "add" ? "restocked" : "consumed",
              prevStatus: material.quantity.toString(),
              newStatus: newQuantity.toString(),
              metadata: { adjustment: adj }
            }
          });

          return updated;
        });

        wsManager.broadcastInventory("inventory:update", { materialId: result.id, action: "stock_adjusted" });
        return result;
      } catch (err: any) {
        const code = err.statusCode || 400;
        return reply.status(code).send({ error: err.message || "Stock level update failed" });
      }
    }
  );

  // PATCH /inventory/materials/:id - General update
  fastify.patch(
    "/materials/:id",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as any;
      const user = request.user as { id: string; roles: string[] };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Lock Material row first
          await tx.$executeRawUnsafe(
            `SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`,
            id
          );

          const material = await tx.material.findUnique({ where: { id } });
          if (!material) {
            const err = new Error("Material not found");
            (err as any).statusCode = 404;
            throw err;
          }

          const canVerify = user.roles.some(r => ["PURCHASE_MANAGER", "ADMIN", "SUPERADMIN"].includes(r));
          
          const qty = data.quantity !== undefined ? Number(data.quantity) : material.quantity;
          const amount = (data.totalAmount !== undefined && canVerify) ? Number(data.totalAmount) : material.totalValue;
          const unitPrice = qty > 0 ? amount / qty : material.unitPrice;
          const isPriceVerified = (canVerify && amount > 0) || material.isPriceVerified;

          const updated = await tx.material.update({
            where: { id },
            data: {
              name: data.name,
              category: data.category,
              sku: data.sku,
              unit: data.unit,
              minStock: data.minStock,
              quantity: qty,
              unitPrice,
              totalValue: amount,
              isPriceVerified,
              materialType: data.materialType
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "material",
              entityId: id,
              actorId: user.id,
              action: "updated",
              prevStatus: material.quantity.toString(),
              newStatus: qty.toString(),
              metadata: { changes: data }
            }
          });

          return updated;
        });

        wsManager.broadcastInventory("inventory:update", { materialId: result.id, action: "updated" });
        wsManager.broadcastMaterials("materials:update", { materialId: result.id });
        return result;
      } catch (err: any) {
        const code = err.statusCode || 400;
        return reply.status(code).send({ error: err.message || "Material update failed" });
      }
    }
  );

  // DELETE /inventory/materials/:id - Admin Only
  fastify.delete(
    "/materials/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Check if used in BOM first using raw SQL
      const usage: any[] = await (prisma as any).$queryRawUnsafe(
        `SELECT id FROM "BOMItem" WHERE "materialId" = $1 LIMIT 1`, 
        id
      );
      
      if (usage && usage.length > 0) {
        return reply.status(400).send({ error: "Cannot delete material used in an existing BOM" });
      }

      await (prisma as any).$queryRawUnsafe(`DELETE FROM "Material" WHERE id = $1`, id);
      wsManager.broadcastInventory("inventory:update", { materialId: id, action: "deleted" });
      return { success: true };
    }
  );

  // GET /inventory/categories - List all categories
  fastify.get(
    "/categories",
    { preHandler: [fastify.authenticate] },
    async () => {
      const cats: any[] = await (prisma as any).$queryRawUnsafe(`SELECT * FROM "MaterialCategory" ORDER BY name ASC`);
      return cats;
    }
  );

  // POST /inventory/categories - Admin only
  fastify.post(
    "/categories",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { name } = request.body as { name: string };
      try {
        const cat = await (prisma as any).$queryRawUnsafe(
          `INSERT INTO "MaterialCategory" (id, name) VALUES (gen_random_uuid(), $1) RETURNING *`,
          name
        );
        return cat[0];
      } catch (e: any) {
        return reply.status(400).send({ error: "Category already exists" });
      }
    }
  );

  // DELETE /inventory/categories/:id - Admin only
  fastify.delete(
    "/categories/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await (prisma as any).$queryRawUnsafe(`DELETE FROM "MaterialCategory" WHERE id = $1`, id);
      return { success: true };
    }
  );

  // GET /inventory/ledger - Get stock movement history
  fastify.get(
    "/ledger",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request) => {
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: { in: ["material", "cell"] }
        },
        include: {
          actor: {
            select: { name: true }
          }
        },
        orderBy: { timestamp: "desc" },
        take: 50
      } as any);
      return logs;
    }
  );

  // --- WAREHOUSE & LOCATION ENDPOINTS ---

  // GET /inventory/warehouses
  fastify.get(
    "/warehouses",
    { preHandler: [fastify.authenticate] },
    async () => {
      return prisma.warehouse.findMany({
        include: {
          locations: {
            orderBy: { code: "asc" }
          },
          _count: {
            select: {
              locations: true,
              stockBalances: true
            }
          }
        },
        orderBy: { code: "asc" }
      });
    }
  );

  // POST /inventory/warehouses
  fastify.post(
    "/warehouses",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { name, code, address } = request.body as any;
      if (!name?.trim() || !code?.trim()) {
        return reply.status(400).send({ error: "Warehouse name and code are required" });
      }
      try {
        const wh = await prisma.warehouse.create({
          data: {
            name: name.trim(),
            code: code.trim().toUpperCase(),
            address: address?.trim() || null
          },
          include: { locations: true }
        });
        return wh;
      } catch (err) {
        return reply.status(400).send({ error: "Warehouse name or code already exists" });
      }
    }
  );

  // PUT /inventory/warehouses/:id
  fastify.put(
    "/warehouses/:id",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name, code, address } = request.body as any;
      if (!name?.trim() || !code?.trim()) {
        return reply.status(400).send({ error: "Warehouse name and code are required" });
      }

      const existing = await prisma.warehouse.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Warehouse not found" });
      }

      // Check unique conflicts
      const conflict = await prisma.warehouse.findFirst({
        where: {
          id: { not: id },
          OR: [
            { name: { equals: name.trim(), mode: "insensitive" } },
            { code: { equals: code.trim().toUpperCase(), mode: "insensitive" } }
          ]
        }
      });
      if (conflict) {
        return reply.status(400).send({ error: `Another warehouse already exists with name "${name}" or code "${code}"` });
      }

      const updated = await prisma.warehouse.update({
        where: { id },
        data: {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          address: address !== undefined ? (address?.trim() || null) : existing.address
        },
        include: { locations: true }
      });
      return updated;
    }
  );

  // DELETE /inventory/warehouses/:id
  fastify.delete(
    "/warehouses/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.warehouse.findUnique({
        where: { id },
        include: {
          stockBalances: {
            where: { quantity: { gt: 0 } }
          },
          _count: {
            select: {
              goodsReceipts: true,
              originTransfers: true,
              destinationTransfers: true,
              packingRecords: true
            }
          }
        }
      });

      if (!existing) {
        return reply.status(404).send({ error: "Warehouse not found" });
      }

      if (existing.stockBalances.length > 0) {
        return reply.status(400).send({
          error: `Cannot delete warehouse "${existing.name}": has ${existing.stockBalances.length} active inventory item(s) with stock on hand. Transfer or write off inventory first.`
        });
      }

      if (
        existing._count.goodsReceipts > 0 ||
        existing._count.originTransfers > 0 ||
        existing._count.destinationTransfers > 0 ||
        existing._count.packingRecords > 0
      ) {
        return reply.status(400).send({
          error: `Cannot delete warehouse "${existing.name}": historic procurement or transfer logs reference this facility.`
        });
      }

      try {
        await prisma.warehouse.delete({ where: { id } });
        return { success: true, message: `Warehouse "${existing.name}" deleted successfully` };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to delete warehouse" });
      }
    }
  );

  // GET /inventory/warehouses/:id
  fastify.get(
    "/warehouses/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const wh = await prisma.warehouse.findUnique({
        where: { id },
        include: { locations: true }
      });
      if (!wh) return reply.status(404).send({ error: "Warehouse not found" });
      return wh;
    }
  );

  // POST /inventory/warehouses/:id/locations
  fastify.post(
    "/warehouses/:id/locations",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name, code } = request.body as any;
      if (!name?.trim() || !code?.trim()) {
        return reply.status(400).send({ error: "Location name and code are required" });
      }
      try {
        const loc = await prisma.warehouseLocation.create({
          data: {
            warehouseId: id,
            name: name.trim(),
            code: code.trim().toUpperCase()
          }
        });
        return loc;
      } catch (err) {
        return reply.status(400).send({ error: "Location code already exists for this warehouse" });
      }
    }
  );

  // PUT /inventory/warehouses/:id/locations/:locId
  fastify.put(
    "/warehouses/:id/locations/:locId",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id, locId } = request.params as { id: string; locId: string };
      const { name, code } = request.body as any;
      if (!name?.trim() || !code?.trim()) {
        return reply.status(400).send({ error: "Location name and code are required" });
      }

      const existing = await prisma.warehouseLocation.findUnique({
        where: { id: locId }
      });
      if (!existing || existing.warehouseId !== id) {
        return reply.status(404).send({ error: "Location not found in specified warehouse" });
      }

      const conflict = await prisma.warehouseLocation.findFirst({
        where: {
          warehouseId: id,
          id: { not: locId },
          code: { equals: code.trim().toUpperCase(), mode: "insensitive" }
        }
      });
      if (conflict) {
        return reply.status(400).send({ error: `Location code "${code}" already exists in this warehouse` });
      }

      const updated = await prisma.warehouseLocation.update({
        where: { id: locId },
        data: {
          name: name.trim(),
          code: code.trim().toUpperCase()
        }
      });
      return updated;
    }
  );

  // DELETE /inventory/warehouses/:id/locations/:locId
  fastify.delete(
    "/warehouses/:id/locations/:locId",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id, locId } = request.params as { id: string; locId: string };
      const existing = await prisma.warehouseLocation.findUnique({
        where: { id: locId },
        include: {
          stockBalances: {
            where: { quantity: { gt: 0 } }
          }
        }
      });

      if (!existing || existing.warehouseId !== id) {
        return reply.status(404).send({ error: "Location not found in specified warehouse" });
      }

      if (existing.stockBalances.length > 0) {
        return reply.status(400).send({
          error: `Cannot delete location "${existing.code}": has active stock on hand. Relocate stock first.`
        });
      }

      try {
        await prisma.warehouseLocation.delete({ where: { id: locId } });
        return { success: true, message: `Location "${existing.code}" deleted successfully` };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to delete location bin" });
      }
    }
  );

  // GET /inventory/movements
  fastify.get(
    "/movements",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN")] },
    async () => {
      return prisma.stockMovement.findMany({
        orderBy: { timestamp: "desc" },
        include: {
          material: { select: { sku: true, name: true } },
          user: { select: { name: true } }
        },
        take: 100
      });
    }
  );

  // GET /inventory/location-balances
  fastify.get(
    "/location-balances",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN")] },
    async () => {
      return prisma.materialLocationBalance.findMany({
        include: {
          material: { select: { sku: true, name: true } },
          warehouse: { select: { name: true, code: true } },
          location: { select: { name: true, code: true } }
        }
      });
    }
  );

  // --- INTER-WAREHOUSE TRANSFERS (Phase 3.0-F) ---

  // Helper sequential transfer number generator
  async function generateTransferNumber() {
    let next = 1;
    const last = await prisma.stockTransfer.findFirst({
      where: { transferNumber: { startsWith: "TR-" } },
      orderBy: { transferNumber: 'desc' }
    });
    if (last) {
      const numPart = last.transferNumber.replace("TR-", "").split("-")[0];
      const val = parseInt(numPart, 10);
      if (!isNaN(val)) next = val + 1;
    }
    while (true) {
      const candidate = `TR-${String(next).padStart(6, '0')}`;
      const exists = await prisma.stockTransfer.findFirst({ where: { transferNumber: candidate } });
      if (!exists) return candidate;
      next++;
    }
  }

  // GET /inventory/transfers - List all transfers
  fastify.get(
    "/transfers",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "SUPERVISOR", "ADMIN", "SUPERADMIN")] },
    async (request) => {
      return prisma.stockTransfer.findMany({
        include: {
          originWarehouse: { select: { name: true, code: true } },
          destinationWarehouse: { select: { name: true, code: true } },
          createdBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
          items: {
            include: {
              material: { select: { sku: true, name: true } },
              originLocation: { select: { name: true, code: true } },
              destinationLocation: { select: { name: true, code: true } }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
    }
  );

  // GET /inventory/transfers/:id - Get transfer details
  fastify.get(
    "/transfers/:id",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "SUPERVISOR", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const transfer = await prisma.stockTransfer.findUnique({
        where: { id },
        include: {
          originWarehouse: true,
          destinationWarehouse: true,
          createdBy: { select: { name: true, email: true } },
          approvedBy: { select: { name: true, email: true } },
          items: {
            include: {
              material: true,
              originLocation: true,
              destinationLocation: true
            }
          }
        }
      });
      if (!transfer) return reply.status(404).send({ error: "Stock transfer not found" });
      return transfer;
    }
  );

  // POST /inventory/transfers - Request a transfer
  fastify.post(
    "/transfers",
    { preHandler: [requireRoles("ASSEMBLY_TECHNICIAN", "INVENTORY_MANAGER", "SUPERVISOR", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { originWarehouseId, destinationWarehouseId, notes, items } = request.body as any;
      const user = request.user as { id: string };

      if (!items || items.length === 0) {
        return reply.status(400).send({ error: "Transfer request must include at least one item." });
      }

      const trNum = await generateTransferNumber();

      try {
        const transfer = await prisma.$transaction(async (tx) => {
          const doc = await tx.stockTransfer.create({
            data: {
              transferNumber: trNum,
              originWarehouseId,
              destinationWarehouseId,
              notes,
              createdById: user.id,
              status: "REQUESTED"
            }
          });

          for (const item of items) {
            await tx.stockTransferItem.create({
              data: {
                transferId: doc.id,
                materialId: item.materialId,
                quantityRequested: Number(item.quantityRequested),
                originLocationId: item.originLocationId,
                destinationLocationId: item.destinationLocationId
              }
            });
          }

          await tx.auditLog.create({
            data: {
              entityType: "stock-transfer",
              entityId: doc.id,
              actorId: user.id,
              action: "TRANSFER_REQUESTED",
              newStatus: "REQUESTED",
              metadata: { transferNumber: trNum, itemCount: items.length }
            }
          });

          return doc;
        });

        return transfer;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to create transfer request." });
      }
    }
  );

  // PUT /inventory/transfers/:id/approve - Approve transfer
  fastify.put(
    "/transfers/:id/approve",
    { preHandler: [requireRoles("SUPERVISOR", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      try {
        const transfer = await prisma.$transaction(async (tx) => {
          // Lock transfer row
          await tx.$executeRawUnsafe(`SELECT * FROM "StockTransfer" WHERE id = $1 FOR UPDATE`, id);

          const doc = await tx.stockTransfer.findUnique({ where: { id } });
          if (!doc) throw new Error("TRANSFER_NOT_FOUND");
          if (doc.status !== "REQUESTED") throw new Error("INVALID_TRANSFER_STATE");

          const updated = await tx.stockTransfer.update({
            where: { id },
            data: {
              status: "APPROVED",
              approvedById: user.id
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "stock-transfer",
              entityId: id,
              actorId: user.id,
              action: "TRANSFER_APPROVED",
              prevStatus: "REQUESTED",
              newStatus: "APPROVED",
              metadata: { transferNumber: doc.transferNumber }
            }
          });

          return updated;
        });

        return transfer;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // PUT /inventory/transfers/:id/ship - Ship transfer (deduct stock from origin)
  fastify.put(
    "/transfers/:id/ship",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { shippedItems } = request.body as { shippedItems: { itemId: string, quantityShipped: number }[] };
      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // 1. Lock transfer row
          await tx.$executeRawUnsafe(`SELECT * FROM "StockTransfer" WHERE id = $1 FOR UPDATE`, id);

          const transfer = await tx.stockTransfer.findUnique({
            where: { id },
            include: { items: true }
          });
          if (!transfer) throw new Error("TRANSFER_NOT_FOUND");
          if (transfer.status === "IN_TRANSIT") throw new Error("TRANSFER_ALREADY_SHIPPED");
          if (transfer.status === "RECEIVED") throw new Error("TRANSFER_ALREADY_RECEIVED");
          if (transfer.status === "CANCELLED") throw new Error("TRANSFER_ALREADY_CANCELLED");
          if (transfer.status !== "APPROVED") throw new Error("INVALID_TRANSFER_STATE");

          // 2. Lock MaterialLocationBalance rows and Material rows in sorted alphabetical order
          const sortedItems = [...transfer.items].sort((a, b) => {
            const cmpMat = a.materialId.localeCompare(b.materialId);
            if (cmpMat !== 0) return cmpMat;
            const cmpOrigin = a.originLocationId.localeCompare(b.originLocationId);
            if (cmpOrigin !== 0) return cmpOrigin;
            return a.destinationLocationId.localeCompare(b.destinationLocationId);
          });
          for (const item of sortedItems) {
            // Lock Material
            await tx.$executeRawUnsafe(`SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`, item.materialId);

            // Lock MaterialLocationBalance for origin location
            await tx.$executeRawUnsafe(
              `SELECT * FROM "MaterialLocationBalance" WHERE "materialId" = $1 AND "warehouseId" = $2 AND "locationId" = $3 FOR UPDATE`,
              item.materialId,
              transfer.originWarehouseId,
              item.originLocationId
            );
          }

          // 3. Update stock levels
          for (const item of transfer.items) {
            const shipPayload = shippedItems?.find(si => si.itemId === item.id);
            const qtyShipped = shipPayload ? Number(shipPayload.quantityShipped) : item.quantityRequested;

            if (qtyShipped <= 0) throw new Error(`Shipped quantity must be positive.`);

            // Verify origin stock
            const balance = await tx.materialLocationBalance.findUnique({
              where: {
                materialId_warehouseId_locationId: {
                  materialId: item.materialId,
                  warehouseId: transfer.originWarehouseId,
                  locationId: item.originLocationId
                }
              }
            });

            if (!balance || balance.quantity < qtyShipped) {
              throw new Error("INSUFFICIENT_STOCK");
            }

            // Deduct location balance
            await tx.materialLocationBalance.update({
              where: { id: balance.id },
              data: { quantity: balance.quantity - qtyShipped }
            });

            // Deduct Material overall quantity
            const material = await tx.material.findUnique({ where: { id: item.materialId } });
            if (!material) throw new Error("Material not found");
            if (material.quantity < qtyShipped) {
              throw new Error("INSUFFICIENT_STOCK");
            }

            await tx.material.update({
              where: { id: item.materialId },
              data: { quantity: material.quantity - qtyShipped }
            });

            // Update transfer item quantityShipped
            await tx.stockTransferItem.update({
              where: { id: item.id },
              data: { quantityShipped: qtyShipped }
            });

            // Log StockMovement
            await tx.stockMovement.create({
              data: {
                materialId: item.materialId,
                quantity: -qtyShipped,
                movementType: "ISSUE",
                source: "STOCK_TRANSFER",
                referenceId: transfer.transferNumber,
                userId: user.id,
                locationId: item.originLocationId,
                reason: `Shipped to Warehouse ${transfer.destinationWarehouseId}`
              }
            });
          }

          // Move transfer status to IN_TRANSIT
          const updated = await tx.stockTransfer.update({
            where: { id },
            data: {
              status: "IN_TRANSIT",
              shippedAt: new Date()
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "stock-transfer",
              entityId: id,
              actorId: user.id,
              action: "TRANSFER_SHIPPED",
              prevStatus: "APPROVED",
              newStatus: "IN_TRANSIT",
              metadata: { transferNumber: transfer.transferNumber }
            }
          });

          return updated;
        });

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // PUT /inventory/transfers/:id/receive - Receive transfer (increment stock at destination)
  fastify.put(
    "/transfers/:id/receive",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { receivedItems } = request.body as { receivedItems: { itemId: string, quantityReceived: number }[] };
      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // 1. Lock transfer row
          await tx.$executeRawUnsafe(`SELECT * FROM "StockTransfer" WHERE id = $1 FOR UPDATE`, id);

          const transfer = await tx.stockTransfer.findUnique({
            where: { id },
            include: { items: true }
          });
          if (!transfer) throw new Error("TRANSFER_NOT_FOUND");
          if (transfer.status === "RECEIVED") throw new Error("TRANSFER_ALREADY_RECEIVED");
          if (transfer.status === "CANCELLED") throw new Error("TRANSFER_ALREADY_CANCELLED");
          if (transfer.status !== "IN_TRANSIT") throw new Error("INVALID_TRANSFER_STATE");

          // 2. Lock MaterialLocationBalance rows and Material rows in sorted alphabetical order
          const sortedItems = [...transfer.items].sort((a, b) => {
            const cmpMat = a.materialId.localeCompare(b.materialId);
            if (cmpMat !== 0) return cmpMat;
            const cmpOrigin = a.originLocationId.localeCompare(b.originLocationId);
            if (cmpOrigin !== 0) return cmpOrigin;
            return a.destinationLocationId.localeCompare(b.destinationLocationId);
          });
          for (const item of sortedItems) {
            // Lock Material
            await tx.$executeRawUnsafe(`SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`, item.materialId);

            // Lock MaterialLocationBalance for destination location
            await tx.$executeRawUnsafe(
              `SELECT * FROM "MaterialLocationBalance" WHERE "materialId" = $1 AND "warehouseId" = $2 AND "locationId" = $3 FOR UPDATE`,
              item.materialId,
              transfer.destinationWarehouseId,
              item.destinationLocationId
            );
          }

          // 3. Update stock levels
          for (const item of transfer.items) {
            const receivePayload = receivedItems?.find(ri => ri.itemId === item.id);
            const qtyReceived = receivePayload ? Number(receivePayload.quantityReceived) : item.quantityShipped;

            if (qtyReceived < 0) throw new Error(`Received quantity cannot be negative.`);

            // Increase destination location balance
            const destBalance = await tx.materialLocationBalance.findUnique({
              where: {
                materialId_warehouseId_locationId: {
                  materialId: item.materialId,
                  warehouseId: transfer.destinationWarehouseId,
                  locationId: item.destinationLocationId
                }
              }
            });

            if (destBalance) {
              await tx.materialLocationBalance.update({
                where: { id: destBalance.id },
                data: { quantity: destBalance.quantity + qtyReceived }
              });
            } else {
              await tx.materialLocationBalance.create({
                data: {
                  materialId: item.materialId,
                  warehouseId: transfer.destinationWarehouseId,
                  locationId: item.destinationLocationId,
                  quantity: qtyReceived
                }
              });
            }

            // Increase Material overall quantity
            const material = await tx.material.findUnique({ where: { id: item.materialId } });
            if (!material) throw new Error("Material not found");

            await tx.material.update({
              where: { id: item.materialId },
              data: { quantity: material.quantity + qtyReceived }
            });

            // Update transfer item quantityReceived
            await tx.stockTransferItem.update({
              where: { id: item.id },
              data: { quantityReceived: qtyReceived }
            });

            // Log StockMovement
            await tx.stockMovement.create({
              data: {
                materialId: item.materialId,
                quantity: qtyReceived,
                movementType: "RECEIPT",
                source: "STOCK_TRANSFER",
                referenceId: transfer.transferNumber,
                userId: user.id,
                locationId: item.destinationLocationId,
                reason: `Received from Warehouse ${transfer.originWarehouseId}`
              }
            });
          }

          // Move transfer status to RECEIVED
          const updated = await tx.stockTransfer.update({
            where: { id },
            data: {
              status: "RECEIVED",
              receivedAt: new Date()
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "stock-transfer",
              entityId: id,
              actorId: user.id,
              action: "TRANSFER_RECEIVED",
              prevStatus: "IN_TRANSIT",
              newStatus: "RECEIVED",
              metadata: { transferNumber: transfer.transferNumber }
            }
          });

          return updated;
        });

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // PUT /inventory/transfers/:id/cancel - Cancel transfer
  fastify.put(
    "/transfers/:id/cancel",
    { preHandler: [requireRoles("ASSEMBLY_TECHNICIAN", "INVENTORY_MANAGER", "SUPERVISOR", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      try {
        const transfer = await prisma.$transaction(async (tx) => {
          // Lock transfer row
          await tx.$executeRawUnsafe(`SELECT * FROM "StockTransfer" WHERE id = $1 FOR UPDATE`, id);

          const doc = await tx.stockTransfer.findUnique({ where: { id } });
          if (!doc) throw new Error("TRANSFER_NOT_FOUND");
          if (doc.status === "CANCELLED") throw new Error("TRANSFER_ALREADY_CANCELLED");
          if (doc.status === "IN_TRANSIT") throw new Error("TRANSFER_ALREADY_SHIPPED");
          if (doc.status === "RECEIVED") throw new Error("TRANSFER_ALREADY_RECEIVED");
          if (!["REQUESTED", "APPROVED"].includes(doc.status)) {
            throw new Error("INVALID_TRANSFER_STATE");
          }

          const updated = await tx.stockTransfer.update({
            where: { id },
            data: { status: "CANCELLED" }
          });

          await tx.auditLog.create({
            data: {
              entityType: "stock-transfer",
              entityId: id,
              actorId: user.id,
              action: "TRANSFER_CANCELLED",
              prevStatus: doc.status,
              newStatus: "CANCELLED",
              metadata: { transferNumber: doc.transferNumber }
            }
          });

          return updated;
        });

        return transfer;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // ====================================================================
  // GET /inventory/production-requirements
  // Material Demand, BOM Breakdown, Allocation & Shortage Intelligence
  // ====================================================================
  fastify.get(
    "/production-requirements",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "SUPERVISOR", "ADMIN", "SUPERADMIN")] },
    async (request) => {
      // 1. Fetch all active and recent WorkOrders
      const workOrders = await prisma.workOrder.findMany({
        where: {
          status: { notIn: ["CANCELLED"] }
        },
        include: {
          productionPlan: { select: { id: true, planNumber: true, priority: true } },
          productionRequirement: { select: { id: true, requirementNumber: true, priority: true, requiredDeliveryDate: true } },
          salesOrder: { select: { id: true, salesOrderNumber: true, priority: true, customer: { select: { name: true } } } },
          bom: {
            include: {
              items: {
                include: {
                  material: true
                }
              }
            }
          },
          execution: true,
          scheduling: true,
          supervisor: { select: { id: true, name: true, email: true } }
        },
        orderBy: [
          { dueDate: "asc" },
          { createdAt: "desc" }
        ]
      });

      // Fetch all active inventory reservations
      const allActiveReservations = await prisma.inventoryReservation.findMany({
        where: { status: "RESERVED" }
      });

      // Group reservations by materialId
      const resByMaterial = new Map<string, number>();
      for (const r of allActiveReservations) {
        if (r.materialId) {
          resByMaterial.set(r.materialId, (resByMaterial.get(r.materialId) || 0) + r.quantity);
        }
      }

      // Fetch active PurchaseRequests to prevent duplicate spawn indications
      const activePRs = await prisma.purchaseRequest.findMany({
        where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
        include: { items: true }
      });

      // Default fallback BOM
      const defaultBOM = await prisma.bOM.findFirst({
        include: { items: { include: { material: true } } }
      });

      const processedOrders: any[] = [];
      const shortageAggMap = new Map<string, any>();

      let activeProductionCount = 0;
      let materialShortagesCount = 0;
      let needsAllocationCount = 0;
      let materialsReadyCount = 0;

      for (const wo of workOrders) {
        // Resolve BOM
        let bom = wo.bom;
        if (!bom && wo.productRef) {
          bom = await prisma.bOM.findFirst({
            where: { name: { contains: wo.productRef, mode: "insensitive" } },
            include: { items: { include: { material: true } } }
          }) || defaultBOM;
        } else if (!bom) {
          bom = defaultBOM;
        }

        const bomItems = bom?.items || [];
        let orderHasShortage = false;
        let orderAllAllocated = bomItems.length > 0;

        const materialBreakdown = bomItems.map(item => {
          const bomQtyPerUnit = item.quantity;
          const requiredQty = bomQtyPerUnit * wo.plannedQuantity;
          const physicalStock = item.material?.quantity ?? 0;
          const totalReserved = resByMaterial.get(item.materialId) || 0;
          const availableStock = Math.max(0, physicalStock - totalReserved);

          // Reservations for this specific order
          const orderReservations = allActiveReservations.filter(
            r => r.materialId === item.materialId && r.salesOrderId === wo.salesOrderId
          );
          const allocatedToOrder = orderReservations.reduce((acc, r) => acc + r.quantity, 0);

          // Effective availability including what's already reserved for this order
          const shortageQty = Math.max(0, requiredQty - (availableStock + allocatedToOrder));
          const isAllocated = allocatedToOrder >= requiredQty || ["READY", "IN_PROGRESS", "QC_PENDING", "COMPLETED", "CLOSED"].includes(wo.status);
          const isShortage = shortageQty > 0 && !isAllocated;

          if (isShortage) {
            orderHasShortage = true;
          }
          if (!isAllocated) {
            orderAllAllocated = false;
          }

          // Check if PR exists for this shortage
          const matchingPR = activePRs.find(pr => 
            (pr.sourceReferenceId === wo.productionRequirementId || pr.sourceReferenceId === wo.id) &&
            pr.items.some(pi => pi.materialId === item.materialId)
          );

          let materialStatus: "AVAILABLE" | "ALLOCATED" | "SHORTAGE" | "LOW_STOCK" = "AVAILABLE";
          if (isAllocated) {
            materialStatus = "ALLOCATED";
          } else if (isShortage) {
            materialStatus = "SHORTAGE";
          } else if (availableStock < requiredQty * 1.2) {
            materialStatus = "LOW_STOCK";
          }

          // Aggregate into shortageSummary
          if (isShortage && ["CREATED", "ASSIGNED", "READY", "IN_PROGRESS", "ON_HOLD"].includes(wo.status)) {
            const existingAgg = shortageAggMap.get(item.materialId);
            if (!existingAgg) {
              shortageAggMap.set(item.materialId, {
                materialId: item.materialId,
                name: item.material?.name || "Unknown Material",
                sku: item.material?.sku || "N/A",
                unit: item.material?.unit || "pcs",
                totalRequired: requiredQty,
                totalAvailable: availableStock,
                totalReserved: totalReserved,
                totalShortage: shortageQty,
                affectedWorkOrders: [
                  {
                    id: wo.id,
                    workOrderNumber: wo.workOrderNumber,
                    productRef: wo.productRef,
                    status: wo.status,
                    shortageQty
                  }
                ],
                purchaseRequest: matchingPR ? { id: matchingPR.id, prNumber: matchingPR.prNumber, status: matchingPR.status } : null
              });
            } else {
              existingAgg.totalRequired += requiredQty;
              existingAgg.totalShortage += shortageQty;
              existingAgg.affectedWorkOrders.push({
                id: wo.id,
                workOrderNumber: wo.workOrderNumber,
                productRef: wo.productRef,
                status: wo.status,
                shortageQty
              });
              if (!existingAgg.purchaseRequest && matchingPR) {
                existingAgg.purchaseRequest = { id: matchingPR.id, prNumber: matchingPR.prNumber, status: matchingPR.status };
              }
            }
          }

          return {
            materialId: item.materialId,
            name: item.material?.name || "Unknown Material",
            sku: item.material?.sku || "N/A",
            category: item.material?.category || "Components",
            unit: item.material?.unit || "pcs",
            bomQtyPerUnit,
            requiredQty,
            physicalStock,
            totalReserved,
            availableStock,
            allocatedToOrder,
            shortageQty,
            isAllocated,
            isShortage,
            status: materialStatus,
            purchaseRequest: matchingPR ? { id: matchingPR.id, prNumber: matchingPR.prNumber, status: matchingPR.status } : null
          };
        });

        // Determine Work Order level material status
        let woMaterialStatus: "IN_PRODUCTION" | "COMPLETED" | "SHORTAGE" | "ALLOCATED" | "ATTENTION" | "READY" = "READY";
        if (wo.status === "IN_PROGRESS") {
          woMaterialStatus = "IN_PRODUCTION";
          activeProductionCount++;
        } else if (wo.status === "ON_HOLD") {
          woMaterialStatus = orderHasShortage ? "SHORTAGE" : "ATTENTION";
          activeProductionCount++;
        } else if (["COMPLETED", "CLOSED"].includes(wo.status)) {
          woMaterialStatus = "COMPLETED";
        } else if (orderHasShortage) {
          woMaterialStatus = "SHORTAGE";
        } else if (orderAllAllocated || wo.status === "READY") {
          woMaterialStatus = "ALLOCATED";
        } else if (materialBreakdown.some(m => m.status === "LOW_STOCK")) {
          woMaterialStatus = "ATTENTION";
        }

        if (orderHasShortage && ["CREATED", "ASSIGNED", "READY", "IN_PROGRESS", "ON_HOLD"].includes(wo.status)) {
          materialShortagesCount++;
        }
        if (["CREATED", "ASSIGNED"].includes(wo.status) && !orderAllAllocated) {
          needsAllocationCount++;
        }
        if ((orderAllAllocated || wo.status === "READY") && ["CREATED", "ASSIGNED", "READY"].includes(wo.status)) {
          materialsReadyCount++;
        }

        const priority = wo.productionPlan?.priority || wo.productionRequirement?.priority || wo.salesOrder?.priority || "NORMAL";

        processedOrders.push({
          id: wo.id,
          workOrderNumber: wo.workOrderNumber,
          productRef: wo.productRef,
          plannedQuantity: wo.plannedQuantity,
          startedQuantity: wo.startedQuantity,
          completedQuantity: wo.completedQuantity,
          remainingQuantity: wo.remainingQuantity,
          status: wo.status,
          materialStatus: woMaterialStatus,
          hasShortage: orderHasShortage,
          isAllocated: orderAllAllocated,
          priority,
          dueDate: wo.dueDate,
          startDate: wo.startDate,
          startedAt: wo.execution?.startedAt || null,
          pauseReason: wo.execution?.pauseReason || null,
          productionPlan: wo.productionPlan,
          productionRequirement: wo.productionRequirement,
          salesOrder: wo.salesOrder,
          supervisor: wo.supervisor,
          bom: bom ? { id: bom.id, name: bom.name, itemCount: bomItems.length } : null,
          materials: materialBreakdown
        });
      }

      const shortageSummary = Array.from(shortageAggMap.values());

      return {
        summary: {
          activeProductionCount,
          materialShortagesCount,
          needsAllocationCount,
          materialsReadyCount,
          totalWorkOrders: workOrders.length
        },
        shortageSummary,
        orders: processedOrders
      };
    }
  );
}


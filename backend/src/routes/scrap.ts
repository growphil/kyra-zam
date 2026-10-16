import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { ScrapType, ScrapSource, ScrapStatus } from "../generated/client";
import { ScrapWorkflowEngine } from "../services/scrapWorkflowEngine";

export async function scrapRoutes(fastify: FastifyInstance) {
  // GET /scrap - List all scrap entries
  fastify.get(
    "/",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const scraps = await prisma.scrapEntry.findMany({
        include: {
          material: { select: { name: true, sku: true, unit: true, category: true } },
          creator: { select: { name: true } },
          approver: { select: { name: true } },
          scrapInventory: true,
          scrapSales: true
        },
        orderBy: { createdAt: "desc" },
      });
      return scraps;
    }
  );

  // GET /scrap/analytics - Get analytics data for both loss and profitable scrap
  fastify.get(
    "/analytics",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const scraps = await prisma.scrapEntry.findMany({
        include: {
          scrapInventory: true,
          scrapSales: true
        }
      });

      // 1. Loss scrap calculations
      const lossEntries = scraps.filter(s => s.scrapType === ScrapType.LOSS);
      const totalLossAmount = lossEntries
        .filter(s => s.status === ScrapStatus.SCRAPPED || s.status === ScrapStatus.DISPOSED)
        .reduce((sum, s) => sum + s.totalCost, 0);

      // 2. Profitable scrap calculations
      const sales = await prisma.scrapSale.findMany();
      const totalRecoveredRevenue = sales.reduce((sum, sale) => sum + (sale.quantitySold * sale.salePrice), 0);

      // 3. Stored recovery quantity
      const storedRecoveryQuantity = scraps
        .filter(s => s.scrapType === ScrapType.PROFITABLE && s.status === ScrapStatus.STORED)
        .reduce((sum, s) => sum + (s.scrapInventory?.quantity || 0), 0);

      // 4. Pending reviews
      const pendingReviews = scraps.filter(s => 
        s.status === ScrapStatus.REPORTED || 
        s.status === ScrapStatus.SCRAP_PENDING_REVIEW || 
        s.status === ScrapStatus.UNDER_REVIEW
      ).length;

      // Breakdown of quantities by defect and source
      const defectBreakdown = scraps.reduce((acc, s) => {
        acc[s.defectType] = (acc[s.defectType] || 0) + s.quantity;
        return acc;
      }, {} as Record<string, number>);

      const sourceBreakdown = scraps.reduce((acc, s) => {
        acc[s.sourceType] = (acc[s.sourceType] || 0) + s.quantity;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalLossAmount,
        totalRecoveredRevenue,
        storedRecoveryQuantity,
        pendingReviews,
        sourceBreakdown,
        defectBreakdown
      };
    }
  );

  // POST /scrap - Create new scrap entry (Profitable or Loss)
  fastify.post(
    "/",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const {
        scrapType,
        sourceType,
        materialId,
        quantity,
        defectType,
        severity,
        description,
        estimatedRecoveryValue = 0,
        images = [],
        reports = []
      } = request.body as any;
      const user = request.user as { id: string; roles: string[] };

      // Generate scrapId e.g. SCRAP-YYYY-XXXX
      const count = await prisma.scrapEntry.count();
      const scrapId = `SCRAP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      // Get material to populate historical name/sku/price
      const material = await prisma.material.findUnique({ where: { id: materialId } });
      if (!material) {
        return reply.status(404).send({ error: "Material not found" });
      }

      const unitCost = material.unitPrice;
      const totalCost = Number(quantity) * unitCost;

      try {
        const newScrap = await prisma.scrapEntry.create({
          data: {
            scrapId,
            scrapType: scrapType as ScrapType,
            sourceType: sourceType as ScrapSource,
            status: ScrapStatus.REPORTED,
            materialId,
            materialName: material.name,
            sku: material.sku,
            quantity: Number(quantity),
            unitCost,
            totalCost,
            estimatedRecoveryValue: Number(estimatedRecoveryValue),
            actualSaleValue: 0,
            defectType: defectType || "Other",
            severity,
            description,
            images,
            reports,
            createdBy: user.id
          },
          include: {
            material: { select: { name: true, sku: true, unit: true, category: true } },
            creator: { select: { name: true } },
          }
        });

        await prisma.auditLog.create({
          data: {
            entityType: "scrap",
            entityId: newScrap.id,
            actorId: user.id,
            action: "created",
            newStatus: "REPORTED",
            metadata: { scrapType, quantity, defectType, totalCost }
          }
        });

        return newScrap;
      } catch (error: any) {
        return reply.status(400).send({ error: error.message || "Failed to create scrap entry" });
      }
    }
  );

  // PATCH /scrap/:id/status - Update scrap status (Admin / Superadmin)
  fastify.patch(
    "/:id/status",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status, notes, location, buyerName, salePrice, quantitySold, saleDate } = request.body as any;
      const user = request.user as { id: string; roles: string[] };

      try {
        const result = await prisma.$transaction(async (tx) => {
          return await ScrapWorkflowEngine.transition(
            tx,
            id,
            status as ScrapStatus,
            user.id,
            { notes, location, buyerName, salePrice, quantitySold, saleDate },
            user.roles
          );
        });
        return result;
      } catch (error: any) {
        return reply.status(400).send({ error: error.message || "Failed to update scrap status" });
      }
    }
  );

  // PATCH /scrap/:id/override - Superadmin details and status override
  fastify.patch(
    "/:id/override",
    { preHandler: [requireRoles("SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status, estimatedRecoveryValue, actualSaleValue, notes } = request.body as any;
      const user = request.user as { id: string; roles: string[] };

      try {
        const result = await prisma.$transaction(async (tx) => {
          if (status) {
            // Force workflow engine transition bypassing role transition checks
            return await ScrapWorkflowEngine.transition(
              tx,
              id,
              status as ScrapStatus,
              user.id,
              { notes },
              user.roles // includes SUPERADMIN
            );
          }

          const dataToUpdate: any = {};
          if (estimatedRecoveryValue !== undefined) dataToUpdate.estimatedRecoveryValue = Number(estimatedRecoveryValue);
          if (actualSaleValue !== undefined) dataToUpdate.actualSaleValue = Number(actualSaleValue);

          const updated = await tx.scrapEntry.update({
            where: { id },
            data: dataToUpdate,
            include: {
              material: { select: { name: true, sku: true, unit: true, category: true } },
              creator: { select: { name: true } },
              approver: { select: { name: true } },
              scrapInventory: true,
              scrapSales: true
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "scrap",
              entityId: id,
              actorId: user.id,
              action: "superadmin_override",
              metadata: { dataToUpdate, remarks: notes }
            }
          });

          return updated;
        });

        return result;
      } catch (error: any) {
        return reply.status(400).send({ error: error.message || "Failed to override scrap entry" });
      }
    }
  );
}

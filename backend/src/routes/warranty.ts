import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { WarrantyCreateSchema, WarrantyClaimSchema } from "../schemas/zod.schemas";

// Sequential numbering helpers
async function generateWarrantyNumber() {
  const last = await prisma.warranty.findFirst({ orderBy: { warrantyNumber: 'desc' } });
  let next = 1;
  if (last) {
    const match = last.warrantyNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `WAR-${String(next).padStart(6, '0')}`;
}

export async function warrantyRoutes(fastify: FastifyInstance) {
  const servicePreHandler = { preHandler: [requireRoles("SUPERVISOR", "ADMIN", "SUPERADMIN")] };
  const readPreHandler = { preHandler: [requireRoles("SUPERVISOR", "PAX_TEST_ENGINEER", "ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN", "SELLER", "SALES_EXECUTIVE")] };

  // GET /crm/warranty/dashboard
  fastify.get("/dashboard", readPreHandler, async (request, reply) => {
    const [activeCount, expiredCount, claimedCount] = await Promise.all([
      prisma.warranty.count({ where: { status: "ACTIVE" } }),
      prisma.warranty.count({ where: { status: "EXPIRED" } }),
      prisma.warranty.count({ where: { status: "CLAIMED" } })
    ]);

    // Service statistics
    const [srvReceived, srvProgress, srvCompleted] = await Promise.all([
      prisma.serviceBattery.count({ where: { status: "RECEIVED" } }),
      prisma.serviceBattery.count({ where: { status: "REPAIR_IN_PROGRESS" } }),
      prisma.serviceBattery.count({ where: { status: "READY_FOR_DELIVERY" } })
    ]);

    return {
      stats: {
        activeCount,
        expiredCount,
        claimedCount,
        srvReceived,
        srvProgress,
        srvCompleted
      }
    };
  });

  // GET /crm/warranty/warranties
  fastify.get("/warranties", readPreHandler, async (request, reply) => {
    const { status, paxSerial } = request.query as any;
    const where: any = {};
    if (status) where.status = status;
    if (paxSerial) where.paxSerial = paxSerial;

    return prisma.warranty.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        pax: true
      }
    });
  });

  // GET /crm/warranty/warranties/:id
  fastify.get("/warranties/:id", readPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await prisma.warranty.findUnique({
      where: { id },
      include: {
        customer: true,
        pax: true,
        salesOrder: true,
        invoice: true,
        serviceBatteries: true
      }
    });
    if (!doc) return reply.status(404).send({ error: "Warranty not found" });
    return doc;
  });

  // POST /crm/warranty/warranties - Register Warranty
  fastify.post("/warranties", servicePreHandler, async (request, reply) => {
    const data = WarrantyCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const warrantyNumber = await generateWarrantyNumber();

    try {
      const doc = await prisma.$transaction(async (tx) => {
        // Lock PaxPack row deterministically to prevent concurrent activations
        await tx.$executeRawUnsafe(
          `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
          data.paxSerial
        );

        // Verify PAX exists
        const pack = await tx.paxPack.findUnique({ where: { paxSerial: data.paxSerial } });
        if (!pack) throw new Error(`Battery pack serial ${data.paxSerial} not found`);

        // Check if the pack was shipped via a DispatchOrder
        const dispatchItem = await tx.dispatchItem.findFirst({
          where: { paxSerial: data.paxSerial },
          include: { dispatchOrder: true }
        });

        // If it was shipped, it must be DELIVERED to activate warranty
        if (dispatchItem && dispatchItem.dispatchOrder.status !== "DELIVERED") {
          throw new Error(`Cannot activate warranty. Dispatch order ${dispatchItem.dispatchOrder.dispatchNumber} is not DELIVERED (Current status: ${dispatchItem.dispatchOrder.status})`);
        }

        // Check eligibility status
        if (pack.status !== "SOLD_TO_CUSTOMER") {
          throw new Error(`Cannot activate warranty. Pack status must be SOLD_TO_CUSTOMER (Current: ${pack.status})`);
        }

        // Validate ownership relation via sales order/invoice if present
        if (data.salesOrderId) {
          const order = await tx.salesOrder.findUnique({ where: { id: data.salesOrderId } });
          if (order && order.customerId !== data.customerId) {
            throw new Error("Sales Order customer mismatch");
          }
        }

        // Prevent duplicate warranties
        const existingWarranty = await tx.warranty.findFirst({
          where: { paxSerial: data.paxSerial, status: "ACTIVE" }
        });
        if (existingWarranty) {
          throw new Error("An active warranty contract already exists for this battery pack.");
        }

        const start = new Date(data.deliveryDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + data.warrantyDurationMonths);

        const created = await tx.warranty.create({
          data: {
            warrantyNumber,
            customerId: data.customerId,
            paxSerial: data.paxSerial,
            salesOrderId: data.salesOrderId,
            invoiceId: data.invoiceId,
            deliveryDate: start,
            warrantyStartDate: start,
            warrantyEndDate: end,
            warrantyDurationMonths: data.warrantyDurationMonths,
            coverageType: data.coverageType,
            terms: data.terms,
            exclusions: data.exclusions,
            status: "ACTIVE"
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "warranty",
            entityId: created.id,
            actorId: actor.id,
            action: "WARRANTY_ACTIVATED",
            prevStatus: "NONE",
            newStatus: "ACTIVE",
            metadata: { warrantyNumber, paxSerial: data.paxSerial }
          }
        });

        return created;
      });

      return doc;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Warranty registration failed" });
    }
  });

  // POST /crm/warranty/warranties/check-eligibility
  fastify.post("/warranties/check-eligibility", readPreHandler, async (request, reply) => {
    const { paxSerial, customerId } = request.body as any;

    const w = await prisma.warranty.findFirst({
      where: {
        paxSerial,
        customerId,
        status: "ACTIVE"
      }
    });

    if (!w) {
      return { eligible: false, message: "No active warranty contract found for this product/customer combination" };
    }

    const now = new Date();
    if (now > new Date(w.warrantyEndDate)) {
      await prisma.warranty.update({ where: { id: w.id }, data: { status: "EXPIRED" } });
      return { eligible: false, message: "Warranty has expired" };
    }

    return { eligible: true, warranty: w };
  });
}

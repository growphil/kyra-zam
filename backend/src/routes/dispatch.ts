import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { DispatchOrderCreateSchema } from "../schemas/zod.schemas";

// Sequential numbering helper
async function generateDispatchNumber() {
  const last = await prisma.dispatchOrder.findFirst({ orderBy: { dispatchNumber: 'desc' } });
  let next = 1;
  if (last) {
    const match = last.dispatchNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `DO-${String(next).padStart(6, '0')}`;
}

async function generateShipmentNumber() {
  const last = await prisma.shipment.findFirst({ orderBy: { shipmentNumber: 'desc' } });
  let next = 1;
  if (last) {
    const match = last.shipmentNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `SHIP-${String(next).padStart(6, '0')}`;
}

async function generatePackageNumber() {
  const last = await prisma.deliveryPackage.findFirst({ orderBy: { packageNumber: 'desc' } });
  let next = 1;
  if (last) {
    const match = last.packageNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `PKG-${String(next).padStart(6, '0')}`;
}

export async function dispatchRoutes(fastify: FastifyInstance) {
  const dispatchPreHandler = { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "SALES_EXECUTIVE", "ACCOUNTANT", "ADMIN", "SUPERADMIN")] };
  const readPreHandler = { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "SALES_EXECUTIVE", "ACCOUNTANT", "ADMIN", "SUPERADMIN")] };

  // GET /crm/dispatch/dashboard
  fastify.get("/dashboard", readPreHandler, async (request, reply) => {
    const [
      pending,
      picking,
      packing,
      readyToDispatch,
      dispatched,
      inTransit,
      delivered
    ] = await Promise.all([
      prisma.dispatchOrder.count({ where: { status: "DRAFT" } }),
      prisma.dispatchOrder.count({ where: { status: "PICKING" } }),
      prisma.dispatchOrder.count({ where: { status: "PACKING" } }),
      prisma.dispatchOrder.count({ where: { status: "READY_TO_DISPATCH" } }),
      prisma.dispatchOrder.count({ where: { status: "DISPATCHED" } }),
      prisma.dispatchOrder.count({ where: { status: "IN_TRANSIT" } }),
      prisma.dispatchOrder.count({ where: { status: "DELIVERED" } })
    ]);

    return {
      stats: {
        pending,
        picking,
        packing,
        readyToDispatch,
        dispatched,
        inTransit,
        delivered
      }
    };
  });

  // GET /crm/dispatch/orders
  fastify.get("/orders", readPreHandler, async (request, reply) => {
    const { status, salesOrderId, customerId } = request.query as any;
    const where: any = {};
    if (status) where.status = status;
    if (salesOrderId) where.salesOrderId = salesOrderId;
    if (customerId) where.customerId = customerId;

    return prisma.dispatchOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        salesOrder: { select: { salesOrderNumber: true } },
        customer: { select: { name: true } }
      }
    });
  });

  // GET /crm/dispatch/orders/:id
  fastify.get("/orders/:id", readPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await prisma.dispatchOrder.findUnique({
      where: { id },
      include: {
        salesOrder: true,
        customer: true,
        items: { include: { pax: { include: { paxType: true } } } },
        packages: true,
        shipments: { include: { proofsOfDelivery: true } }
      }
    });
    if (!order) return reply.status(404).send({ error: "Dispatch Order not found" });
    return order;
  });

  // POST /crm/dispatch/orders
  fastify.post("/orders", dispatchPreHandler, async (request, reply) => {
    const data = DispatchOrderCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const dispatchNumber = await generateDispatchNumber();

    try {
      const dispatch = await prisma.$transaction(async (tx) => {
        // Load and verify Sales Order inside the transaction
        const salesOrder = await tx.salesOrder.findUnique({
          where: { id: data.salesOrderId }
        });
        if (!salesOrder) throw new Error("Sales Order not found");
        if (!salesOrder.isFinancialCleared) {
          throw new Error("Cannot create Dispatch Order: Sales Order is not financially cleared.");
        }

        // Validate Sales Order status
        if (["DRAFT", "CANCELLED"].includes(salesOrder.status)) {
          throw new Error(`Cannot dispatch for Sales Order in ${salesOrder.status} status.`);
        }

        // Create the Dispatch Order header
        const doc = await tx.dispatchOrder.create({
          data: {
            dispatchNumber,
            salesOrderId: data.salesOrderId,
            customerId: data.customerId,
            createdById: actor.id,
            plannedDispatchDate: new Date(data.plannedDispatchDate),
            deliveryAddressSnapshot: data.deliveryAddressSnapshot,
            priority: data.priority,
            shippingMethod: data.shippingMethod,
            carrier: data.carrier,
            notes: data.notes,
            status: "READY_TO_PICK"
          }
        });

        // Add items & reservations
        for (const item of data.items) {
          // Double check partial dispatch limits
          const orderItem = await tx.salesOrderItem.findUnique({ where: { id: item.salesOrderItemId } });
          if (!orderItem) throw new Error("Sales Order Line Item not found");

          const cumulative = orderItem.quantityFulfilled + item.quantityDispatched;
          if (cumulative > orderItem.quantityOrdered) {
            throw new Error(`Over-fulfillment constraint. Ordered: ${orderItem.quantityOrdered}, Dispatched: ${cumulative}`);
          }

          // If serialized PAX, auto-assign first available READY_FOR_SALE pack if not specified
          let assignedSerial = item.paxSerial;
          if (!assignedSerial && orderItem.productRef?.startsWith("PAX")) {
            const type = await tx.paxType.findFirst({
              where: { name: { contains: orderItem.productRef, mode: "insensitive" } }
            });
            if (type) {
              const pack = await tx.paxPack.findFirst({
                where: { 
                  paxTypeId: type.id, 
                  status: "READY_FOR_SALE", 
                  reservations: { none: { status: "RESERVED" } } 
                }
              });
              if (pack) {
                assignedSerial = pack.paxSerial;
              } else {
                throw new Error(`No available READY_FOR_SALE battery packs found matching blueprint ${orderItem.productRef}`);
              }
            }
          }

          // Create Dispatch Item record
          await tx.dispatchItem.create({
            data: {
              dispatchOrderId: doc.id,
              salesOrderItemId: item.salesOrderItemId,
              productRef: item.productRef,
              quantityOrdered: item.quantityOrdered,
              quantityDispatched: item.quantityDispatched,
              paxSerial: assignedSerial,
              notes: item.notes
            }
          });

          // Concurrency & eligibility checks on serialized packs
          if (assignedSerial) {
            // Lock the selected PaxPack row deterministically
            await tx.$executeRawUnsafe(
              `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
              assignedSerial
            );

            const pack = await tx.paxPack.findUnique({ where: { paxSerial: assignedSerial } });
            if (!pack) throw new Error(`Pack serial ${assignedSerial} not found`);
            if (pack.status !== "READY_FOR_SALE") {
              throw new Error(`Pack ${assignedSerial} is not READY_FOR_SALE. Current: ${pack.status}`);
            }

            // Prevent Inventory Stealing
            const otherRes = await tx.inventoryReservation.findFirst({
              where: {
                paxSerial: assignedSerial,
                salesOrderId: { not: data.salesOrderId }
              }
            });
            if (otherRes) {
              throw new Error(`Pack ${assignedSerial} belongs to or is reserved for another Sales Order.`);
            }

            // Verify active RESERVED reservations
            const existingRes = await tx.inventoryReservation.findFirst({
              where: { paxSerial: assignedSerial, status: "RESERVED" }
            });
            if (existingRes) {
              throw new Error(`Pack ${assignedSerial} is already reserved.`);
            }

            // Create Reservation to lock it
            await tx.inventoryReservation.create({
              data: {
                salesOrderId: data.salesOrderId,
                materialId: orderItem.materialId || null,
                quantity: 1,
                status: "RESERVED",
                paxSerial: assignedSerial
              }
            });
          }
        }

        await tx.auditLog.create({
          data: {
            entityType: "dispatch-order",
            entityId: doc.id,
            actorId: actor.id,
            action: "DISPATCH_ORDER_CREATED",
            newStatus: "READY_TO_PICK",
            metadata: { dispatchNumber }
          }
        });

        return doc;
      });

      return dispatch;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Dispatch creation transaction failed" });
    }
  });

  // PUT /crm/dispatch/orders/:id/pick - Pick validation scan
  fastify.put("/orders/:id/pick", dispatchPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { serials } = request.body as { serials: string[] };

    const order = await prisma.dispatchOrder.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!order) return reply.status(404).send({ error: "Dispatch Order not found" });

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Advance status
        await tx.dispatchOrder.update({
          where: { id },
          data: { status: "PICKED" }
        });

        for (const serial of serials) {
          const item = order.items.find(x => x.paxSerial === serial);
          if (!item) throw new Error(`Serial ${serial} is not configured for this Dispatch`);

          await tx.dispatchItem.update({
            where: { id: item.id },
            data: { quantityPicked: 1 }
          });
        }

        return { success: true };
      });
      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // PUT /crm/dispatch/orders/:id/pack
  fastify.put("/orders/:id/pack", dispatchPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { weight, dimensions, packageType } = request.body as { weight?: number; dimensions?: string; packageType?: string };

    const order = await prisma.dispatchOrder.findUnique({ where: { id }, include: { items: true } });
    if (!order) return reply.status(404).send({ error: "Dispatch Order not found" });

    const packageNumber = await generatePackageNumber();

    const result = await prisma.$transaction(async (tx) => {
      const pkg = await tx.deliveryPackage.create({
        data: {
          packageNumber,
          dispatchOrderId: id,
          weight,
          dimensions,
          packageType: packageType || "BOX"
        }
      });

      // Update item packed quantity
      for (const item of order.items) {
        await tx.dispatchItem.update({
          where: { id: item.id },
          data: { quantityPacked: item.quantityPicked }
        });
      }

      await tx.dispatchOrder.update({
        where: { id },
        data: { status: "PACKED" }
      });

      return pkg;
    });

    return result;
  });

  // PUT /crm/dispatch/orders/:id/ship
  fastify.put("/orders/:id/ship", dispatchPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { carrier, shippingMethod, trackingNumber, expectedDeliveryDate } = request.body as {
      carrier: string;
      shippingMethod: string;
      trackingNumber?: string;
      expectedDeliveryDate: string;
    };
    const actor = request.user as { id: string };

    const shipmentNumber = await generateShipmentNumber();

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lock Dispatch Order to prevent concurrent ship calls
        await tx.$executeRawUnsafe(
          `SELECT * FROM "DispatchOrder" WHERE id = $1 FOR UPDATE`,
          id
        );

        const order = await tx.dispatchOrder.findUnique({
          where: { id },
          include: { items: true, salesOrder: true }
        });
        if (!order) throw new Error("Dispatch Order not found");
        if (order.status !== "PACKED") {
          throw new Error(`Cannot ship order. Status must be PACKED (Current: ${order.status})`);
        }

        // Create Shipment record
        const ship = await tx.shipment.create({
          data: {
            shipmentNumber,
            dispatchOrderId: id,
            carrier,
            shippingMethod,
            trackingNumber,
            pickupDate: new Date(),
            expectedDeliveryDate: new Date(expectedDeliveryDate),
            status: "IN_TRANSIT"
          }
        });

        // Loop items to release reservation, record stock movement and deduct status
        for (const item of order.items) {
          const soItem = await tx.salesOrderItem.findUnique({
            where: { id: item.salesOrderItemId }
          });

          if (item.paxSerial) {
            // Lock PaxPack row
            await tx.$executeRawUnsafe(
              `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
              item.paxSerial
            );

            // Update Pax status to SOLD_TO_CUSTOMER
            await tx.paxPack.update({
              where: { paxSerial: item.paxSerial },
              data: { status: "SOLD_TO_CUSTOMER" }
            });

            // Lock and shift reservation RESERVED -> ISSUED (NO deleteMany)
            await tx.inventoryReservation.updateMany({
              where: { paxSerial: item.paxSerial, salesOrderId: order.salesOrderId, status: "RESERVED" },
              data: { status: "ISSUED", issuedAt: new Date() }
            });

            // Log Stock movement for finished good (if tracked in Material)
            let materialId = soItem?.materialId;
            if (!materialId && item.productRef) {
              const matchedMat = await tx.material.findFirst({
                where: { sku: item.productRef }
              });
              if (matchedMat) {
                materialId = matchedMat.id;
              }
            }

            if (materialId) {
              // Lock Material row
              await tx.$executeRawUnsafe(
                `SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`,
                materialId
              );

              // We only write StockMovement for the finished battery pack shipment.
              // We do NOT decrement Material.quantity here because Phase 4 material consumption 
              // already decremented raw material physical stocks. Finished battery packs 
              // are not physically tracked in the Material table.
              await tx.stockMovement.create({
                data: {
                  materialId,
                  quantity: -1,
                  movementType: "ISSUE",
                  source: "CUSTOMER_DELIVERY",
                  referenceId: order.dispatchNumber,
                  userId: actor.id,
                  reason: `Dispatched to Customer on DO: ${order.dispatchNumber}`
                }
              });
            }
          }

          // Advance Sales Order item fulfilled status
          await tx.salesOrderItem.update({
            where: { id: item.salesOrderItemId },
            data: {
              quantityFulfilled: { increment: item.quantityDispatched },
              quantityPending: { decrement: item.quantityDispatched }
            }
          });
        }

        // Advance Dispatch Order status
        await tx.dispatchOrder.update({
          where: { id },
          data: {
            status: "IN_TRANSIT",
            carrier,
            trackingNumber
          }
        });

        // Calculate and update Sales Order fulfillment status from fresh data
        const items = await tx.salesOrderItem.findMany({
          where: { salesOrderId: order.salesOrderId }
        });
        const totalPending = items.reduce((acc, x) => acc + x.quantityPending, 0);
        const totalFulfilled = items.reduce((acc, x) => acc + x.quantityFulfilled, 0);

        let newSOStatus = order.salesOrder.status;
        if (totalPending === 0) {
          newSOStatus = "FULFILLED";
        } else if (totalFulfilled > 0) {
          newSOStatus = "PARTIALLY_FULFILLED";
        }

        await tx.salesOrder.update({
          where: { id: order.salesOrderId },
          data: { status: newSOStatus }
        });

        await tx.auditLog.create({
          data: {
            entityType: "shipment",
            entityId: ship.id,
            actorId: actor.id,
            action: "SHIPMENT_DISPATCHED",
            prevStatus: "PENDING",
            newStatus: "IN_TRANSIT",
            metadata: { shipmentNumber, trackingNumber }
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "dispatch-order",
            entityId: id,
            actorId: actor.id,
            action: "DISPATCHED",
            prevStatus: order.status,
            newStatus: "IN_TRANSIT",
            metadata: { dispatchNumber: order.dispatchNumber }
          }
        });

        return ship;
      });

      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Shipment dispatch failed" });
    }
  });

  // PUT /crm/dispatch/orders/:id/deliver - Proof of Delivery confirmation
  fastify.put("/orders/:id/deliver", dispatchPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { recipientName, recipientContact, deliveryNotes } = request.body as {
      recipientName: string;
      recipientContact?: string;
      deliveryNotes?: string;
    };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lock Dispatch Order row
        await tx.$executeRawUnsafe(
          `SELECT * FROM "DispatchOrder" WHERE id = $1 FOR UPDATE`,
          id
        );

        const order = await tx.dispatchOrder.findUnique({
          where: { id },
          include: { shipments: true, items: true }
        });
        if (!order) throw new Error("Dispatch Order not found");

        // Idempotency: if already delivered, return success immediately
        if (order.status === "DELIVERED") {
          return { success: true, message: "Order is already delivered." };
        }

        // Deliveries can only be confirmed for IN_TRANSIT orders
        if (order.status !== "IN_TRANSIT") {
          throw new Error(`Cannot deliver order. Status must be IN_TRANSIT (Current: ${order.status})`);
        }

        const activeShip = order.shipments.find(s => s.status === "IN_TRANSIT");
        if (!activeShip) throw new Error("No active IN_TRANSIT shipment found for this order");

        // Create POD
        const pod = await tx.proofOfDelivery.create({
          data: {
            shipmentId: activeShip.id,
            recipientName,
            recipientContact,
            deliveryNotes
          }
        });

        // Update shipment status
        await tx.shipment.update({
          where: { id: activeShip.id },
          data: {
            status: "DELIVERED",
            actualDeliveryDate: new Date()
          }
        });

        // Update dispatch status
        await tx.dispatchOrder.update({
          where: { id },
          data: {
            status: "DELIVERED",
            dispatchDate: new Date()
          }
        });

        // Update item delivered quantity
        for (const item of order.items) {
          await tx.dispatchItem.update({
            where: { id: item.id },
            data: { quantityDelivered: item.quantityDispatched }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: "dispatch-order",
            entityId: id,
            actorId: (request.user as any).id,
            action: "DELIVERED",
            prevStatus: order.status,
            newStatus: "DELIVERED",
            metadata: { dispatchNumber: order.dispatchNumber }
          }
        });

        return pod;
      });

      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Delivery confirmation failed" });
    }
  });

  // PUT /crm/dispatch/orders/:id/exception - Log delivery exception
  fastify.put("/orders/:id/exception", dispatchPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { description } = request.body as { description: string };

    const order = await prisma.dispatchOrder.findUnique({ where: { id } });
    if (!order) return reply.status(404).send({ error: "Dispatch Order not found" });

    const updated = await prisma.dispatchOrder.update({
      where: { id },
      data: { status: "DELIVERY_EXCEPTION", notes: description }
    });

    return updated;
  });
}

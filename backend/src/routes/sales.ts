import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";

// Sequential number generator helpers
async function generateSalesOrderNumber() {
  let next = 1;
  const last = await prisma.salesOrder.findFirst({
    where: { salesOrderNumber: { startsWith: "SO-" } },
    orderBy: { salesOrderNumber: 'desc' }
  });
  if (last) {
    const numPart = last.salesOrderNumber.replace("SO-", "").split("-")[0];
    const val = parseInt(numPart, 10);
    if (!isNaN(val)) next = val + 1;
  }
  while (true) {
    const candidate = `SO-${String(next).padStart(6, '0')}`;
    const exists = await prisma.salesOrder.findFirst({ where: { salesOrderNumber: candidate } });
    if (!exists) return candidate;
    next++;
  }
}

async function generateDispatchNumber() {
  let next = 1;
  const last = await prisma.dispatchOrder.findFirst({
    where: { dispatchNumber: { startsWith: "DO-" } },
    orderBy: { dispatchNumber: 'desc' }
  });
  if (last) {
    const numPart = last.dispatchNumber.replace("DO-", "").split("-")[0];
    const val = parseInt(numPart, 10);
    if (!isNaN(val)) next = val + 1;
  }
  while (true) {
    const candidate = `DO-${String(next).padStart(6, '0')}`;
    const exists = await prisma.dispatchOrder.findFirst({ where: { dispatchNumber: candidate } });
    if (!exists) return candidate;
    next++;
  }
}

async function generateShipmentNumber() {
  let next = 1;
  const last = await prisma.shipment.findFirst({
    where: { shipmentNumber: { startsWith: "SHIP-" } },
    orderBy: { shipmentNumber: 'desc' }
  });
  if (last) {
    const numPart = last.shipmentNumber.replace("SHIP-", "").split("-")[0];
    const val = parseInt(numPart, 10);
    if (!isNaN(val)) next = val + 1;
  }
  while (true) {
    const candidate = `SHIP-${String(next).padStart(6, '0')}`;
    const exists = await prisma.shipment.findFirst({ where: { shipmentNumber: candidate } });
    if (!exists) return candidate;
    next++;
  }
}

async function generatePackageNumber() {
  let next = 1;
  const last = await prisma.deliveryPackage.findFirst({
    where: { packageNumber: { startsWith: "PKG-" } },
    orderBy: { packageNumber: 'desc' }
  });
  if (last) {
    const numPart = last.packageNumber.replace("PKG-", "").split("-")[0];
    const val = parseInt(numPart, 10);
    if (!isNaN(val)) next = val + 1;
  }
  while (true) {
    const candidate = `PKG-${String(next).padStart(6, '0')}`;
    const exists = await prisma.deliveryPackage.findFirst({ where: { packageNumber: candidate } });
    if (!exists) return candidate;
    next++;
  }
}

async function generateWarrantyNumber() {
  let next = 1;
  const last = await prisma.warranty.findFirst({
    where: { warrantyNumber: { startsWith: "WAR-" } },
    orderBy: { warrantyNumber: 'desc' }
  });
  if (last) {
    const numPart = last.warrantyNumber.replace("WAR-", "").split("-")[0];
    const val = parseInt(numPart, 10);
    if (!isNaN(val)) next = val + 1;
  }
  while (true) {
    const candidate = `WAR-${String(next).padStart(6, '0')}`;
    const exists = await prisma.warranty.findFirst({ where: { warrantyNumber: candidate } });
    if (!exists) return candidate;
    next++;
  }
}

async function getOrCreateCustomerForDirectSale(tx: any, saleType: string, customerName?: string, vendorId?: string, customerId?: string) {
  // 1. Direct customer ID provided
  if (customerId && customerId.trim()) {
    const existing = await tx.customer.findUnique({ where: { id: customerId.trim() } });
    if (existing) return existing;
  }

  let name = "Direct Sale Customer";
  let email = "direct@growphil.com";
  let phone = "0000000000";
  let codePrefix = "CUST";

  if (saleType === "VENDOR" && vendorId) {
    const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
    if (vendor) {
      name = vendor.name;
      email = vendor.email || "vendor@growphil.com";
      phone = vendor.phone || "0000000000";
      codePrefix = "VND";
    }
  } else if (saleType === "CUSTOMER" && customerName && customerName.trim()) {
    name = customerName.trim();
  }

  // Find existing customer by name/email
  let cust = await tx.customer.findFirst({
    where: {
      OR: [
        { name },
        { email }
      ]
    }
  });

  if (!cust) {
    const count = await tx.customer.count();
    const code = `KY-${String(count + 1).padStart(3, '0')}`;
    cust = await tx.customer.create({
      data: {
        customerCode: code,
        name,
        email: email === "direct@growphil.com" ? `cust_${Date.now()}@directsale.in` : email,
        phone,
        billingAddress: "Direct Storefront Sale",
        shippingAddress: "Direct Storefront Handover",
        city: "Default",
        state: "Default",
        country: "India",
        postalCode: "000000"
      }
    });
  }

  return cust;
}

export async function salesRoutes(fastify: FastifyInstance) {
  const sellerPreHandler = { preHandler: [requireRoles("SELLER", "SALES_EXECUTIVE", "ADMIN", "SUPERADMIN")] };

  // GET /sales/vendors - list all active vendors
  fastify.get(
    "/vendors",
    { preHandler: [requireRoles("SELLER", "SALES_EXECUTIVE", "PURCHASE_MANAGER", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      let vendors = await prisma.vendor.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });

      if (vendors.length === 0) {
        await prisma.vendor.createMany({
          data: [
            { name: "Apex Lithium Tech Supplies", email: "sales@apexlithium.com", phone: "+91 98765 43210", address: "GIDC Electronics Zone, Sector 25, Gandhinagar, Gujarat" },
            { name: "Zenith Battery Cells Ltd", email: "orders@zenithcells.in", phone: "+91 98111 22334", address: "MIDC Industrial Area, Bhosari, Pune, Maharashtra" },
            { name: "PowerMatrix Global Logistics", email: "support@powermatrix.com", phone: "+91 99223 34455", address: "Peenya Industrial Area, Phase 1, Bangalore, Karnataka" }
          ]
        });
        vendors = await prisma.vendor.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
        });
      }

      return vendors;
    }
  );

  // GET /sales/finished-goods - List only eligible Finished Goods available in warehouse
  fastify.get(
    "/finished-goods",
    sellerPreHandler,
    async (request, reply) => {
      const { search, page = "1", limit = "50" } = request.query as any;
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const take = parseInt(limit, 10);

      // Only permit eligible, QC-approved, packed and officially transferred Finished Goods
      // Prevent selecting raw cells, WIP, untested packs, rejected packs, packs under repair, scrapped packs, reserved stock or already-sold batteries.
      const where: any = {
        status: "READY_FOR_SALE",
        sales: { none: {} },
        reservations: { none: { status: "RESERVED" } },
        defects: { none: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }
      };

      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { paxSerial: { contains: q, mode: "insensitive" } },
          { paxType: { name: { contains: q, mode: "insensitive" } } },
          { packingRecord: { stickerNumber: { contains: q, mode: "insensitive" } } },
          { packingRecord: { packingNumber: { contains: q, mode: "insensitive" } } }
        ];
      }

      const [packs, total] = await Promise.all([
        prisma.paxPack.findMany({
          where,
          orderBy: { assembledAt: "desc" },
          skip,
          take,
          include: {
            paxType: true,
            packingRecord: {
              include: {
                destinationWarehouse: true,
                destinationLocation: true
              }
            },
            cells: {
              include: { cell: true },
              orderBy: { position: "asc" }
            },
            inspections: {
              where: { status: "COMPLETED" },
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        }),
        prisma.paxPack.count({ where })
      ]);

      const formatted = packs.map(p => {
        const ahVals = p.cells.map(c => c.cell?.ahValue).filter((v): v is number => typeof v === "number");
        const irVals = p.cells.map(c => c.cell?.irValue).filter((v): v is number => typeof v === "number");
        const avgAh = ahVals.length ? ahVals.reduce((a, b) => a + b, 0) / ahVals.length : (p.paxType.nominalCapacity || 0);
        const avgIr = irVals.length ? irVals.reduce((a, b) => a + b, 0) / irVals.length : 0;

        return {
          paxSerial: p.paxSerial,
          model: p.paxType.name,
          paxTypeId: p.paxType.id,
          specifications: {
            nominalVoltage: p.paxType.nominalVoltage || 48,
            nominalCapacity: p.paxType.nominalCapacity || avgAh,
            configuration: p.paxType.configuration || "16S1P",
            cellChemistry: p.paxType.cellChemistry || "LFP",
            cellCount: p.paxType.cellCount,
            avgAh: parseFloat(avgAh.toFixed(2)),
            avgIr: parseFloat(avgIr.toFixed(1))
          },
          configuredSellingPrice: p.paxType.unitPrice || 0,
          stockAvailability: "AVAILABLE",
          assembledAt: p.assembledAt,
          approvedAt: p.approvedAt,
          qcPassed: p.inspections.length > 0 ? p.inspections[0].result === "PASS" : (p.approvedAt !== null),
          qrUrl: p.qrUrl,
          packing: p.packingRecord ? {
            packingNumber: p.packingRecord.packingNumber,
            stickerNumber: p.packingRecord.stickerNumber,
            qrData: p.packingRecord.qrData,
            status: p.packingRecord.status,
            boxCondition: p.packingRecord.boxCondition,
            boxSealed: p.packingRecord.boxSealed,
            warehouseName: p.packingRecord.destinationWarehouse?.name || "Finished Goods Warehouse",
            warehouseCode: p.packingRecord.destinationWarehouse?.code || "WH-FG",
            locationName: p.packingRecord.destinationLocation?.name || "Pallet Bay 1",
            locationCode: p.packingRecord.destinationLocation?.code || "FG-STG01",
            transferredAt: p.packingRecord.transferredAt
          } : null
        };
      });

      return { packs: formatted, total, page: parseInt(page, 10), limit: take };
    }
  );

  // GET /sales/finished-goods/verify/:serial - Verify single battery pack eligibility by serial or QR/sticker scan
  fastify.get(
    "/finished-goods/verify/:serial",
    sellerPreHandler,
    async (request, reply) => {
      const { serial } = request.params as { serial: string };
      const cleanSerial = serial.trim();

      const pack = await prisma.paxPack.findFirst({
        where: {
          OR: [
            { paxSerial: cleanSerial },
            { packingRecord: { stickerNumber: cleanSerial } },
            { packingRecord: { packingNumber: cleanSerial } }
          ]
        },
        include: {
          paxType: true,
          sales: true,
          reservations: { where: { status: "RESERVED" } },
          defects: { where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } },
          packingRecord: {
            include: { destinationWarehouse: true, destinationLocation: true }
          },
          cells: { include: { cell: true }, orderBy: { position: "asc" } },
          inspections: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      });

      if (!pack) {
        return reply.status(404).send({
          eligible: false,
          reason: `Battery pack "${cleanSerial}" was not found in Finished Goods. Raw cells, WIP, or invalid serials cannot be selected.`,
          code: "NOT_FOUND"
        });
      }

      // Check status
      if (pack.status !== "READY_FOR_SALE") {
        let reason = `Battery pack is not ready for sale (Status: ${pack.status}).`;
        if (["UNDER_TEST", "PAX_ASSEMBLED", "READY_FOR_PAX_TEST"].includes(pack.status)) {
          reason = `Battery pack is WIP/Untested (Status: ${pack.status}). Assembly or PAX Testing is not completed.`;
        } else if (pack.status === "UNDER_REPAIR") {
          reason = "Battery pack is currently under repair and cannot be sold.";
        } else if (pack.status === "SCRAPPED") {
          reason = "Battery pack has been marked as scrapped and cannot be sold.";
        } else if (["SOLD_TO_CUSTOMER", "SOLD_TO_VENDOR"].includes(pack.status)) {
          reason = `Battery pack has already been sold (${pack.status}). Duplicate sale is prohibited.`;
        }
        return reply.status(400).send({ eligible: false, reason, code: "INVALID_STATUS", packStatus: pack.status });
      }

      // Check prior sales
      if (pack.sales.length > 0) {
        return reply.status(400).send({
          eligible: false,
          reason: "This battery pack has already been sold in a previous transaction.",
          code: "ALREADY_SOLD"
        });
      }

      // Check active reservation
      if (pack.reservations.length > 0) {
        return reply.status(409).send({
          eligible: false,
          reason: "This battery pack is currently reserved for another order.",
          code: "RESERVED"
        });
      }

      // Check open defects
      if (pack.defects.length > 0) {
        return reply.status(400).send({
          eligible: false,
          reason: `Battery pack has unresolved quality defect (${pack.defects[0].defectNumber}). Only QC-approved packs can be sold.`,
          code: "OPEN_DEFECT"
        });
      }

      // Check packing transfer
      if (pack.packingRecord && pack.packingRecord.status !== "TRANSFERRED_TO_FINISHED_GOODS" && pack.packingRecord.status !== "PACKED") {
        return reply.status(400).send({
          eligible: false,
          reason: `Packing station processing pending (Status: ${pack.packingRecord.status}). Pack must be officially transferred to Finished Goods warehouse.`,
          code: "PACKING_PENDING"
        });
      }

      const ahVals = pack.cells.map(c => c.cell?.ahValue).filter((v): v is number => typeof v === "number");
      const irVals = pack.cells.map(c => c.cell?.irValue).filter((v): v is number => typeof v === "number");
      const avgAh = ahVals.length ? ahVals.reduce((a, b) => a + b, 0) / ahVals.length : (pack.paxType.nominalCapacity || 0);
      const avgIr = irVals.length ? irVals.reduce((a, b) => a + b, 0) / irVals.length : 0;

      return {
        eligible: true,
        pack: {
          paxSerial: pack.paxSerial,
          model: pack.paxType.name,
          paxTypeId: pack.paxType.id,
          specifications: {
            nominalVoltage: pack.paxType.nominalVoltage || 48,
            nominalCapacity: pack.paxType.nominalCapacity || avgAh,
            configuration: pack.paxType.configuration || "16S1P",
            cellChemistry: pack.paxType.cellChemistry || "LFP",
            cellCount: pack.paxType.cellCount,
            avgAh: parseFloat(avgAh.toFixed(2)),
            avgIr: parseFloat(avgIr.toFixed(1))
          },
          configuredSellingPrice: pack.paxType.unitPrice || 0,
          stockAvailability: "AVAILABLE",
          assembledAt: pack.assembledAt,
          approvedAt: pack.approvedAt,
          qrUrl: pack.qrUrl,
          packing: pack.packingRecord ? {
            packingNumber: pack.packingRecord.packingNumber,
            stickerNumber: pack.packingRecord.stickerNumber,
            qrData: pack.packingRecord.qrData,
            status: pack.packingRecord.status,
            warehouseName: pack.packingRecord.destinationWarehouse?.name || "Finished Goods Warehouse",
            warehouseCode: pack.packingRecord.destinationWarehouse?.code || "WH-FG",
            locationName: pack.packingRecord.destinationLocation?.name || "Pallet Bay 1",
            locationCode: pack.packingRecord.destinationLocation?.code || "FG-STG01",
            transferredAt: pack.packingRecord.transferredAt
          } : null
        }
      };
    }
  );

  // GET /sales/customers - Search/list existing registered customers
  fastify.get(
    "/customers",
    sellerPreHandler,
    async (request) => {
      const { search, limit = "50" } = request.query as any;
      const where: any = { status: "ACTIVE" };
      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { customerCode: { contains: q, mode: "insensitive" } }
        ];
      }
      return prisma.customer.findMany({
        where,
        take: parseInt(limit, 10),
        orderBy: { name: "asc" }
      });
    }
  );

  // POST /sales/customers - Register new customer using authorized existing functionality
  fastify.post(
    "/customers",
    sellerPreHandler,
    async (request, reply) => {
      const { name, email, phone, billingAddress, shippingAddress, city, state, postalCode } = request.body as any;
      if (!name || !phone) {
        return reply.status(400).send({ error: "Customer name and phone number are required" });
      }

      // Check duplicate
      const existing = await prisma.customer.findFirst({
        where: {
          OR: [
            ...(email ? [{ email: email.trim().toLowerCase() }] : []),
            { phone: phone.trim() }
          ]
        }
      });
      if (existing) {
        return existing;
      }

      const count = await prisma.customer.count();
      const code = `KY-${String(count + 1).padStart(3, '0')}`;
      const customer = await prisma.customer.create({
        data: {
          customerCode: code,
          name: name.trim(),
          email: email ? email.trim().toLowerCase() : `cust_${Date.now()}@directsale.in`,
          phone: phone.trim(),
          billingAddress: billingAddress || "Direct Storefront Sale",
          shippingAddress: shippingAddress || billingAddress || "Direct Storefront Handover",
          city: city || "Default",
          state: state || "Default",
          country: "India",
          postalCode: postalCode || "000000",
          status: "ACTIVE"
        }
      });
      return customer;
    }
  );

  // GET /sales/history - Sales History
  fastify.get(
    "/history",
    sellerPreHandler,
    async (request, reply) => {
      const { search, page = "1", limit = "25" } = request.query as any;
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const take = parseInt(limit, 10);

      const where: any = {};
      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { paxSerial: { contains: q, mode: "insensitive" } },
          { paxTypeName: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } }
        ];
      }

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where,
          orderBy: { soldAt: "desc" },
          skip,
          take
        }),
        prisma.sale.count({ where })
      ]);

      const vendors = await prisma.vendor.findMany({ select: { id: true, name: true } });
      const vendorMap = new Map(vendors.map(v => [v.id, v.name]));

      const enriched = await Promise.all(sales.map(async (s) => {
        const [soItem, warranty] = await Promise.all([
          prisma.salesOrderItem.findFirst({
            where: {
              salesOrder: {
                reservations: { some: { paxSerial: s.paxSerial } }
              }
            },
            include: {
              salesOrder: {
                include: {
                  customer: true,
                  dispatchOrders: true
                }
              }
            }
          }),
          prisma.warranty.findFirst({
            where: { paxSerial: s.paxSerial },
            orderBy: { createdAt: "desc" }
          })
        ]);

        return {
          saleId: s.saleId,
          paxSerial: s.paxSerial,
          paxTypeName: s.paxTypeName,
          saleType: s.saleType,
          customerName: s.customerName || soItem?.salesOrder?.customer?.name || "Direct Customer",
          vendorName: s.vendorId ? (vendorMap.get(s.vendorId) || null) : null,
          amount: s.amount,
          soldAt: s.soldAt,
          createdAt: s.soldAt,
          salesOrderNumber: soItem?.salesOrder?.salesOrderNumber || null,
          paymentStatus: soItem?.salesOrder?.paymentStatus || "PAID",
          orderStatus: soItem?.salesOrder?.status || "FULFILLED",
          dispatchNumber: soItem?.salesOrder?.dispatchOrders[0]?.dispatchNumber || null,
          dispatchStatus: soItem?.salesOrder?.dispatchOrders[0]?.status || "DELIVERED",
          warrantyNumber: warranty?.warrantyNumber || null,
          warrantyStatus: warranty?.status || "ACTIVE",
          warrantyStartDate: warranty?.warrantyStartDate || null,
          warrantyEndDate: warranty?.warrantyEndDate || null
        };
      }));

      return { sales: enriched, total, page: parseInt(page, 10), limit: take };
    }
  );

  // POST / - Create Finished Goods Sale
  fastify.post(
    "/",
    sellerPreHandler,
    async (request, reply) => {
      const { 
        paxSerial, 
        saleType = "CUSTOMER", 
        vendorId, 
        customerName, 
        customerId,
        amount,
        discount = 0,
        taxRate = 0,
        taxAmount = 0,
        notes
      } = request.body as any;

      if (!paxSerial) {
        return reply.status(400).send({ error: "paxSerial is required" });
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return reply.status(400).send({ error: "Valid selling amount is required" });
      }

      const idempotencyKey = (request.body as any).idempotencyKey || request.headers["x-idempotency-key"] || null;
      const user = request.user as { id: string };

      try {
        const sale = await prisma.$transaction(async (tx) => {
          // 0. Check idempotency
          if (idempotencyKey) {
            const existingSale = await tx.sale.findFirst({
              where: { idempotencyKey }
            });
            if (existingSale) {
              const err = new Error("SALE_ALREADY_PROCESSED");
              (err as any).statusCode = 409;
              throw err;
            }
          }

          // Lock PaxPack row deterministically to prevent concurrent double-sales
          await tx.$executeRawUnsafe(
            `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
            paxSerial
          );

          // Re-read PaxPack after exclusive lock
          const pax = await tx.paxPack.findUnique({
            where: { paxSerial },
            include: { 
              paxType: true,
              packingRecord: true
            }
          });

          if (!pax) {
            throw new Error("PAX not found");
          }

          // Validate status is READY_FOR_SALE
          if (pax.status !== "READY_FOR_SALE") {
            throw new Error(`Cannot sell battery pack. Status is ${pax.status}, expected READY_FOR_SALE.`);
          }

          // Check if already sold
          const existingSaleRecord = await tx.sale.findFirst({
            where: { paxSerial }
          });
          if (existingSaleRecord) {
            const err = new Error("Battery pack has already been sold.");
            (err as any).statusCode = 409;
            throw err;
          }

          // Check active reservation
          const activeReservation = await tx.inventoryReservation.findFirst({
            where: {
              paxSerial: paxSerial,
              status: "RESERVED"
            }
          });
          if (activeReservation) {
            const err = new Error("Cannot complete direct sale: Battery pack is currently reserved for another order.");
            (err as any).statusCode = 409;
            throw err;
          }

          // Check open defects
          const openDefect = await tx.defect.findFirst({
            where: {
              paxSerial,
              status: { in: ["OPEN", "UNDER_REVIEW"] }
            }
          });
          if (openDefect) {
            throw new Error(`Cannot sell battery pack: Open quality defect (${openDefect.defectNumber}) is pending resolution.`);
          }

          // Check packing transfer status if packing record exists
          if (pax.packingRecord && pax.packingRecord.status !== "TRANSFERRED_TO_FINISHED_GOODS" && pax.packingRecord.status !== "PACKED") {
            throw new Error(`Cannot sell battery pack: Packing status is ${pax.packingRecord.status}. Must be officially transferred to Finished Goods warehouse.`);
          }

          // 1. Resolve customer
          const customer = await getOrCreateCustomerForDirectSale(tx, saleType, customerName, vendorId, customerId);

          // 2. Generate sequential numbers
          const soNum = await generateSalesOrderNumber();
          const doNum = await generateDispatchNumber();
          const shipNum = await generateShipmentNumber();
          const pkgNum = await generatePackageNumber();
          const warNum = await generateWarrantyNumber();

          const now = new Date();
          const numericAmount = Number(amount);
          const numericDiscount = Number(discount) || 0;
          const numericTax = Number(taxAmount) || 0;
          const subtotal = Math.max(0, numericAmount - numericTax + numericDiscount);

          // 3. Create SalesOrder
          const salesOrder = await tx.salesOrder.create({
            data: {
              salesOrderNumber: soNum,
              customerId: customer.id,
              createdById: user.id,
              requiredDeliveryDate: now,
              status: "FULFILLED",
              paymentStatus: "PAID",
              subtotal: subtotal,
              discount: numericDiscount,
              tax: numericTax,
              additionalCharges: 0,
              grandTotal: numericAmount,
              paymentTerms: "Immediate",
              deliveryTerms: "Ex-Works",
              billingAddressSnapshot: customer.billingAddress,
              shippingAddressSnapshot: customer.shippingAddress,
              isFinancialCleared: true,
              financialClearedAt: now,
              financialClearedById: user.id,
              internalNotes: notes || "Direct Finished Goods Storefront Handover",
              customerNotes: "Finished Goods Storefront Delivery"
            }
          });

          // 4. Create SalesOrderItem
          const salesOrderItem = await tx.salesOrderItem.create({
            data: {
              salesOrderId: salesOrder.id,
              productRef: pax.paxType.name,
              description: `Finished Goods Battery Pack Model ${pax.paxType.name} (SN: ${paxSerial})`,
              quantityOrdered: 1,
              quantityFulfilled: 1,
              quantityPending: 0,
              unitPrice: pax.paxType.unitPrice || numericAmount,
              discount: numericDiscount,
              taxRate: Number(taxRate) || 0,
              taxAmount: numericTax,
              lineSubtotal: subtotal,
              lineTotal: numericAmount,
              fulfillmentType: "FROM_STOCK"
            }
          });

          // 5. Create InventoryReservation (Marked ISSUED upon handover)
          await tx.inventoryReservation.create({
            data: {
              salesOrderId: salesOrder.id,
              quantity: 1,
              status: "ISSUED",
              paxSerial: paxSerial,
              issuedAt: now
            }
          });

          // 6. Create DispatchOrder
          const dispatchOrder = await tx.dispatchOrder.create({
            data: {
              dispatchNumber: doNum,
              salesOrderId: salesOrder.id,
              customerId: customer.id,
              createdById: user.id,
              dispatchDate: now,
              plannedDispatchDate: now,
              deliveryAddressSnapshot: customer.shippingAddress,
              status: "DELIVERED"
            }
          });

          // 7. Create DispatchItem
          await tx.dispatchItem.create({
            data: {
              dispatchOrderId: dispatchOrder.id,
              salesOrderItemId: salesOrderItem.id,
              productRef: pax.paxType.name,
              quantityOrdered: 1,
              quantityDispatched: 1,
              quantityPicked: 1,
              quantityPacked: 1,
              quantityDelivered: 1,
              paxSerial: paxSerial
            }
          });

          // 8. Create DeliveryPackage
          await tx.deliveryPackage.create({
            data: {
              packageNumber: pkgNum,
              dispatchOrderId: dispatchOrder.id,
              weight: 0,
              dimensions: "0x0x0",
              packageType: "BOX",
              status: "PACKED"
            }
          });

          // 9. Create Shipment
          const shipment = await tx.shipment.create({
            data: {
              shipmentNumber: shipNum,
              dispatchOrderId: dispatchOrder.id,
              carrier: "Storefront Direct Handover",
              shippingMethod: "Storefront Pickup",
              pickupDate: now,
              expectedDeliveryDate: now,
              actualDeliveryDate: now,
              status: "DELIVERED"
            }
          });

          // 10. Create ProofOfDelivery
          await tx.proofOfDelivery.create({
            data: {
              shipmentId: shipment.id,
              recipientName: customer.name,
              recipientContact: customer.phone,
              deliveryNotes: "Direct Finished Goods store handover to customer."
            }
          });

          // 11. Create Warranty (Auto-activated at authorized sales handoff)
          const warrantyStartDate = now;
          const warrantyEndDate = new Date(now);
          warrantyEndDate.setMonth(warrantyEndDate.getMonth() + 12); // Standard 12 months policy

          await tx.warranty.create({
            data: {
              warrantyNumber: warNum,
              customerId: customer.id,
              paxSerial: paxSerial,
              salesOrderId: salesOrder.id,
              deliveryDate: now,
              warrantyStartDate,
              warrantyEndDate,
              warrantyDurationMonths: 12,
              status: "ACTIVE"
            }
          });

          // 12. Traditional Direct Sale entry
          const finalVendorId = (saleType === "VENDOR" && vendorId && vendorId !== "") ? vendorId : null;
          const finalCustomerName = (saleType === "CUSTOMER" && customerName && customerName !== "") ? customerName : customer.name;

          const createdSale = await tx.sale.create({
            data: {
              paxSerial,
              paxTypeName: pax.paxType.name,
              saleType,
              vendorId: finalVendorId,
              customerName: finalCustomerName,
              amount: numericAmount,
              createdBy: user.id,
              idempotencyKey
            }
          });

          // 13. Update Pax status to SOLD
          const newStatus = saleType === "VENDOR" ? "SOLD_TO_VENDOR" : "SOLD_TO_CUSTOMER";
          await tx.paxPack.update({
            where: { paxSerial },
            data: { status: newStatus as any }
          });

          // 14. Stock Ledger movement
          const matchedMat = await tx.material.findFirst({
            where: { sku: pax.paxType.name }
          });
          if (matchedMat) {
            await tx.$executeRawUnsafe(
              `SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`,
              matchedMat.id
            );

            if (matchedMat.quantity < 1) {
              const err = new Error("INSUFFICIENT_STOCK");
              (err as any).statusCode = 400;
              throw err;
            }

            await tx.material.update({
              where: { id: matchedMat.id },
              data: { quantity: matchedMat.quantity - 1 }
            });

            await tx.stockMovement.create({
              data: {
                materialId: matchedMat.id,
                quantity: -1,
                movementType: "ISSUE",
                source: "CUSTOMER_DELIVERY",
                referenceId: doNum,
                userId: user.id,
                reason: `Dispatched to Customer on Finished Goods direct sale DO: ${doNum}`
              }
            });
          }

          // 15. Audit Logs
          await tx.auditLog.create({
            data: {
              entityType: "sales-order",
              entityId: salesOrder.id,
              actorId: user.id,
              action: "SALES_ORDER_FINISHED_GOODS_DIRECT_SALE",
              newStatus: "FULFILLED",
              metadata: { salesOrderNumber: soNum, paxSerial, grandTotal: numericAmount }
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "dispatch-order",
              entityId: dispatchOrder.id,
              actorId: user.id,
              action: "DELIVERED",
              newStatus: "DELIVERED",
              metadata: { dispatchNumber: doNum, paxSerial }
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "warranty",
              entityId: warNum,
              actorId: user.id,
              action: "WARRANTY_ACTIVATED",
              newStatus: "ACTIVE",
              metadata: { warrantyNumber: warNum, paxSerial }
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "pax",
              entityId: paxSerial,
              actorId: user.id,
              action: "PAX_DISPATCHED",
              prevStatus: pax.status,
              newStatus: newStatus,
              metadata: { saleId: createdSale.saleId, amount: numericAmount, customerName: finalCustomerName, vendorId }
            }
          });

          return {
            ...createdSale,
            salesOrderNumber: soNum,
            dispatchNumber: doNum,
            warrantyNumber: warNum
          };
        });

        return sale;
      } catch (err: any) {
        if (err.statusCode === 409) {
          return reply.status(409).send({ error: err.message });
        }
        if (err.message === "PAX not found") {
          return reply.status(404).send({ error: err.message });
        }
        return reply.status(400).send({ error: err.message || "Sale creation failed" });
      }
    }
  );
}

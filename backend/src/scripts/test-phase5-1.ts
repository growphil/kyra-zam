import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { salesRoutes } from "../routes/sales";
import { qualityRoutes } from "../routes/quality";
import { PrismaClient, CellStatus, PaxStatus, ReservationStatus } from "../generated/client";

const prisma = new PrismaClient();

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  await app.register(salesRoutes, { prefix: "/sales" });
  await app.register(qualityRoutes, { prefix: "/crm/quality" });
  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Running Phase 5.1 Hardening integration tests...");
  const app = await buildTestApp();

  // 1. Setup global dependencies (User, Customer, SalesOrder, PaxType, Material)
  let testUser = await prisma.user.findFirst({
    where: { email: "admin@kyrazam.com" }
  });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: "admin@kyrazam.com",
        roles: ["SUPERADMIN", "SALES_EXECUTIVE", "SUPERVISOR"],
        passwordHash: "dummy-hash",
        isActive: true
      }
    });
  }

  const token = app.jwt.sign({
    id: testUser.id,
    roles: testUser.roles as any
  });

  const headers = {
    Authorization: `Bearer ${token}`
  };

  // Create customer
  let customer = await prisma.customer.findFirst({
    where: { email: "phase51test@growphil.com" }
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: "Phase 5.1 Test Customer",
        customerCode: `CUST-P51-${Date.now().toString().slice(-4)}`,
        email: "phase51test@growphil.com",
        phone: "1234567890",
        type: "BUSINESS",
        billingAddress: "Test Billing",
        shippingAddress: "Test Shipping",
        city: "Test City",
        state: "Test State",
        country: "India",
        postalCode: "123456"
      }
    });
  }

  // Create sales order
  const salesOrder = await prisma.salesOrder.create({
    data: {
      salesOrderNumber: `SO-P51-${Date.now().toString().slice(-4)}`,
      customerId: customer.id,
      status: "CONFIRMED",
      isFinancialCleared: true,
      grandTotal: 1000.0,
      subtotal: 1000.0,
      discount: 0.0,
      tax: 0.0,
      additionalCharges: 0.0,
      paymentStatus: "PAID",
      paymentTerms: "Net 30",
      deliveryTerms: "Ex-Works",
      requiredDeliveryDate: new Date(),
      createdById: testUser.id,
      billingAddressSnapshot: "Test Billing",
      shippingAddressSnapshot: "Test Shipping"
    }
  });

  const paxType = await prisma.paxType.create({
    data: {
      name: `Type-P5-1-${Date.now().toString().slice(-4)}`,
      cellCount: 4,
      ahMin: 3.0,
      ahMax: 3.4,
      irMin: 15.0,
      irMax: 22.0,
      maxAhDifference: 0.1,
      maxIrDifference: 2.0,
      allowedGrades: ["A"],
      isProductionActive: true
    }
  });

  const material = await prisma.material.create({
    data: {
      name: "Test Material P5-1",
      category: "RAW_MATERIALS",
      sku: `MAT-P5-1-${Date.now().toString().slice(-4)}`,
      quantity: 100,
      unit: "pcs",
      unitPrice: 10.0,
      totalValue: 1000.0
    }
  });

  // Keep track of created serials for cleanup
  const createdPacks: string[] = [];
  const createdDefects: string[] = [];
  const createdReservations: string[] = [];

  const cleanup = async () => {
    console.log("\n🧹 Cleaning up test records...");
    try {
      // Ensure trigger is dropped if test aborted early
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS temp_fail_pax_update ON "PaxPack";`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS fail_pax_update();`);

      await prisma.auditLog.deleteMany({
        where: { entityId: { in: [...createdPacks, ...createdDefects] } }
      });
      await prisma.sale.deleteMany({
        where: { paxSerial: { in: createdPacks } }
      });
      await prisma.inventoryReservation.deleteMany({
        where: { id: { in: createdReservations } }
      });
      await prisma.defect.deleteMany({
        where: { id: { in: createdDefects } }
      });
      await prisma.paxPack.deleteMany({
        where: { paxSerial: { in: createdPacks } }
      });
      await prisma.paxType.delete({ where: { id: paxType.id } });
      await prisma.salesOrder.delete({ where: { id: salesOrder.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
      await prisma.material.delete({ where: { id: material.id } });
      console.log("✅ Cleanup complete.");
    } catch (e: any) {
      console.error("❌ Cleanup failed:", e.message);
    }
  };

  try {
    // ─────────────────────────────────────────────────────────────
    // TEST 1 — Direct Sale Without Reservation
    // ─────────────────────────────────────────────────────────────
    console.log("\n📦 TEST 1: Direct Sale Without Reservation...");
    const serial1 = `PAX-P5-1-T1-${Date.now()}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: serial1,
        paxTypeId: paxType.id,
        status: PaxStatus.READY_FOR_SALE
      }
    });
    createdPacks.push(serial1);

    const res1 = await app.inject({
      method: "POST",
      url: "/sales/",
      headers,
      payload: {
        paxSerial: serial1,
        saleType: "CUSTOMER",
        customerName: "Test Cust T1",
        amount: 1500.0
      }
    });

    console.log(`Status code: ${res1.statusCode}`);
    if (res1.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${res1.statusCode}: ${res1.payload}`);
    }

    const pack1 = await prisma.paxPack.findUnique({ where: { paxSerial: serial1 } });
    console.log(`Pack Status: ${pack1?.status}`);
    if (pack1?.status !== PaxStatus.SOLD_TO_CUSTOMER) {
      throw new Error(`Expected pack status SOLD_TO_CUSTOMER, got ${pack1?.status}`);
    }
    console.log("✅ PASS: Direct sale without reservation succeeded.");

    // ─────────────────────────────────────────────────────────────
    // TEST 2 — Direct Sale With Active Reservation
    // ─────────────────────────────────────────────────────────────
    console.log("\n📦 TEST 2: Direct Sale With Active Reservation...");
    const serial2 = `PAX-P5-1-T2-${Date.now()}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: serial2,
        paxTypeId: paxType.id,
        status: PaxStatus.READY_FOR_SALE
      }
    });
    createdPacks.push(serial2);

    const resv2 = await prisma.inventoryReservation.create({
      data: {
        paxSerial: serial2,
        status: ReservationStatus.RESERVED,
        quantity: 1,
        materialId: material.id,
        salesOrderId: salesOrder.id
      }
    });
    createdReservations.push(resv2.id);

    const res2 = await app.inject({
      method: "POST",
      url: "/sales/",
      headers,
      payload: {
        paxSerial: serial2,
        saleType: "CUSTOMER",
        customerName: "Test Cust T2",
        amount: 1500.0
      }
    });

    console.log(`Status code: ${res2.statusCode}`);
    if (res2.statusCode !== 409) {
      throw new Error(`Expected status 409, got ${res2.statusCode}: ${res2.payload}`);
    }

    const pack2 = await prisma.paxPack.findUnique({ where: { paxSerial: serial2 } });
    if (pack2?.status !== PaxStatus.READY_FOR_SALE) {
      throw new Error(`Expected pack status to remain READY_FOR_SALE, got ${pack2?.status}`);
    }

    const salesCount2 = await prisma.sale.count({ where: { paxSerial: serial2 } });
    if (salesCount2 > 0) {
      throw new Error("Sale record was created for a reserved pack!");
    }
    console.log("✅ PASS: Direct sale blocked by active reservation.");

    // ─────────────────────────────────────────────────────────────
    // TEST 3 — Historical ISSUED Reservation Does Not Block Sale
    // ─────────────────────────────────────────────────────────────
    console.log("\n📦 TEST 3: Historical ISSUED Reservation Does Not Block Sale...");
    const serial3 = `PAX-P5-1-T3-${Date.now()}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: serial3,
        paxTypeId: paxType.id,
        status: PaxStatus.READY_FOR_SALE
      }
    });
    createdPacks.push(serial3);

    const resv3 = await prisma.inventoryReservation.create({
      data: {
        paxSerial: serial3,
        status: ReservationStatus.ISSUED,
        quantity: 1,
        materialId: material.id,
        salesOrderId: salesOrder.id
      }
    });
    createdReservations.push(resv3.id);

    const res3 = await app.inject({
      method: "POST",
      url: "/sales/",
      headers,
      payload: {
        paxSerial: serial3,
        saleType: "CUSTOMER",
        customerName: "Test Cust T3",
        amount: 1500.0
      }
    });

    console.log(`Status code: ${res3.statusCode}`);
    if (res3.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${res3.statusCode}: ${res3.payload}`);
    }

    const pack3 = await prisma.paxPack.findUnique({ where: { paxSerial: serial3 } });
    if (pack3?.status !== PaxStatus.SOLD_TO_CUSTOMER) {
      throw new Error(`Expected pack status SOLD_TO_CUSTOMER, got ${pack3?.status}`);
    }
    console.log("✅ PASS: ISSUED reservation did not block the sale.");

    // ─────────────────────────────────────────────────────────────
    // TEST 4 — Historical RELEASED Reservation Does Not Block Sale
    // ─────────────────────────────────────────────────────────────
    console.log("\n📦 TEST 4: Historical RELEASED Reservation Does Not Block Sale...");
    const serial4 = `PAX-P5-1-T4-${Date.now()}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: serial4,
        paxTypeId: paxType.id,
        status: PaxStatus.READY_FOR_SALE
      }
    });
    createdPacks.push(serial4);

    const resv4 = await prisma.inventoryReservation.create({
      data: {
        paxSerial: serial4,
        status: ReservationStatus.RELEASED,
        quantity: 1,
        materialId: material.id,
        salesOrderId: salesOrder.id
      }
    });
    createdReservations.push(resv4.id);

    const res4 = await app.inject({
      method: "POST",
      url: "/sales/",
      headers,
      payload: {
        paxSerial: serial4,
        saleType: "CUSTOMER",
        customerName: "Test Cust T4",
        amount: 1500.0
      }
    });

    console.log(`Status code: ${res4.statusCode}`);
    if (res4.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${res4.statusCode}: ${res4.payload}`);
    }

    const pack4 = await prisma.paxPack.findUnique({ where: { paxSerial: serial4 } });
    if (pack4?.status !== PaxStatus.SOLD_TO_CUSTOMER) {
      throw new Error(`Expected pack status SOLD_TO_CUSTOMER, got ${pack4?.status}`);
    }
    console.log("✅ PASS: RELEASED reservation did not block the sale.");

    // ─────────────────────────────────────────────────────────────
    // TEST 5 — Reservation Remains Untouched After Block
    // ─────────────────────────────────────────────────────────────
    console.log("\n📦 TEST 5: Reservation Remains Untouched After Block...");
    const serial5 = `PAX-P5-1-T5-${Date.now()}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: serial5,
        paxTypeId: paxType.id,
        status: PaxStatus.READY_FOR_SALE
      }
    });
    createdPacks.push(serial5);

    const resv5 = await prisma.inventoryReservation.create({
      data: {
        paxSerial: serial5,
        status: ReservationStatus.RESERVED,
        quantity: 5,
        salesOrderId: salesOrder.id,
        materialId: material.id
      }
    });
    createdReservations.push(resv5.id);

    const res5 = await app.inject({
      method: "POST",
      url: "/sales/",
      headers,
      payload: {
        paxSerial: serial5,
        saleType: "CUSTOMER",
        customerName: "Test Cust T5",
        amount: 1500.0
      }
    });

    if (res5.statusCode !== 409) {
      throw new Error(`Expected status 409, got ${res5.statusCode}`);
    }

    const freshResv5 = await prisma.inventoryReservation.findUnique({ where: { id: resv5.id } });
    console.log(`Reservation: status=${freshResv5?.status}, qty=${freshResv5?.quantity}, soId=${freshResv5?.salesOrderId}`);
    if (!freshResv5) throw new Error("Reservation was deleted!");
    if (freshResv5.status !== ReservationStatus.RESERVED) throw new Error("Reservation status changed!");
    if (freshResv5.quantity !== 5) throw new Error("Reservation quantity changed!");
    if (freshResv5.salesOrderId !== salesOrder.id) throw new Error("Reservation salesOrderId changed!");

    const pack5 = await prisma.paxPack.findUnique({ where: { paxSerial: serial5 } });
    if (pack5?.status !== PaxStatus.READY_FOR_SALE) throw new Error("Pax status changed!");
    console.log("✅ PASS: Blocked sale left the reservation untouched.");

    // ─────────────────────────────────────────────────────────────
    // TEST 6 — Concurrent Direct Sale vs Dispatch Reservation
    // ─────────────────────────────────────────────────────────────
    console.log("\n📦 TEST 6: Concurrent Direct Sale vs Dispatch Reservation...");
    const serial6 = `PAX-P5-1-T6-${Date.now()}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: serial6,
        paxTypeId: paxType.id,
        status: PaxStatus.READY_FOR_SALE
      }
    });
    createdPacks.push(serial6);

    // We will trigger both operations concurrently.
    // Operation A: Direct Sale injection
    const opA = app.inject({
      method: "POST",
      url: "/sales/",
      headers,
      payload: {
        paxSerial: serial6,
        saleType: "CUSTOMER",
        customerName: "Test Cust T6 Concurrent",
        amount: 1500.0
      }
    });

    // Operation B: Dispatch reservation mock transaction
    const opB = prisma.$transaction(async (tx) => {
      // 1. Lock PaxPack
      await tx.$executeRawUnsafe(
        `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
        serial6
      );

      // 2. Re-read
      const pack = await tx.paxPack.findUnique({ where: { paxSerial: serial6 } });
      if (!pack || pack.status !== PaxStatus.READY_FOR_SALE) {
        throw new Error("Pack is not READY_FOR_SALE or not found");
      }

      // 3. Create Reservation
      const r = await tx.inventoryReservation.create({
        data: {
          paxSerial: serial6,
          status: ReservationStatus.RESERVED,
          quantity: 1,
          salesOrderId: salesOrder.id
        }
      });
      return r;
    });

    const results = await Promise.allSettled([opA, opB]);

    let opASucceeded = false;
    let opBSucceeded = false;
    let opAFailReason = "";
    let opBFailReason = "";

    if (results[0].status === "fulfilled") {
      const res = results[0].value;
      if (res.statusCode === 200) {
        opASucceeded = true;
      } else {
        opAFailReason = `HTTP ${res.statusCode}: ${res.payload}`;
      }
    } else {
      opAFailReason = results[0].reason.message;
    }

    if (results[1].status === "fulfilled") {
      opBSucceeded = true;
      createdReservations.push(results[1].value.id);
    } else {
      opBFailReason = results[1].reason.message;
    }

    console.log(`Operation A (Direct Sale) Succeeded: ${opASucceeded} (${opAFailReason})`);
    console.log(`Operation B (Reservation) Succeeded: ${opBSucceeded} (${opBFailReason})`);

    if (opASucceeded && opBSucceeded) {
      throw new Error("VULNERABILITY DETECTED: Both concurrent operations succeeded!");
    }
    if (!opASucceeded && !opBSucceeded) {
      throw new Error("Error: Both concurrent operations failed!");
    }
    console.log("✅ PASS: Concurrency serialized safely. Only one succeeded.");

    // ─────────────────────────────────────────────────────────────
    // TEST 7 — Defect starts in OPEN
    // ─────────────────────────────────────────────────────────────
    console.log("\n📦 TEST 7: Defect starts in OPEN...");
    const defect7 = await prisma.defect.create({
      data: {
        defectNumber: `DEF-7-${Date.now().toString().slice(-4)}`,
        defectType: "Voltage Deviation",
        severity: "MEDIUM",
        description: "Test description T7",
        status: "OPEN",
        reportedById: testUser.id
      }
    });
    createdDefects.push(defect7.id);

    const res7 = await app.inject({
      method: "PUT",
      url: `/crm/quality/defects/${defect7.id}/resolve`,
      headers,
      payload: {
        disposition: "REWORK",
        rootCause: "Loose connection T7"
      }
    });

    if (res7.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${res7.statusCode}: ${res7.payload}`);
    }

    const audit7 = await prisma.auditLog.findFirst({
      where: { entityType: "defect", entityId: defect7.id, action: "DEFECT_RESOLVED" }
    });
    console.log(`Audit: prevStatus=${audit7?.prevStatus}, newStatus=${audit7?.newStatus}`);
    if (audit7?.prevStatus !== "OPEN" || audit7?.newStatus !== "RESOLVED") {
      throw new Error(`Audit log state mismatch! Expected OPEN->RESOLVED, got ${audit7?.prevStatus}->${audit7?.newStatus}`);
    }
    console.log("✅ PASS: Audit log captures actual previous status OPEN.");

    // ─────────────────────────────────────────────────────────────
    // TEST 8 — Defect starts in IN_REVIEW
    // ─────────────────────────────────────────────────────────────
    console.log("\n📦 TEST 8: Defect starts in IN_REVIEW...");
    const defect8 = await prisma.defect.create({
      data: {
        defectNumber: `DEF-8-${Date.now().toString().slice(-4)}`,
        defectType: "Thermal Anomaly",
        severity: "HIGH",
        description: "Test description T8",
        status: "IN_REVIEW",
        reportedById: testUser.id
      }
    });
    createdDefects.push(defect8.id);

    const res8 = await app.inject({
      method: "PUT",
      url: `/crm/quality/defects/${defect8.id}/resolve`,
      headers,
      payload: {
        disposition: "REPAIR",
        rootCause: "Defective cell T8"
      }
    });

    if (res8.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${res8.statusCode}`);
    }

    const audit8 = await prisma.auditLog.findFirst({
      where: { entityType: "defect", entityId: defect8.id, action: "DEFECT_RESOLVED" }
    });
    console.log(`Audit: prevStatus=${audit8?.prevStatus}, newStatus=${audit8?.newStatus}`);
    if (audit8?.prevStatus !== "IN_REVIEW" || audit8?.newStatus !== "RESOLVED") {
      throw new Error(`Audit log state mismatch! Expected IN_REVIEW->RESOLVED, got ${audit8?.prevStatus}->${audit8?.newStatus}`);
    }
    console.log("✅ PASS: Audit log captures actual previous status IN_REVIEW.");

    // ─────────────────────────────────────────────────────────────
    // TEST 9 — Defect resolution transaction rollback
    // ─────────────────────────────────────────────────────────────
    console.log("\n📦 TEST 9: Defect resolution transaction rollback...");
    const serial9 = `PAX-P5-1-T9-${Date.now()}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: serial9,
        paxTypeId: paxType.id,
        status: PaxStatus.READY_FOR_SALE
      }
    });
    createdPacks.push(serial9);

    const defect9 = await prisma.defect.create({
      data: {
        defectNumber: `DEF-9-${Date.now().toString().slice(-4)}`,
        defectType: "Connector Failure",
        severity: "LOW",
        description: "Test description T9",
        status: "OPEN",
        paxSerial: serial9,
        reportedById: testUser.id
      }
    });
    createdDefects.push(defect9.id);

    // Create trigger that forces PaxPack update to fail
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION fail_pax_update() RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Simulated PaxPack update failure';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER temp_fail_pax_update
      BEFORE UPDATE ON "PaxPack"
      FOR EACH ROW
      EXECUTE FUNCTION fail_pax_update();
    `);

    const res9 = await app.inject({
      method: "PUT",
      url: `/crm/quality/defects/${defect9.id}/resolve`,
      headers,
      payload: {
        disposition: "REWORK",
        rootCause: "Damaged tab T9"
      }
    });

    console.log(`Status code: ${res9.statusCode}`);
    if (res9.statusCode === 200) {
      throw new Error("Transaction did not fail when database update trigger was active!");
    }

    const freshDefect9 = await prisma.defect.findUnique({ where: { id: defect9.id } });
    console.log(`Defect status after failed transaction: ${freshDefect9?.status}`);
    if (freshDefect9?.status !== "OPEN") {
      throw new Error(`Expected defect status to remain OPEN, got ${freshDefect9?.status}`);
    }

    const audit9Count = await prisma.auditLog.count({
      where: { entityType: "defect", entityId: defect9.id, action: "DEFECT_RESOLVED" }
    });
    if (audit9Count > 0) {
      throw new Error("Audit log was written despite transaction rollback!");
    }
    console.log("✅ PASS: Defect resolution rolled back completely upon failure.");

  } catch (err: any) {
    console.error("\n❌ Test failed with error:", err.message);
    await cleanup();
    process.exit(1);
  }

  await cleanup();
  console.log("\n🎉 ALL PHASE 5.1 HARDENING TESTS PASSED!");
}

runTests()
  .catch(err => {
    console.error("❌ Unexpected test execution failure:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

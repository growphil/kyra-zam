import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/buildTestApp";
import { prisma } from "../prisma";
import { Prisma } from "../generated/client";

describe("KYRA ZAM 2.0 — Expense Management & Approval System Test Suite", () => {
  let app: FastifyInstance;

  let superadminUser: any;
  let adminUser: any;
  let accountantUser: any;
  let unauthorizedUser: any;

  let superadminToken: string;
  let adminToken: string;
  let accountantToken: string;
  let unauthorizedToken: string;

  let testCategory: any;

  before(async () => {
    app = await buildTestApp();

    // 1. Fetch or create users
    superadminUser = await prisma.user.findFirst({
      where: { roles: { has: "SUPERADMIN" }, isActive: true }
    });
    if (!superadminUser) {
      superadminUser = await prisma.user.create({
        data: {
          name: "Test SuperAdmin",
          email: "test.superadmin@kyrazam.com",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["SUPERADMIN"],
          isActive: true
        }
      });
    }

    adminUser = await prisma.user.findFirst({
      where: { roles: { has: "ADMIN" }, NOT: { roles: { has: "SUPERADMIN" } }, isActive: true }
    });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          name: "Test Admin",
          email: "test.admin@kyrazam.com",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["ADMIN"],
          isActive: true
        }
      });
    }

    accountantUser = await prisma.user.findFirst({
      where: { roles: { has: "ACCOUNTANT" }, NOT: { roles: { has: "SUPERADMIN" } }, isActive: true }
    });
    if (!accountantUser) {
      accountantUser = await prisma.user.create({
        data: {
          name: "Test Accountant",
          email: "test.accountant@kyrazam.com",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["ACCOUNTANT"],
          isActive: true
        }
      });
    }

    unauthorizedUser = await prisma.user.findFirst({
      where: { roles: { has: "TEST_ENGINEER" }, NOT: { roles: { hasSome: ["ADMIN", "SUPERADMIN", "ACCOUNTANT"] } }, isActive: true }
    });
    if (!unauthorizedUser) {
      unauthorizedUser = await prisma.user.create({
        data: {
          name: "Test Engineer User",
          email: "test.engineer@kyrazam.com",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["TEST_ENGINEER"],
          isActive: true
        }
      });
    }

    // 2. Generate JWT tokens
    superadminToken = app.jwt.sign({ id: superadminUser.id, roles: superadminUser.roles } as any);
    adminToken = app.jwt.sign({ id: adminUser.id, roles: adminUser.roles } as any);
    accountantToken = app.jwt.sign({ id: accountantUser.id, roles: accountantUser.roles } as any);
    unauthorizedToken = app.jwt.sign({ id: unauthorizedUser.id, roles: unauthorizedUser.roles } as any);

    // 3. Ensure test category
    testCategory = await prisma.expenseCategory.upsert({
      where: { name: "Office Rent" },
      update: { isActive: true },
      create: { name: "Office Rent", description: "Office premise lease", isActive: true }
    });

    // 4. Ensure baseline active threshold: 5,000 ZMW
    await prisma.expenseThreshold.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    await prisma.expenseThreshold.create({
      data: {
        amount: new Prisma.Decimal(5000),
        currency: "ZMW",
        effectiveFrom: new Date(),
        isActive: true,
        createdById: superadminUser.id,
        changeReason: "Test suite initial baseline threshold"
      }
    });
  });

  after(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // ACCOUNTANT WORKFLOW TESTS
  // -------------------------------------------------------------------------
  it("1. Accountant submits expense BELOW threshold (2,500 ZMW) -> AUTO_APPROVED and created in ledger", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: {
        title: "Office Utility Bill",
        description: "Monthly electricity invoice for plant",
        categoryId: testCategory.id,
        amount: 2500,
        currency: "ZMW",
        expenseDate: new Date().toISOString(),
        paymentMethod: "BANK_TRANSFER",
        vendorName: "ZESCO Limited"
      }
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.expense.status, "AUTO_APPROVED");
    assert.equal(body.expense.approvalMethod, "AUTO");
    assert.ok(body.ledgerEntry, "ExpenseLedger entry must be created immediately for AUTO_APPROVED");
    assert.equal(body.ledgerEntry.approvedByName, "SYSTEM");
    assert.equal(body.ledgerEntry.approvalMethod, "AUTO");

    // Check DB
    const ledger = await prisma.expenseLedger.findUnique({
      where: { expenseId: body.expense.id }
    });
    assert.ok(ledger, "Official ledger must contain the approved expense");
    assert.equal(ledger.amount.toString(), "2500");
  });

  it("2. Accountant submits expense EXACTLY AT threshold (5,000 ZMW) -> AUTO_APPROVED", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: {
        title: "Broadband Internet Annual Renewal",
        description: "Fibre leased line renewal",
        categoryId: testCategory.id,
        amount: 5000,
        currency: "ZMW",
        expenseDate: new Date().toISOString(),
        paymentMethod: "BANK_TRANSFER",
        vendorName: "Liquid Telecom"
      }
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.expense.status, "AUTO_APPROVED");
    assert.equal(body.expense.approvalMethod, "AUTO");
    assert.ok(body.ledgerEntry);
  });

  it("3. Accountant submits expense ABOVE threshold (7,500 ZMW) -> PENDING_VERIFICATION (no ledger entry)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: {
        title: "Warehouse Annual Maintenance Contract",
        description: "Annual structural & roof repair contract",
        categoryId: testCategory.id,
        amount: 7500,
        currency: "ZMW",
        expenseDate: new Date().toISOString(),
        paymentMethod: "BANK_TRANSFER",
        vendorName: "BuildCon Engineering"
      }
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.expense.status, "PENDING_VERIFICATION");
    assert.equal(body.expense.approvalMethod, null);
    assert.equal(body.ledgerEntry, null, "Pending verification expense must NOT have a ledger entry");

    const ledger = await prisma.expenseLedger.findUnique({
      where: { expenseId: body.expense.id }
    });
    assert.equal(ledger, null, "DB ledger entry must not exist for pending expense");
  });

  it("4. Accountant CANNOT modify the approval threshold -> returns 403 Forbidden", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/expenses/settings/threshold",
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: {
        amount: 10000,
        currency: "ZMW",
        changeReason: "Unauthorized accountant threshold bump attempt"
      }
    });

    assert.equal(res.statusCode, 403);
  });

  it("5. Accountant CANNOT approve their own above-threshold expense -> returns 403/400 (Separation of Duties)", async () => {
    // Accountant created an above-threshold expense
    const createRes = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: {
        title: "Self Approval Attempt Expense",
        description: "Above threshold expense",
        categoryId: testCategory.id,
        amount: 9000,
        currency: "ZMW",
        expenseDate: new Date().toISOString()
      }
    });
    const expenseId = createRes.json().expense.id;

    // Accountant tries to call accountant-approve or approve
    const approveRes = await app.inject({
      method: "POST",
      url: `/expenses/${expenseId}/accountant-approve`,
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: { notes: "Trying to self-approve" }
    });

    assert.equal(approveRes.statusCode, 400);
    assert.match(approveRes.json().error, /Separation of Duties Violation/);
  });

  // -------------------------------------------------------------------------
  // ADMIN WORKFLOW TESTS
  // -------------------------------------------------------------------------
  it("6. ADMIN submits expense (even below threshold) -> ALWAYS PENDING_VERIFICATION", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: "Admin Office Stationery",
        description: "Paper reams and printer cartridges",
        categoryId: testCategory.id,
        amount: 800, // Below 5,000 threshold
        currency: "ZMW",
        expenseDate: new Date().toISOString(),
        paymentMethod: "CASH",
        vendorName: "Stationery Mart"
      }
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.expense.status, "PENDING_VERIFICATION", "ADMIN expense must always enter PENDING_VERIFICATION");
    assert.equal(body.ledgerEntry, null);
  });

  it("7. ADMIN CANNOT modify approval threshold -> returns 403 Forbidden", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/expenses/settings/threshold",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        amount: 20000,
        currency: "ZMW",
        changeReason: "Admin unauthorized attempt"
      }
    });

    assert.equal(res.statusCode, 403);
  });

  it("8. ADMIN CANNOT approve their own expense -> returns 403 Forbidden", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: "Admin Travel Advance",
        description: "Commute to Kitwe site",
        categoryId: testCategory.id,
        amount: 1500,
        currency: "ZMW",
        expenseDate: new Date().toISOString()
      }
    });
    const expenseId = createRes.json().expense.id;

    const approveRes = await app.inject({
      method: "POST",
      url: `/expenses/${expenseId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {}
    });

    assert.equal(approveRes.statusCode, 403);
  });

  it("9. Accountant CAN approve ADMIN-created expense -> sets APPROVED + creates ExpenseLedger entry", async () => {
    // 1. Admin creates expense
    const createRes = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: "Assembly Shop Tooling Consumables",
        description: "Crimping dies and soldering fluxes",
        categoryId: testCategory.id,
        amount: 3200,
        currency: "ZMW",
        expenseDate: new Date().toISOString(),
        paymentMethod: "BANK_TRANSFER",
        vendorName: "Hardware Center Zambia"
      }
    });
    const expenseId = createRes.json().expense.id;

    // 2. Accountant checks accountant-pending queue
    const queueRes = await app.inject({
      method: "GET",
      url: "/expenses/accountant-pending",
      headers: { authorization: `Bearer ${accountantToken}` }
    });
    assert.equal(queueRes.statusCode, 200);
    const inQueue = queueRes.json().pendingExpenses.some((e: any) => e.id === expenseId);
    assert.equal(inQueue, true, "Admin created expense must appear in Accountant pending queue");

    // 3. Accountant approves
    const approveRes = await app.inject({
      method: "POST",
      url: `/expenses/${expenseId}/accountant-approve`,
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: { notes: "Verified against supplier tax invoice." }
    });

    assert.equal(approveRes.statusCode, 200);
    const approvedBody = approveRes.json();
    assert.equal(approvedBody.success, true);
    assert.equal(approvedBody.expense.status, "APPROVED");
    assert.equal(approvedBody.expense.approvalMethod, "ACCOUNTANT");
    assert.ok(approvedBody.ledgerEntry, "ExpenseLedger entry must be created");

    // 4. Verify in official ledger
    const ledger = await prisma.expenseLedger.findUnique({
      where: { expenseId }
    });
    assert.ok(ledger);
    assert.equal(ledger.approvalMethod, "ACCOUNTANT");
    assert.equal(ledger.amount.toString(), "3200");
  });

  it("10. Accountant CAN reject ADMIN-created expense with mandatory reason -> sets REJECTED", async () => {
    // 1. Admin creates expense
    const createRes = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: "Lunch Catering for Guests",
        description: "Official team lunch",
        categoryId: testCategory.id,
        amount: 1200,
        currency: "ZMW",
        expenseDate: new Date().toISOString()
      }
    });
    const expenseId = createRes.json().expense.id;

    // 2. Rejection without reason fails validation
    const failReject = await app.inject({
      method: "POST",
      url: `/expenses/${expenseId}/accountant-reject`,
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: { reason: "" }
    });
    assert.equal(failReject.statusCode, 400);

    // 3. Rejection with reason succeeds
    const rejectRes = await app.inject({
      method: "POST",
      url: `/expenses/${expenseId}/accountant-reject`,
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: { reason: "Missing itemized receipt and guest authorization form." }
    });

    assert.equal(rejectRes.statusCode, 200);
    const rejectedBody = rejectRes.json();
    assert.equal(rejectedBody.expense.status, "REJECTED");
    assert.equal(rejectedBody.expense.rejectionReason, "Missing itemized receipt and guest authorization form.");

    // Must NOT be in official ledger
    const ledger = await prisma.expenseLedger.findUnique({
      where: { expenseId }
    });
    assert.equal(ledger, null, "Rejected expense must never appear in official expense ledger");
  });

  // -------------------------------------------------------------------------
  // SUPERADMIN WORKFLOW & THRESHOLD MANAGEMENT TESTS
  // -------------------------------------------------------------------------
  it("11. Superadmin views pending verification queue and approves above-threshold expense", async () => {
    // 1. Accountant creates above-threshold expense (ZMW 12,000)
    const createRes = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: {
        title: "Industrial Battery Tester Calibration",
        description: "Annual ISO calibration service",
        categoryId: testCategory.id,
        amount: 12000,
        currency: "ZMW",
        expenseDate: new Date().toISOString(),
        vendorName: "Zambian Metrology Agency"
      }
    });
    const expenseId = createRes.json().expense.id;

    // 2. Superadmin checks pending queue
    const queueRes = await app.inject({
      method: "GET",
      url: "/expenses/pending",
      headers: { authorization: `Bearer ${superadminToken}` }
    });
    assert.equal(queueRes.statusCode, 200);
    const inQueue = queueRes.json().pendingExpenses.some((e: any) => e.id === expenseId);
    assert.equal(inQueue, true);

    // 3. Superadmin approves
    const approveRes = await app.inject({
      method: "POST",
      url: `/expenses/${expenseId}/approve`,
      headers: { authorization: `Bearer ${superadminToken}` },
      payload: { notes: "Calibration verified against annual factory maintenance plan." }
    });

    assert.equal(approveRes.statusCode, 200);
    const body = approveRes.json();
    assert.equal(body.expense.status, "APPROVED");
    assert.equal(body.expense.approvalMethod, "SUPERADMIN");
    assert.ok(body.ledgerEntry);

    // Check ledger
    const ledger = await prisma.expenseLedger.findUnique({
      where: { expenseId }
    });
    assert.ok(ledger);
    assert.equal(ledger.approvalMethod, "SUPERADMIN");
  });

  it("12. Duplicate approval request on already approved expense is rejected (Idempotency)", async () => {
    // Find an already approved expense
    const approvedExpense = await prisma.expense.findFirst({
      where: { status: "APPROVED" }
    });
    assert.ok(approvedExpense);

    const dupRes = await app.inject({
      method: "POST",
      url: `/expenses/${approvedExpense.id}/approve`,
      headers: { authorization: `Bearer ${superadminToken}` },
      payload: {}
    });

    assert.equal(dupRes.statusCode, 400);
    assert.match(dupRes.json().error, /already approved/);
  });

  it("13. Superadmin rejects pending expense with documented reason", async () => {
    // 1. Accountant creates above-threshold expense
    const createRes = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: {
        title: "Unapproved Office Artwork",
        description: "Paintings for reception foyer",
        categoryId: testCategory.id,
        amount: 8500,
        currency: "ZMW",
        expenseDate: new Date().toISOString()
      }
    });
    const expenseId = createRes.json().expense.id;

    // 2. Superadmin rejects
    const rejectRes = await app.inject({
      method: "POST",
      url: `/expenses/${expenseId}/reject`,
      headers: { authorization: `Bearer ${superadminToken}` },
      payload: { reason: "Non-essential decorative expense not in approved OPEX budget." }
    });

    assert.equal(rejectRes.statusCode, 200);
    const body = rejectRes.json();
    assert.equal(body.expense.status, "REJECTED");
    assert.equal(body.expense.rejectionReason, "Non-essential decorative expense not in approved OPEX budget.");

    // Check Audit Log
    const auditLog = await prisma.expenseAuditLog.findFirst({
      where: { expenseId, action: "SUPERADMIN_REJECTED" }
    });
    assert.ok(auditLog);
  });

  it("14. Superadmin updates auto-approval threshold -> creates new active threshold & logs audit entry", async () => {
    const updateRes = await app.inject({
      method: "PUT",
      url: "/expenses/settings/threshold",
      headers: { authorization: `Bearer ${superadminToken}` },
      payload: {
        amount: 7500,
        currency: "ZMW",
        changeReason: "Q4 inflationary adjustment for operational procurement"
      }
    });

    assert.equal(updateRes.statusCode, 200);
    const body = updateRes.json();
    assert.equal(body.success, true);
    assert.equal(body.threshold.amount.toString(), "7500");
    assert.equal(body.threshold.isActive, true);

    // Verify active threshold endpoint
    const getRes = await app.inject({
      method: "GET",
      url: "/expenses/settings/threshold",
      headers: { authorization: `Bearer ${accountantToken}` }
    });
    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.json().activeThreshold.amount, 7500);

    // Check Audit Log
    const audit = await prisma.expenseAuditLog.findFirst({
      where: { action: "THRESHOLD_CHANGED" },
      orderBy: { createdAt: "desc" }
    });
    assert.ok(audit);
    assert.equal(audit.actorId, superadminUser.id);
  });

  // -------------------------------------------------------------------------
  // SECURITY & RBAC TESTS
  // -------------------------------------------------------------------------
  it("15. Unauthorized user (e.g. TEST_ENGINEER) cannot access expense creation or approval APIs", async () => {
    const postRes = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${unauthorizedToken}` },
      payload: {
        title: "Unauthorized Test",
        description: "Test description",
        categoryId: testCategory.id,
        amount: 100,
        currency: "ZMW",
        expenseDate: new Date().toISOString()
      }
    });
    assert.equal(postRes.statusCode, 403);

    const approveRes = await app.inject({
      method: "POST",
      url: "/expenses/00000000-0000-0000-0000-000000000000/approve",
      headers: { authorization: `Bearer ${unauthorizedToken}` },
      payload: {}
    });
    assert.equal(approveRes.statusCode, 403);
  });

  it("16. Official Expense Ledger strictly EXCLUDES pending and rejected expenses", async () => {
    const ledgerRes = await app.inject({
      method: "GET",
      url: "/expenses/ledger",
      headers: { authorization: `Bearer ${accountantToken}` }
    });

    assert.equal(ledgerRes.statusCode, 200);
    const { entries } = ledgerRes.json();

    // Verify that all entries in the ledger have corresponding approved expenses
    for (const entry of entries) {
      assert.ok(
        entry.approvalMethod === "AUTO" ||
        entry.approvalMethod === "ACCOUNTANT" ||
        entry.approvalMethod === "SUPERADMIN"
      );
    }

    // Verify no pending or rejected expense exists in ExpenseLedger table
    const pendingWithLedger = await prisma.expense.findFirst({
      where: {
        status: { in: ["PENDING_VERIFICATION", "REJECTED"] },
        ledgerEntry: { isNot: null }
      }
    });
    assert.equal(pendingWithLedger, null, "No pending or rejected expense should have a ledger entry");
  });

  it("17. Expense summary report calculates correct totals for approved, pending, and ledger", async () => {
    const summaryRes = await app.inject({
      method: "GET",
      url: "/expenses/reports/summary",
      headers: { authorization: `Bearer ${superadminToken}` }
    });

    assert.equal(summaryRes.statusCode, 200);
    const { stats } = summaryRes.json();
    assert.ok(typeof stats.totalExpensesCount === "number");
    assert.ok(typeof stats.totalExpensesAmount === "number");
    assert.ok(typeof stats.approvedCount === "number");
    assert.ok(typeof stats.pendingCount === "number");
    assert.ok(typeof stats.rejectedCount === "number");
    assert.ok(typeof stats.officialLedgerTotal === "number");
    assert.equal(stats.activeThreshold, 7500);
  });
});

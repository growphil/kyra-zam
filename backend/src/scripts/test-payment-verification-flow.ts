import axios from "axios";
import { prisma } from "../prisma";

const BASE_URL = process.env.API_URL || "http://localhost:8000";

async function runPaymentVerificationFlowTest() {
  console.log("================================================================================");
  console.log("TESTING PAYMENT SUBMISSION + ACCOUNTANT VERIFICATION + FINANCIAL CLEARANCE FLOW");
  console.log("================================================================================\n");

  try {
    // 1. Marketing Manager Login
    const mmLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: "marketing@kyrazam.com",
      password: "Marketing@2025"
    });
    const mmToken = mmLogin.data.accessToken;
    console.log("✓ Marketing Manager Logged in:", mmLogin.data.user.name);

    // 2. Sales Executive Login
    const seLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: "sales@kyrazam.com",
      password: "SalesExec@2025"
    });
    const seToken = seLogin.data.accessToken;
    console.log("✓ Sales Executive Logged in:", seLogin.data.user.name);

    // 3. Accountant Login
    const accLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: "acct@kyrazam.com",
      password: "Accountant@2025"
    });
    const accToken = accLogin.data.accessToken;
    console.log("✓ Accountant Logged in:", accLogin.data.user.name);

    // 4. Supervisor Login
    const supLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: "super@kyrazam.com",
      password: "Supervisor@2025"
    });
    const supToken = supLogin.data.accessToken;
    console.log("✓ Supervisor Logged in:", supLogin.data.user.name);

    // 5. Fetch Customer & Material
    const custRes = await axios.get(`${BASE_URL}/crm/customers?limit=1`, {
      headers: { Authorization: `Bearer ${mmToken}` }
    });
    const customer = custRes.data.customers?.[0];
    if (!customer) throw new Error("No customer found");

    console.log(`✓ Test Customer: ${customer.name}`);

    // Step 1: MM Creates Quotation
    console.log("\n[Step 1] Marketing Manager creates quotation & submits for approval...");
    const qRes = await axios.post(
      `${BASE_URL}/crm/quotations`,
      {
        customerId: customer.id,
        validUntil: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        paymentTerms: "100% Advance",
        deliveryTerms: "Ex-Works Factory",
        additionalCharges: 14000,
        items: [
          {
            description: "High Capacity Industrial Battery 250k",
            quantity: 2,
            unitPrice: 100000,
            discount: 0,
            taxRate: 18,
            notes: "Production order"
          }
        ]
      },
      { headers: { Authorization: `Bearer ${mmToken}` } }
    );
    const quotation = qRes.data;
    console.log(`✓ Quotation Created: ${quotation.quotationNumber}, Status: ${quotation.status}, Grand Total: ₹${quotation.grandTotal}`);

    // Step 2: Sales Executive Approves Quotation
    console.log("\n[Step 2] Sales Executive reviews & approves quotation...");
    const approveRes = await axios.put(
      `${BASE_URL}/crm/quotations/${quotation.id}/approve`,
      { comments: "Approved for full test flow" },
      { headers: { Authorization: `Bearer ${seToken}` } }
    );
    console.log(`✓ Quotation Approved: Status=${approveRes.data.status}`);

    // Step 3: Send & Customer Accepts Quotation
    console.log("\n[Step 3] Send quotation & record Customer Acceptance...");
    await axios.put(
      `${BASE_URL}/crm/quotations/${quotation.id}/send`,
      {},
      { headers: { Authorization: `Bearer ${mmToken}` } }
    );
    console.log("✓ Quotation marked as SENT to customer");

    const acceptRes = await axios.put(
      `${BASE_URL}/crm/quotations/${quotation.id}/accept`,
      { comments: "Customer accepted via formal PO" },
      { headers: { Authorization: `Bearer ${mmToken}` } }
    );
    console.log(`✓ Quotation Accepted: Status=${acceptRes.data.status}`);

    // Step 4: Convert Quotation to Sales Order
    console.log("\n[Step 4] Convert Quotation to Sales Order...");
    const convRes = await axios.post(
      `${BASE_URL}/crm/sales-orders/convert/${quotation.id}`,
      {
        requiredDeliveryDate: new Date(Date.now() + 20 * 86400000).toISOString(),
        priority: "HIGH"
      },
      { headers: { Authorization: `Bearer ${mmToken}` } }
    );
    const salesOrder = convRes.data;
    console.log(`✓ Sales Order Created: ${salesOrder.salesOrderNumber}`);
    console.log(`  Initial isFinancialCleared: ${salesOrder.isFinancialCleared}`);
    console.log(`  Initial paymentStatus: ${salesOrder.paymentStatus}`);

    // Order is automatically CONFIRMED and ready for payments upon conversion!
    const soFull = (await axios.get(`${BASE_URL}/crm/sales-orders/${salesOrder.id}`, {
      headers: { Authorization: `Bearer ${mmToken}` }
    })).data;

    // Step 5: Production Financial Clearance Gate Test
    console.log("\n[Step 5] Verify Production Gate blocks requirement creation before clearance...");
    const soItem = soFull.items[0];
    try {
      await axios.post(
        `${BASE_URL}/crm/production/requirements`,
        {
          salesOrderId: salesOrder.id,
          salesOrderItemId: soItem.id,
          customerId: customer.id,
          requiredQuantity: 2,
          requiredDeliveryDate: new Date(Date.now() + 10 * 86400000).toISOString(),
          priority: "HIGH"
        },
        { headers: { Authorization: `Bearer ${supToken}` } }
      );
      throw new Error("Production gate failed to block uncleared order!");
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.error?.toLowerCase().includes("financial")) {
        console.log("✓ Production Gate successfully BLOCKED uncleared order with 400 Bad Request");
      } else {
        throw err;
      }
    }

    // Step 6: Marketing Manager Records Partial Payment 1 (₹100,000)
    console.log("\n[Step 6] Marketing Manager records Partial Payment 1 (₹100,000 of ₹250,000)...");
    const pay1Res = await axios.post(
      `${BASE_URL}/crm/finance/payments`,
      {
        salesOrderId: salesOrder.id,
        amount: 100000,
        paymentMethod: "BANK_TRANSFER",
        referenceNumber: "NEFT-TRX-100K",
        bankDetails: "HDFC Current A/c",
        paymentProofUrl: "/public/uploads/payments/sample-proof.png",
        notes: "40% advance milestone"
      },
      { headers: { Authorization: `Bearer ${mmToken}` } }
    );
    const pay1 = pay1Res.data;
    console.log(`✓ Payment 1 Recorded: ${pay1.paymentReference}, Status: ${pay1.status}`);

    if (pay1.status !== "PENDING_VERIFICATION") {
      throw new Error(`Expected PENDING_VERIFICATION, got ${pay1.status}`);
    }

    // Step 7: RBAC Test - Marketing Manager cannot verify
    console.log("\n[Step 7] Testing RBAC: Marketing Manager attempting to verify payment...");
    try {
      await axios.put(
        `${BASE_URL}/crm/finance/payments/${pay1.id}/verify`,
        {},
        { headers: { Authorization: `Bearer ${mmToken}` } }
      );
      throw new Error("RBAC vulnerability: Marketing Manager verified payment!");
    } catch (err: any) {
      if (err.response?.status === 403) {
        console.log("✓ RBAC Enforced: Marketing Manager received 403 Forbidden");
      } else {
        throw err;
      }
    }

    // Step 8: Accountant Accepts & Verifies Payment 1
    console.log("\n[Step 8] Accountant reviews & accepts Payment 1...");
    const verify1Res = await axios.put(
      `${BASE_URL}/crm/finance/payments/${pay1.id}/verify`,
      {},
      { headers: { Authorization: `Bearer ${accToken}` } }
    );
    console.log(`✓ Payment 1 Verified: Status=${verify1Res.data.status}, VerifiedBy=${verify1Res.data.verifiedById}`);

    // Check SO state after Payment 1
    const soAfter1 = (await axios.get(`${BASE_URL}/crm/sales-orders/${salesOrder.id}`, {
      headers: { Authorization: `Bearer ${mmToken}` }
    })).data;
    console.log(`  Sales Order state: PaymentStatus=${soAfter1.paymentStatus}, isFinancialCleared=${soAfter1.isFinancialCleared}`);
    if (soAfter1.isFinancialCleared !== false || soAfter1.paymentStatus !== "PARTIALLY_PAID") {
      throw new Error(`State error after partial payment: ${JSON.stringify(soAfter1)}`);
    }

    // Step 9: Marketing Manager records Payment 2 with wrong details
    console.log("\n[Step 9] Marketing Manager records Payment 2 (₹150,000) with invalid details...");
    const pay2Res = await axios.post(
      `${BASE_URL}/crm/finance/payments`,
      {
        salesOrderId: salesOrder.id,
        amount: 150000,
        paymentMethod: "CHEQUE",
        referenceNumber: "CHQ-INVALID-REF",
        notes: "Invalid check slip"
      },
      { headers: { Authorization: `Bearer ${mmToken}` } }
    );
    const pay2 = pay2Res.data;
    console.log(`✓ Payment 2 Recorded: ${pay2.paymentReference}, Status: ${pay2.status}`);

    // Step 10: Accountant Rejects Payment 2
    console.log("\n[Step 10] Accountant reviews & rejects Payment 2 with reason...");
    const rejectRes = await axios.put(
      `${BASE_URL}/crm/finance/payments/${pay2.id}/reject`,
      { reason: "Cheque bounce / scan signature unreadable" },
      { headers: { Authorization: `Bearer ${accToken}` } }
    );
    console.log(`✓ Payment 2 REJECTED: Status=${rejectRes.data.status}, Reason=${rejectRes.data.rejectionReason}`);

    // Step 11: Overpayment Protection Test
    console.log("\n[Step 11] Testing Overpayment Protection (attempting to pay ₹200,000 against ₹150,000 remaining)...");
    try {
      await axios.post(
        `${BASE_URL}/crm/finance/payments`,
        {
          salesOrderId: salesOrder.id,
          amount: 200000,
          paymentMethod: "UPI"
        },
        { headers: { Authorization: `Bearer ${mmToken}` } }
      );
      throw new Error("Overpayment protection failed!");
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.error?.includes("exceeds remaining")) {
        console.log(`✓ Overpayment prevented: ${err.response.data.error}`);
      } else {
        throw err;
      }
    }

    // Step 12: Marketing Manager submits corrected Final Payment 3 (₹150,000)
    console.log("\n[Step 12] Marketing Manager submits corrected Final Payment 3 (₹150,000)...");
    const pay3Res = await axios.post(
      `${BASE_URL}/crm/finance/payments`,
      {
        salesOrderId: salesOrder.id,
        amount: 150000,
        paymentMethod: "UPI",
        referenceNumber: "UPI-CLEARED-CORRECTED-150K",
        bankDetails: "HDFC UPI QR",
        paymentProofUrl: "/public/uploads/payments/final-cleared.png",
        notes: "Full clearance payment"
      },
      { headers: { Authorization: `Bearer ${mmToken}` } }
    );
    const pay3 = pay3Res.data;
    console.log(`✓ Payment 3 Recorded: ${pay3.paymentReference}`);

    // Step 13: Accountant Accepts Final Payment 3 -> Triggers Financial Clearance!
    console.log("\n[Step 13] Accountant verifies Final Payment 3...");
    const verify3Res = await axios.put(
      `${BASE_URL}/crm/finance/payments/${pay3.id}/verify`,
      {},
      { headers: { Authorization: `Bearer ${accToken}` } }
    );
    console.log(`✓ Payment 3 Verified by Accountant!`);

    // Step 14: Double Verification Concurrency Test
    console.log("\n[Step 14] Testing Concurrency / Double Verification protection...");
    try {
      await axios.put(
        `${BASE_URL}/crm/finance/payments/${pay3.id}/verify`,
        {},
        { headers: { Authorization: `Bearer ${accToken}` } }
      );
      throw new Error("Double verification allowed!");
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.error?.includes("already been verified")) {
        console.log("✓ Double verification blocked with 400 'Payment has already been verified.'");
      } else {
        throw err;
      }
    }

    // Step 15: Check Final Sales Order State
    console.log("\n[Step 15] Checking Final Sales Order Financial Clearance...");
    const soFinal = (await axios.get(`${BASE_URL}/crm/sales-orders/${salesOrder.id}`, {
      headers: { Authorization: `Bearer ${mmToken}` }
    })).data;

    console.log(`  Sales Order Final State:
    Payment Status: ${soFinal.paymentStatus}
    isFinancialCleared: ${soFinal.isFinancialCleared}
    financialClearedById: ${soFinal.financialClearedById}
    financialClearedAt: ${soFinal.financialClearedAt}
    Recorded Payments: ${soFinal.payments?.length}
    `);

    if (soFinal.isFinancialCleared !== true || soFinal.paymentStatus !== "PAID") {
      throw new Error("Sales Order was not financially cleared after full payment!");
    }
    console.log("✓ Sales Order is officially FINANCIALLY CLEARED!");

    // Step 16: Verify Production Gate Unlocked
    console.log("\n[Step 16] Verifying Production Gate is now UNLOCKED...");
    const prodRes = await axios.post(
      `${BASE_URL}/crm/production/requirements`,
      {
        salesOrderId: salesOrder.id,
        salesOrderItemId: soItem.id,
        customerId: customer.id,
        requiredQuantity: 2,
        requiredDeliveryDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        priority: "HIGH"
      },
      { headers: { Authorization: `Bearer ${supToken}` } }
    );
    console.log(`✓ Production Requirement Spawned Successfully: ${prodRes.data.requirementNumber}`);

    // Step 17: Verify Audit Trail
    console.log("\n[Step 17] Verifying Audit Trail in database...");
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: pay1.id },
          { entityId: pay2.id },
          { entityId: pay3.id },
          { entityId: salesOrder.id }
        ]
      },
      orderBy: { timestamp: "asc" }
    });

    const actions = auditLogs.map(a => a.action);
    console.log(`  Logged Actions: ${actions.join(" -> ")}`);
    if (!actions.includes("PAYMENT_SUBMITTED") || !actions.includes("PAYMENT_VERIFIED") || !actions.includes("PAYMENT_REJECTED") || !actions.includes("FINANCIAL_CLEARANCE_GRANTED")) {
      throw new Error("Audit log missing required action types!");
    }
    console.log("✓ All Audit events (PAYMENT_SUBMITTED, PAYMENT_VERIFIED, PAYMENT_REJECTED, FINANCIAL_CLEARANCE_GRANTED) verified!");

    console.log("\n================================================================================");
    console.log("🎉 ALL 17 AUTOMATED TESTS PASSED SUCCESSFULLY! WORKFLOW IS 100% VERIFIED!");
    console.log("================================================================================\n");

  } catch (err: any) {
    console.error("❌ Test failed:", err.response?.data || err.message || err);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

runPaymentVerificationFlowTest();

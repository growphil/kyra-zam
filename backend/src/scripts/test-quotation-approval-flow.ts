import axios from "axios";

const API_BASE = process.env.API_URL || "http://localhost:8000";

async function runTests() {
  console.log("==================================================");
  console.log("STARTING QUOTATION APPROVAL & VIEW/SHARE FLOW TEST");
  console.log("==================================================");

  // 1. Authenticate Marketing Manager
  console.log("\n[1] Logging in as Marketing Manager...");
  const mmLogin = await axios.post(`${API_BASE}/auth/login`, {
    email: "marketing@kyrazam.com",
    password: "Marketing@2025"
  });
  const mmToken = mmLogin.data.accessToken;
  console.log("✓ Marketing Manager logged in. User:", mmLogin.data.user.name);

  // 2. Authenticate Sales Executive
  console.log("\n[2] Logging in as Sales Executive...");
  const seLogin = await axios.post(`${API_BASE}/auth/login`, {
    email: "sales@kyrazam.com",
    password: "SalesExec@2025"
  });
  const seToken = seLogin.data.accessToken;
  console.log("✓ Sales Executive logged in. User:", seLogin.data.user.name);

  // 3. Fetch an active customer
  console.log("\n[3] Fetching a test customer...");
  const custRes = await axios.get(`${API_BASE}/crm/customers?limit=1`, {
    headers: { Authorization: `Bearer ${mmToken}` }
  });
  const customer = custRes.data.customers?.[0];
  if (!customer) {
    throw new Error("No customer found for testing!");
  }
  console.log(`✓ Using Customer: ${customer.name} (${customer.customerCode || customer.id})`);

  // 4. Marketing Manager Creates Quotation
  console.log("\n[4] Marketing Manager creating quotation...");
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const validUntilStr = futureDate.toISOString().split("T")[0];

  const createPayload = {
    customerId: customer.id,
    validUntil: validUntilStr,
    currency: "INR",
    freight: 1500,
    additionalCharges: 500,
    paymentTerms: "50% Advance / 50% Before Dispatch",
    deliveryTerms: "Delivery within 10 business days after PO",
    notes: "Quotation approval workflow test note",
    items: [
      {
        description: "Industrial Lithium Battery Pack 48V 100Ah",
        quantity: 2,
        unitPrice: 45000,
        discount: 5,
        taxRate: 18,
        specification: "Grade A+ Cylindrical Cells",
        notes: "Heavy duty enclosure"
      }
    ]
  };

  const createRes = await axios.post(`${API_BASE}/crm/quotations`, createPayload, {
    headers: { Authorization: `Bearer ${mmToken}` }
  });
  const quotation = createRes.data;
  console.log(`✓ Quotation Created: ${quotation.quotationNumber} (ID: ${quotation.id})`);
  console.log(`✓ Quotation Status: ${quotation.status}`);

  if (quotation.status !== "PENDING_APPROVAL") {
    throw new Error(`Expected initial status to be PENDING_APPROVAL (WAITING_FOR_APPROVAL), got: ${quotation.status}`);
  }
  console.log("✓ Initial status is confirmed WAITING_FOR_APPROVAL (PENDING_APPROVAL)");

  // 5. Verify Marketing Manager CANNOT approve quotation
  console.log("\n[5] Testing RBAC Security: Marketing Manager attempting to approve quotation...");
  try {
    await axios.put(`${API_BASE}/crm/quotations/${quotation.id}/approve`, {
      comments: "Unauthorized approval attempt"
    }, {
      headers: { Authorization: `Bearer ${mmToken}` }
    });
    throw new Error("SECURITY FAILURE: Marketing Manager was able to approve quotation!");
  } catch (err: any) {
    if (err.response && err.response.status === 403) {
      console.log("✓ Access Denied (403 Forbidden) as expected. Marketing Manager cannot approve quotation.");
    } else {
      throw err;
    }
  }

  // 6. Sales Executive views quotation
  console.log("\n[6] Sales Executive fetching quotation details...");
  const viewRes = await axios.get(`${API_BASE}/crm/quotations/${quotation.id}`, {
    headers: { Authorization: `Bearer ${seToken}` }
  });
  const viewedQuote = viewRes.data;
  console.log(`✓ Quotation fetched: ${viewedQuote.quotationNumber}`);
  console.log(`✓ Customer: ${viewedQuote.customerNameSnapshot}`);
  console.log(`✓ Grand Total: ₹${viewedQuote.grandTotal}`);
  console.log(`✓ Current Status: ${viewedQuote.status}`);

  // 7. Sales Executive approves quotation
  console.log("\n[7] Sales Executive approving quotation...");
  const approveRes = await axios.put(`${API_BASE}/crm/quotations/${quotation.id}/approve`, {
    comments: "Approved by Sales Executive after pricing validation"
  }, {
    headers: { Authorization: `Bearer ${seToken}` }
  });
  const approvedQuote = approveRes.data;
  console.log(`✓ Quotation approval response status: ${approvedQuote.status}`);

  if (approvedQuote.status !== "APPROVED") {
    throw new Error(`Expected status to be APPROVED, got: ${approvedQuote.status}`);
  }
  console.log("✓ Status updated to APPROVED successfully");

  // 8. Verify Marketing Manager sees APPROVED status
  console.log("\n[8] Marketing Manager fetching updated quotation...");
  const mmCheckRes = await axios.get(`${API_BASE}/crm/quotations/${quotation.id}`, {
    headers: { Authorization: `Bearer ${mmToken}` }
  });
  const mmCheckedQuote = mmCheckRes.data;
  console.log(`✓ Marketing Manager sees status: ${mmCheckedQuote.status}`);
  console.log(`✓ Approvals record count: ${mmCheckedQuote.approvals?.length}`);
  if (mmCheckedQuote.approvals?.length > 0) {
    console.log(`✓ Approval Decider: ${mmCheckedQuote.approvals[0].decidedBy?.name || 'N/A'}`);
    console.log(`✓ Approval Status: ${mmCheckedQuote.approvals[0].status}`);
  }

  // 9. Verify Duplicate Approval is Rejected
  console.log("\n[9] Testing duplicate approval rejection...");
  try {
    await axios.put(`${API_BASE}/crm/quotations/${quotation.id}/approve`, {
      comments: "Duplicate approval attempt"
    }, {
      headers: { Authorization: `Bearer ${seToken}` }
    });
    throw new Error("FAILURE: System allowed duplicate approval on already-approved quotation!");
  } catch (err: any) {
    if (err.response && err.response.status === 400) {
      console.log(`✓ Rejection confirmed (400 Bad Request): ${err.response.data.error}`);
    } else {
      throw err;
    }
  }

  // 10. Verify PDF generation endpoint
  console.log("\n[10] Testing PDF generation endpoint...");
  const pdfRes = await axios.get(`${API_BASE}/crm/quotations/${quotation.id}/pdf`, {
    headers: { Authorization: `Bearer ${mmToken}` },
    responseType: "arraybuffer"
  });
  console.log(`✓ PDF Status: ${pdfRes.status}`);
  console.log(`✓ Content-Type: ${pdfRes.headers["content-type"]}`);
  console.log(`✓ PDF byte size: ${pdfRes.data.byteLength || pdfRes.data.length} bytes`);

  console.log("\n==================================================");
  console.log("ALL QUOTATION APPROVAL TESTS PASSED SUCCESSFULLY! ✓");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\n❌ TEST FAILED:", err.message);
  if (err.response?.data) {
    console.error("Response details:", err.response.data);
  }
  process.exit(1);
});

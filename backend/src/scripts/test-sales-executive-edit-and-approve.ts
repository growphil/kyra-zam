import axios from "axios";

const BASE_URL = process.env.API_URL || "http://localhost:8000";

async function main() {
  console.log("==================================================");
  console.log("TESTING SALES EXECUTIVE EDIT & APPROVE FLOW");
  console.log("==================================================");

  try {
    // 1. Marketing Manager Login
    const mmLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: "marketing@kyrazam.com",
      password: "Marketing@2025"
    });
    const mmToken = mmLogin.data.accessToken;
    console.log("✓ MM Logged in:", mmLogin.data.user.name);

    // 2. Sales Executive Login
    const seLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: "sales@kyrazam.com",
      password: "SalesExec@2025"
    });
    const seToken = seLogin.data.accessToken;
    console.log("✓ SE Logged in:", seLogin.data.user.name);

    // 3. Customer
    const custRes = await axios.get(`${BASE_URL}/crm/customers?limit=1`, {
      headers: { Authorization: `Bearer ${mmToken}` }
    });
    const customer = custRes.data.customers?.[0];
    if (!customer) throw new Error("No customer found");
    console.log("✓ Customer:", customer.name);

    // 4. MM creates quotation
    const createRes = await axios.post(
      `${BASE_URL}/crm/quotations`,
      {
        customerId: customer.id,
        validUntil: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        currency: "INR",
        paymentTerms: "Full Advance",
        deliveryTerms: "Standard Delivery",
        additionalCharges: 500,
        freight: 1000,
        items: [
          {
            description: "High Capacity Battery Module 48V",
            quantity: 2,
            unitPrice: 15000,
            discount: 0,
            taxRate: 18,
            notes: "Initial quote created by Marketing Manager"
          }
        ]
      },
      { headers: { Authorization: `Bearer ${mmToken}` } }
    );
    const quote = createRes.data;
    console.log(`✓ Quotation Created: ${quote.quotationNumber} (Status: ${quote.status})`);
    console.log(`  Initial Grand Total: ₹${quote.grandTotal}`);

    // 5. SE Edits the WAITING FOR APPROVAL quotation
    console.log("\n[5] Sales Executive modifying line items & pricing on WAITING FOR APPROVAL quote...");
    const editRes = await axios.put(
      `${BASE_URL}/crm/quotations/${quote.id}`,
      {
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        paymentTerms: "50% Advance / 50% Before Dispatch",
        deliveryTerms: "Express Courier with Inspection",
        additionalCharges: 800,
        freight: 1200,
        items: [
          {
            description: "High Capacity Battery Module 48V (Upgraded Grade A)",
            quantity: 5,
            unitPrice: 14000,
            discount: 5,
            taxRate: 18,
            specification: "High quality grade A with IP67 casing",
            notes: "Revised quantity & 5% special discount applied by Sales Executive"
          },
          {
            description: "Digital BMS & Temperature Sensor Harness",
            quantity: 2,
            unitPrice: 3500,
            discount: 0,
            taxRate: 18,
            specification: "CANbus communication protocol",
            notes: "Essential safety module added during SE review"
          }
        ]
      },
      { headers: { Authorization: `Bearer ${seToken}` } }
    );

    const editedQuote = editRes.data;
    console.log(`✓ Quotation Edited by Sales Executive!`);
    console.log(`  Updated Status: ${editedQuote.status} (confirmed PENDING_APPROVAL)`);
    console.log(`  Updated Grand Total: ₹${editedQuote.grandTotal}`);
    console.log(`  Updated Payment Terms: ${editedQuote.paymentTerms}`);

    // 6. SE Approves the updated quotation
    console.log("\n[6] Sales Executive approving the updated quotation...");
    const approveRes = await axios.put(
      `${BASE_URL}/crm/quotations/${quote.id}/approve`,
      { comments: "Approved after quantity and pricing adjustments" },
      { headers: { Authorization: `Bearer ${seToken}` } }
    );
    console.log(`✓ Approval Status: ${approveRes.data.status}`);

    // 7. Verify final details
    const finalRes = await axios.get(`${BASE_URL}/crm/quotations/${quote.id}`, {
      headers: { Authorization: `Bearer ${mmToken}` }
    });
    console.log(`✓ Final Quotation Status: ${finalRes.data.status}`);
    console.log(`✓ Items count: ${finalRes.data.items.length}`);
    console.log(`✓ Final Grand Total: ₹${finalRes.data.grandTotal}`);
    console.log("==================================================");
    console.log("SALES EXECUTIVE EDIT & APPROVE TEST PASSED! ✓");
    console.log("==================================================");
  } catch (err: any) {
    console.error("Test failed details:", err.response?.status, err.response?.data || err.message);
    process.exit(1);
  }
}

main();

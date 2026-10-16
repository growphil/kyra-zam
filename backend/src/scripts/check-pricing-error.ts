import axios from "axios";

async function diagnose() {
  console.log("🔍 Diagnosing service-pricing-master GET endpoint...");
  try {
    // 1. Log in to get JWT token
    console.log("🔑 Logging in as admin...");
    const loginRes = await axios.post("http://localhost:8000/auth/login", {
      email: "admin@kyrazam.com",
      password: "Admin@2025"
    });
    
    const token = loginRes.data.token;
    console.log("✅ Logged in successfully. Token acquired.");

    // 2. Fetch pricing master rules
    console.log("📡 Requesting GET /service/pricing-master...");
    const res = await axios.get("http://localhost:8000/service/pricing-master", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("🎉 Request successful! Status:", res.status);
    console.log("Response data:", JSON.stringify(res.data, null, 2));

  } catch (err: any) {
    console.error("❌ Request failed!");
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error("Error Response Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}

diagnose();

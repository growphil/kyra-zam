import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import { authPlugin } from "./plugins/auth";
import { corsPlugin } from "./plugins/cors";
import { multipartPlugin } from "./plugins/multipart";
import { websocketPlugin } from "./plugins/websocket";
import { rateLimitPlugin } from "./plugins/rateLimit";
import fastifyStatic from "@fastify/static";
import path from "path";
import { authRoutes } from "./routes/auth";
import { cellRoutes } from "./routes/cells";
import { testingRoutes } from "./routes/testing";
import { paxRoutes } from "./routes/pax";
import { salesRoutes } from "./routes/sales";
import { inventoryRoutes } from "./routes/inventory";
import { repairRoutes } from "./routes/repair";
import { reportsRoutes } from "./routes/reports";
import { adminRoutes } from "./routes/admin";
import { bomRoutes } from "./routes/bom";
import { serviceRoutes } from "./routes/service";
import { scrapRoutes } from "./routes/scrap";
import { crmRoutes } from "./routes/crm";
import { quotationRoutes } from "./routes/quotations";
import { salesOrderRoutes } from "./routes/salesOrders";
import { procurementRoutes } from "./routes/procurement";
import { invoiceOrderRoutes } from "./routes/invoiceOrders";
import { productionRoutes } from "./routes/production";
import { qualityRoutes } from "./routes/quality";
import { dispatchRoutes } from "./routes/dispatch";
import { financeRoutes } from "./routes/finance";
import { warrantyRoutes } from "./routes/warranty";
import { stationRoutes } from "./routes/stations";
import { packingRoutes } from "./routes/packing";
import { hrRoutes } from "./routes/hr";
import { mediaRoutes } from "./routes/media";
import { expenseRoutes } from "./routes/expenses";
import { websocketRoutes } from "./routes/websocket";










const app = Fastify({ logger: true });
import { errorHandler } from "./plugins/errorHandler";

app.setErrorHandler(errorHandler);

import { prisma } from "./prisma";

async function main() {
  // Check DB connection
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  }

  // Register plugins
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(authPlugin);
  await app.register(multipartPlugin);
  await app.register(websocketPlugin);
  // Intercept and protect sensitive confidential legacy directories served from /public/
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const url = req.url.toLowerCase();
    if (
      url.includes("/uploads/payments") ||
      url.includes("/uploads/reports") ||
      url.includes("/uploads/po-attachments") ||
      url.includes("/uploads/documents")
    ) {
      try {
        await req.jwtVerify();
        const user = req.user as any;
        const roles: string[] = user?.roles || [];
        const isPrivileged = roles.some((r) =>
          [
            "ULTRA_ADMIN",
            "ADMIN",
            "SUPERADMIN",
            "ACCOUNTANT",
            "PAX_TEST_ENGINEER",
            "TEST_ENGINEER",
            "SUPERVISOR",
            "PURCHASE_MANAGER",
            "QC",
            "HR_PAYROLL"
          ].includes(r)
        );
        if (!isPrivileged) {
          return reply.code(403).send({ error: "Forbidden: Access to confidential legacy documents is restricted." });
        }
      } catch {
        return reply.code(401).send({ error: "Unauthorized: Access to confidential documents requires authentication." });
      }
    }
  });

  await app.register(fastifyStatic, {
    root: path.join(__dirname, "../public"),
    prefix: "/public/",
  });

  // Container & Load Balancer Health Check Endpoint
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "KYRA ZAM 2.0 Backend",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  });

  // Register routes
  await app.register(authRoutes,    { prefix: "/auth" });
  await app.register(cellRoutes,    { prefix: "/cells" });
  await app.register(testingRoutes, { prefix: "/testing" });
  await app.register(paxRoutes,     { prefix: "/pax" });
  await app.register(salesRoutes,   { prefix: "/sales" });
  await app.register(inventoryRoutes, { prefix: "/inventory" });
  await app.register(repairRoutes,  { prefix: "/repair" });
  await app.register(reportsRoutes, { prefix: "/reports" });
  await app.register(adminRoutes,   { prefix: "/admin" });
  await app.register(bomRoutes,     { prefix: "/bom" });
  await app.register(serviceRoutes, { prefix: "/service" });
  await app.register(scrapRoutes,   { prefix: "/scrap" });
  await app.register(crmRoutes,     { prefix: "/crm" });
  await app.register(quotationRoutes, { prefix: "/crm/quotations" });
  await app.register(salesOrderRoutes, { prefix: "/crm/sales-orders" });
  await app.register(procurementRoutes, { prefix: "/crm/procurement" });
  await app.register(invoiceOrderRoutes, { prefix: "/crm/procurement/invoice-orders" });
  await app.register(invoiceOrderRoutes, { prefix: "/procurement/invoice-orders" });
  await app.register(productionRoutes, { prefix: "/crm/production" });
  await app.register(qualityRoutes, { prefix: "/crm/quality" });
  await app.register(dispatchRoutes, { prefix: "/crm/dispatch" });
  await app.register(financeRoutes, { prefix: "/crm/finance" });
  await app.register(warrantyRoutes, { prefix: "/crm/warranty" });
  await app.register(stationRoutes, { prefix: "/crm/stations" });
  await app.register(packingRoutes, { prefix: "/packing" });
  await app.register(packingRoutes, { prefix: "/crm/packing" });
  await app.register(hrRoutes, { prefix: "/hr" });
  await app.register(hrRoutes, { prefix: "/crm/hr" });
  await app.register(mediaRoutes, { prefix: "/media" });
  await app.register(expenseRoutes, { prefix: "/expenses" });
  await app.register(expenseRoutes, { prefix: "/crm/expenses" });










  // Realtime Live WebSocket Route with Strict Handshake Authentication
  await app.register(websocketRoutes);

  try {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
// Server initialized

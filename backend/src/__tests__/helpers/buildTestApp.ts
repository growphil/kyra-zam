import Fastify, { FastifyInstance } from "fastify";
import { corsPlugin } from "../../plugins/cors";
import { authPlugin } from "../../plugins/auth";
import { websocketPlugin } from "../../plugins/websocket";
import { errorHandler } from "../../plugins/errorHandler";
import { requireRoles } from "../../middleware/rbac";
import { authRoutes } from "../../routes/auth";
import { websocketRoutes } from "../../routes/websocket";
import { procurementRoutes } from "../../routes/procurement";
import { invoiceOrderRoutes } from "../../routes/invoiceOrders";
import { mediaRoutes } from "../../routes/media";
import { financeRoutes } from "../../routes/finance";
import { expenseRoutes } from "../../routes/expenses";
import { getFactoryFinancialSettings } from "../../services/factorySettings.service";
import { paxRoutes } from "../../routes/pax";
import { multipartPlugin } from "../../plugins/multipart";
import fastifyStatic from "@fastify/static";
import path from "path";

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.setErrorHandler(errorHandler);
  await app.register(corsPlugin);
  await app.register(authPlugin);
  await app.register(multipartPlugin);
  await app.register(websocketPlugin);

  // Intercept and protect sensitive confidential legacy directories served from /public/
  app.addHook("onRequest", async (req, reply) => {
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
    root: path.join(__dirname, "../../../public"),
    prefix: "/public/",
  });

  await app.register(websocketRoutes);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(procurementRoutes, { prefix: "/crm/procurement" });
  await app.register(invoiceOrderRoutes, { prefix: "/crm/procurement/invoice-orders" });
  await app.register(mediaRoutes, { prefix: "/media" });
  await app.register(financeRoutes, { prefix: "/crm/finance" });
  await app.register(expenseRoutes, { prefix: "/expenses" });
  await app.register(expenseRoutes, { prefix: "/crm/expenses" });

  app.get("/factory-settings/financial", { preHandler: [app.authenticate] }, async () => {
    return getFactoryFinancialSettings();
  });
  await app.register(paxRoutes, { prefix: "/pax" });

  // Protected route using fastify.authenticate
  app.get(
    "/test/protected-authenticate",
    { preHandler: [app.authenticate] },
    async (request) => {
      return { status: "ok", user: request.user };
    }
  );

  // Protected route using requireRoles("SUPERADMIN")
  app.get(
    "/test/protected-superadmin",
    { preHandler: [requireRoles("SUPERADMIN")] },
    async (request) => {
      return { status: "ok", user: request.user };
    }
  );

  // Protected route using requireRoles("INVENTORY_MANAGER")
  app.get(
    "/test/protected-inventory",
    { preHandler: [requireRoles("INVENTORY_MANAGER")] },
    async (request) => {
      return { status: "ok", user: request.user };
    }
  );

  await app.ready();
  return app;
}

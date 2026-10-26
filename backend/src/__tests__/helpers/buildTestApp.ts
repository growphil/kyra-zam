import Fastify, { FastifyInstance } from "fastify";
import { corsPlugin } from "../../plugins/cors";
import { authPlugin } from "../../plugins/auth";
import { websocketPlugin } from "../../plugins/websocket";
import { errorHandler } from "../../plugins/errorHandler";
import { requireRoles } from "../../middleware/rbac";
import { authRoutes } from "../../routes/auth";
import { websocketRoutes } from "../../routes/websocket";
import { procurementRoutes } from "../../routes/procurement";

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.setErrorHandler(errorHandler);
  await app.register(corsPlugin);
  await app.register(authPlugin);
  await app.register(websocketPlugin);
  await app.register(websocketRoutes);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(procurementRoutes, { prefix: "/crm/procurement" });

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

import Fastify from "fastify";
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
import { productionRoutes } from "./routes/production";
import { qualityRoutes } from "./routes/quality";
import { dispatchRoutes } from "./routes/dispatch";
import { financeRoutes } from "./routes/finance";
import { warrantyRoutes } from "./routes/warranty";
import { stationRoutes } from "./routes/stations";
import { packingRoutes } from "./routes/packing";
import { hrRoutes } from "./routes/hr";










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










  // Realtime Live WebSocket Route with Auth & Heartbeat
  app.get("/ws", { websocket: true }, async (connection, request) => {
    try {
      const { wsManager } = require("./websocket/manager");
      let userId: string | null = null;
      let userRoles: any[] = [];
      let authTimeout: NodeJS.Timeout | null = null;

      let hadHandshakeAuth = false;
      // Check for handshake authentication via Authorization header or Sec-WebSocket-Protocol
      if (!request.headers.authorization && request.headers["sec-websocket-protocol"]) {
        const protocols = (request.headers["sec-websocket-protocol"] as string).split(",").map(p => p.trim());
        const bearerIdx = protocols.findIndex(p => p.toLowerCase() === "bearer");
        if (bearerIdx !== -1 && protocols[bearerIdx + 1]) {
          request.headers.authorization = `Bearer ${protocols[bearerIdx + 1]}`;
        }
      }

      if (request.headers.authorization) {
        hadHandshakeAuth = true;
        try {
          await request.jwtVerify();
          const payload = request.user as unknown as { id: string; email?: string; roles: any };
          if (!payload?.id) {
            connection.socket.send(JSON.stringify({
              event: "error",
              data: { message: "Invalid authentication token" }
            }));
            connection.socket.close(1008, "Authentication required");
            return;
          }

          const dbUser = await prisma.user.findUnique({
            where: { id: payload.id },
            select: { id: true, roles: true, isActive: true }
          });

          if (!dbUser || !dbUser.isActive) {
            connection.socket.send(JSON.stringify({
              event: "error",
              data: { message: "User account not found or inactive" }
            }));
            connection.socket.close(1008, "Authentication required");
            return;
          }

          userId = dbUser.id;
          userRoles = Array.isArray(dbUser.roles) ? dbUser.roles : [dbUser.roles];
        } catch {
          connection.socket.send(JSON.stringify({
            event: "error",
            data: { message: "Invalid or expired authentication token" }
          }));
          connection.socket.close(1008, "Authentication required");
          return;
        }
      }

      const completeAuth = (authedId: string, authedRoles: any[]) => {
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }
        userId = authedId;
        userRoles = authedRoles;
        wsManager.add(userId, userRoles, connection);

        connection.socket.send(JSON.stringify({
          event: "ws:connected",
          data: {
            message: "KYRA ZAM 2.0 Live WebSocket Sync Active",
            userId,
            serverTime: new Date().toISOString()
          }
        }));
      };

      if (userId) {
        // Handshake authentication succeeded
        completeAuth(userId, userRoles);
      } else {
        // Handshake unauthenticated: Require in-band auth message within 5 seconds
        authTimeout = setTimeout(() => {
          if (!userId) {
            try {
              connection.socket.send(JSON.stringify({
                event: "error",
                data: { message: "Authentication required for WebSocket connection" }
              }));
              connection.socket.close(1008, "Authentication required");
            } catch {}
          }
        }, 5000);
      }

      // Handle incoming messages
      connection.socket.on("message", async (raw: any) => {
        try {
          const parsed = JSON.parse(raw.toString());

          // In-band authentication message
          if (parsed.type === "auth" || parsed.event === "auth") {
            const token = parsed.token;
            if (!token || typeof token !== "string") {
              connection.socket.send(JSON.stringify({
                event: "error",
                data: { message: "Authentication required for WebSocket connection" }
              }));
              connection.socket.close(1008, "Authentication required");
              return;
            }

            try {
              const decoded = app.jwt.verify(token) as { id: string; email?: string; roles: any };
              if (!decoded?.id) {
                connection.socket.send(JSON.stringify({
                  event: "error",
                  data: { message: "Invalid authentication token" }
                }));
                connection.socket.close(1008, "Authentication required");
                return;
              }

              const dbUser = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, roles: true, isActive: true }
              });

              if (!dbUser || !dbUser.isActive) {
                connection.socket.send(JSON.stringify({
                  event: "error",
                  data: { message: "User account not found or inactive" }
                }));
                connection.socket.close(1008, "Authentication required");
                return;
              }

              completeAuth(dbUser.id, Array.isArray(dbUser.roles) ? dbUser.roles : [dbUser.roles]);
            } catch (jwtErr: any) {
              connection.socket.send(JSON.stringify({
                event: "error",
                data: { message: "Invalid or expired authentication token" }
              }));
              connection.socket.close(1008, "Authentication required");
            }
            return;
          }

          // Heartbeat ping-pong (only active if authenticated)
          if (parsed.type === "ping" || parsed.event === "ping") {
            if (userId) {
              connection.socket.send(JSON.stringify({ event: "pong", timestamp: Date.now() }));
            }
            return;
          }
        } catch (e) {}
      });

      connection.socket.on("close", () => {
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }
        if (userId) {
          wsManager.remove(userId, connection);
        }
      });
    } catch (err) {
      connection.socket.close(1011, "Server Error");
      return;
    }
  });

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

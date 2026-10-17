import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { wsManager } from "../websocket/manager";

export async function websocketRoutes(app: FastifyInstance) {
  // Realtime Live WebSocket Route with Strict Handshake Authentication
  app.get("/ws", { websocket: true }, async (connection, request) => {
    try {
      // Extract token strictly from Authorization header or Sec-WebSocket-Protocol
      let token: string | undefined;

      if (request.headers.authorization) {
        const parts = request.headers.authorization.split(" ");
        if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
          token = parts[1];
        } else {
          token = request.headers.authorization;
        }
      } else if (request.headers["sec-websocket-protocol"]) {
        const protocols = (request.headers["sec-websocket-protocol"] as string).split(",").map((p) => p.trim());
        const bearerIdx = protocols.findIndex((p) => p.toLowerCase() === "bearer");
        if (bearerIdx !== -1 && protocols[bearerIdx + 1]) {
          token = protocols[bearerIdx + 1];
        }
      }

      // Reject unauthenticated connections immediately during handshake
      if (!token) {
        connection.socket.send(
          JSON.stringify({
            event: "error",
            data: { message: "Authentication required for WebSocket connection" },
          })
        );
        connection.socket.close(1008, "Authentication required");
        return;
      }

      // Verify JWT token
      let payload: { id: string; email?: string; roles: any };
      try {
        payload = app.jwt.verify(token) as { id: string; email?: string; roles: any };
        if (!payload?.id) {
          throw new Error("Missing user id");
        }
      } catch {
        connection.socket.send(
          JSON.stringify({
            event: "error",
            data: { message: "Invalid or expired authentication token" },
          })
        );
        connection.socket.close(1008, "Authentication required");
        return;
      }

      // Verify active user in database and derive database-authoritative roles
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, roles: true, isActive: true },
      });

      if (!dbUser || !dbUser.isActive) {
        connection.socket.send(
          JSON.stringify({
            event: "error",
            data: { message: "User account not found or inactive" },
          })
        );
        connection.socket.close(1008, "Authentication required");
        return;
      }

      const userId = dbUser.id;
      const userRoles = Array.isArray(dbUser.roles) ? dbUser.roles : [dbUser.roles];

      // Register authenticated connection with authoritative database roles
      wsManager.add(userId, userRoles, connection);

      connection.socket.send(
        JSON.stringify({
          event: "ws:connected",
          data: {
            message: "KYRA ZAM 2.0 Live WebSocket Sync Active",
            userId,
            serverTime: new Date().toISOString(),
          },
        })
      );

      // Heartbeat ping-pong for authenticated clients
      connection.socket.on("message", (raw: any) => {
        try {
          const parsed = JSON.parse(raw.toString());
          if (parsed.type === "ping" || parsed.event === "ping") {
            connection.socket.send(JSON.stringify({ event: "pong", timestamp: Date.now() }));
          }
        } catch (e) {}
      });

      connection.socket.on("close", () => {
        wsManager.remove(userId, connection);
      });
    } catch (err) {
      connection.socket.close(1011, "Server Error");
      return;
    }
  });
}

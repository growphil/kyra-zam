import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";
import { redis } from "../redis";
import { Role } from "../generated/client";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; roles: Role[] };
    user: { id: string; roles: Role[] };
  }
}

export const authPlugin = fp(async (fastify: FastifyInstance) => {
  const isProduction = process.env.NODE_ENV === "production";
  const jwtSecret = process.env.JWT_SECRET;

  if (isProduction) {
    if (!jwtSecret || jwtSecret === "super-secret-key-kyra-zam-2026" || jwtSecret.length < 32) {
      throw new Error("FATAL: JWT_SECRET environment variable is missing, insecure, or less than 32 characters in production!");
    }
  }

  const effectiveSecret = jwtSecret || "super-secret-key-kyra-zam-2026";
  const jwtExpiry = process.env.JWT_EXPIRY || "60m";

  fastify.register(fastifyJwt, {
    secret: effectiveSecret,
    sign: { expiresIn: jwtExpiry },
  });

  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as { id: string; email?: string; roles: string[] };

      if (!payload?.id) {
        return reply.status(401).send({ error: "Unauthorized", message: "Invalid user token" });
      }

      // Strictly look up user by immutable primary key ID - never substitute by email or role
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, roles: true, isActive: true }
      });

      if (!user) {
        return reply.status(401).send({ error: "Unauthorized", message: "User not found" });
      }

      if (!user.isActive) {
        return reply.status(403).send({ error: "Forbidden", message: "Account deactivated" });
      }

      // Attach authoritative user identity and permissions derived directly from current database roles
      request.user = { id: user.id, email: user.email, roles: user.roles as any } as any;
    } catch (err: any) {
      console.error("AUTH PLUGIN ERROR:", err.message);
      return reply.status(401).send({ error: "Unauthorized", message: "Invalid or expired token" });
    }
  });
});

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
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "super-secret-key-kyra-zam-2026",
    sign: { expiresIn: "30d" },
  });

  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const queryToken = (request.query as any)?.token;
      if (queryToken) {
        request.headers.authorization = `Bearer ${queryToken}`;
      }
      await request.jwtVerify();
      const payload = request.user as { id: string; email?: string; roles: string[] };

      // Look up user by ID, email, or role fallback
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            ...(payload.id ? [{ id: payload.id }] : []),
            ...(payload.email ? [{ email: payload.email }] : [])
          ]
        },
        select: { id: true, email: true, roles: true, isActive: true }
      });

      if (!user && payload.roles && payload.roles.length > 0) {
        user = await prisma.user.findFirst({
          where: {
            roles: { hasSome: payload.roles as any },
            isActive: true
          },
          select: { id: true, email: true, roles: true, isActive: true }
        });
      }

      if (!user) {
        return reply.status(401).send({ error: "User not found" });
      }

      if (!user.isActive) {
        return reply.status(403).send({ error: "Account deactivated" });
      }

      request.user = { id: user.id, email: user.email, roles: user.roles as any } as any;
    } catch (err: any) {
      console.error("AUTH PLUGIN ERROR:", err.message);
      return reply.status(401).send({ error: "Unauthorized", details: err.message });
    }
  });
});

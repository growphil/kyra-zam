import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../prisma";
import { LoginSchema } from "../schemas/zod.schemas";

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/login
  fastify.post("/login", async (request, reply) => {
    try {
      const { email, password } = LoginSchema.parse(request.body);

      const user = await prisma.user.findUnique({ where: { email } }) as any;
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      // Access Token (long-lived 365 days persistent session until explicit logout)
      const accessToken = fastify.jwt.sign({ id: user.id, email: user.email, roles: user.roles } as any, { expiresIn: "365d" });

      // Refresh Token (extra long-lived)
      const rawRefreshToken = crypto.randomBytes(40).toString("hex");
      const tokenHash = await bcrypt.hash(rawRefreshToken, 10);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90); // 90 days

      await prisma.refreshToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt
        } as any
      });

      // Return userId:token to allow lookup since we store bcrypt hashes
      const compositeToken = `${user.id}:${rawRefreshToken}`;

      return { 
        accessToken, 
        refreshToken: compositeToken, 
        user: { id: user.id, name: user.name, email: user.email, roles: user.roles } 
      };
    } catch (err: any) {
      console.error("LOGIN ERROR:", err);
      return reply.status(500).send({ error: err.message || "Internal Server Error" });
    }
  });

  // POST /auth/refresh
  fastify.post("/refresh", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    if (!refreshToken) return reply.status(400).send({ error: "Refresh token required" });

    const [userId, rawToken] = refreshToken.split(":");
    if (!userId || !rawToken) return reply.status(400).send({ error: "Invalid refresh token format" });

    // Look up active tokens for the user
    const tokens = await prisma.refreshToken.findMany({
      where: { 
        userId, 
        revokedAt: null, 
        expiresAt: { gt: new Date() } 
      }
    });

    let validTokenRow = null;
    for (const t of tokens) {
      if (await bcrypt.compare(rawToken, t.tokenHash)) {
        validTokenRow = t;
        break;
      }
    }

    if (!validTokenRow) {
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } }) as any;
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: "User is no longer active" });
    }

    // Issue new access token
    const newAccessToken = fastify.jwt.sign({ id: user.id, roles: user.roles } as any, { expiresIn: "30d" });
    return { accessToken: newAccessToken };
  });

  // POST /auth/logout
  fastify.post("/logout", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    if (!refreshToken) return reply.status(400).send({ error: "Refresh token required" });

    const [userId, rawToken] = refreshToken.split(":");
    if (!userId || !rawToken) return reply.status(400).send({ error: "Invalid refresh token format" });

    const tokens = await prisma.refreshToken.findMany({
      where: { userId, revokedAt: null }
    });

    for (const t of tokens) {
      if (await bcrypt.compare(rawToken, t.tokenHash)) {
        await prisma.refreshToken.update({
          where: { id: t.id },
          data: { revokedAt: new Date() }
        });
        break;
      }
    }

    return { success: true };
  });

  fastify.get("/me", { preHandler: [fastify.authenticate] }, async (request) => {
    const userPayload = request.user as { id: string };
    const user = await prisma.user.findUnique({ where: { id: userPayload.id } }) as any;
    if (!user) throw new Error("User not found");
    return { id: user.id, name: user.name, email: user.email, roles: user.roles };
  });
}

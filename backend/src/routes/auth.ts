import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../prisma";
import { LoginSchema } from "../schemas/zod.schemas";

function getRefreshExpiryDate(): Date {
  const expiryEnv = process.env.JWT_REFRESH_EXPIRY || "7d";
  const daysMatch = expiryEnv.match(/^(\d+)d$/);
  const days = daysMatch ? parseInt(daysMatch[1], 10) : 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

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

      // Access Token with configured lifetime (e.g. 60m)
      const jwtExpiry = process.env.JWT_EXPIRY || "60m";
      const accessToken = fastify.jwt.sign(
        { id: user.id, email: user.email, roles: user.roles } as any,
        { expiresIn: jwtExpiry }
      );

      // Refresh Token with configured lifetime (e.g. 7d)
      const rawRefreshToken = crypto.randomBytes(40).toString("hex");
      const tokenHash = await bcrypt.hash(rawRefreshToken, 10);
      const expiresAt = getRefreshExpiryDate();

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
    const { refreshToken } = (request.body || {}) as { refreshToken?: string };
    if (!refreshToken) return reply.status(400).send({ error: "Refresh token required" });

    const separatorIndex = refreshToken.indexOf(":");
    if (separatorIndex === -1) {
      return reply.status(400).send({ error: "Invalid refresh token format" });
    }

    const userId = refreshToken.substring(0, separatorIndex);
    const rawToken = refreshToken.substring(separatorIndex + 1);
    if (!userId || !rawToken) {
      return reply.status(400).send({ error: "Invalid refresh token format" });
    }

    // Step 1: Look up active, unexpired tokens for the user
    const activeTokens = await prisma.refreshToken.findMany({
      where: { 
        userId, 
        revokedAt: null, 
        expiresAt: { gt: new Date() } 
      }
    });

    let matchedActiveToken = null;
    for (const t of activeTokens) {
      if (await bcrypt.compare(rawToken, t.tokenHash)) {
        matchedActiveToken = t;
        break;
      }
    }

    if (matchedActiveToken) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, roles: true, isActive: true }
      }) as any;

      if (!user || !user.isActive) {
        return reply.status(401).send({ error: "User is no longer active" });
      }

      // Single-use token rotation: Revoke the used refresh token immediately
      await prisma.refreshToken.update({
        where: { id: matchedActiveToken.id },
        data: { revokedAt: new Date() }
      });

      // Issue new cryptographically random refresh token
      const newRawToken = crypto.randomBytes(40).toString("hex");
      const newTokenHash = await bcrypt.hash(newRawToken, 10);
      const expiresAt = getRefreshExpiryDate();

      await prisma.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          userId: user.id,
          expiresAt
        } as any
      });

      // Issue new access token with configured expiry
      const jwtExpiry = process.env.JWT_EXPIRY || "60m";
      const newAccessToken = fastify.jwt.sign(
        { id: user.id, email: user.email, roles: user.roles } as any,
        { expiresIn: jwtExpiry }
      );

      const newCompositeToken = `${user.id}:${newRawToken}`;

      return {
        accessToken: newAccessToken,
        refreshToken: newCompositeToken
      };
    }

    // Step 2: Replay detection: Check if the rawToken matches any revoked token for this user
    const revokedTokens = await prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: { not: null }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    let matchedRevokedToken = null;
    for (const t of revokedTokens) {
      if (await bcrypt.compare(rawToken, t.tokenHash)) {
        matchedRevokedToken = t;
        break;
      }
    }

    if (matchedRevokedToken) {
      // Replay attack / token reuse detected: Revoke all active sessions for this user
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      console.warn(`SECURITY ALERT: Refresh token reuse detected for userId=${userId}. All sessions revoked.`);
      return reply.status(401).send({
        error: "Refresh token reuse detected. All sessions revoked. Please log in again."
      });
    }

    return reply.status(401).send({ error: "Invalid or expired refresh token" });
  });

  // POST /auth/logout
  fastify.post("/logout", async (request, reply) => {
    const { refreshToken } = (request.body || {}) as { refreshToken?: string };
    if (!refreshToken) return reply.status(400).send({ error: "Refresh token required" });

    const separatorIndex = refreshToken.indexOf(":");
    if (separatorIndex === -1) {
      return reply.status(400).send({ error: "Invalid refresh token format" });
    }

    const userId = refreshToken.substring(0, separatorIndex);
    const rawToken = refreshToken.substring(separatorIndex + 1);
    if (!userId || !rawToken) {
      return reply.status(400).send({ error: "Invalid refresh token format" });
    }

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

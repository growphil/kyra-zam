import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";

export type UserRole =
  | "SUPERADMIN" | "ADMIN" | "INVENTORY_MANAGER"
  | "TEST_ENGINEER" | "ASSEMBLY_TECHNICIAN" | "PAX_TEST_ENGINEER"
  | "SUPERVISOR" | "SALES_EXECUTIVE" | "ACCOUNTANT" | "PURCHASE_MANAGER"
  | "MARKETING_MANAGER" | "QC" | "PACKING_OPERATOR" | "PACKING" | "SELLER" | "HR_PAYROLL";

export function requireRoles(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const userPayload = request.user as unknown as { id: string; email?: string; roles: UserRole[] };

      // Look up user by ID first, or fallback to email (so reseeding doesn't invalidate active user sessions)
      let dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(userPayload.id ? [{ id: userPayload.id }] : []),
            ...(userPayload.email ? [{ email: userPayload.email }] : [])
          ]
        },
        select: { id: true, email: true, roles: true, isActive: true }
      });

      if (!dbUser) {
        return reply.status(401).send({ error: "Unauthorized", message: "User session expired or user not found. Please log in again." });
      }

      if (!dbUser.isActive) {
        return reply.status(403).send({ error: "Forbidden", message: "User account is inactive." });
      }

      // Attach active DB user to request so downstream operations (like AuditLog actorId) always succeed
      request.user = { id: dbUser.id, email: dbUser.email, roles: dbUser.roles as any } as any;

      const hasPermission = roles.some(role => (dbUser!.roles as UserRole[]).includes(role));
      if (!hasPermission) {
        return reply.status(403).send({ error: "Access denied" });
      }
    } catch (err: any) {
      console.error("RBAC AUTH ERROR:", err.message);
      return reply.status(401).send({ error: "Unauthorized", details: err.message });
    }
  };
}


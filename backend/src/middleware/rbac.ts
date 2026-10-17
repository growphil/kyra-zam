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

      if (!userPayload?.id) {
        return reply.status(401).send({ error: "Unauthorized", message: "Invalid user token" });
      }

      // Strictly look up user by immutable primary key ID - never substitute by email or role
      const dbUser = await prisma.user.findUnique({
        where: { id: userPayload.id },
        select: { id: true, email: true, roles: true, isActive: true }
      });

      if (!dbUser) {
        return reply.status(401).send({ error: "Unauthorized", message: "User session expired or user not found. Please log in again." });
      }

      if (!dbUser.isActive) {
        return reply.status(403).send({ error: "Forbidden", message: "User account is inactive." });
      }

      // Authoritative identity and permissions derived directly from current database roles
      request.user = { id: dbUser.id, email: dbUser.email, roles: dbUser.roles as any } as any;

      const hasPermission = roles.some(role => (dbUser.roles as UserRole[]).includes(role));
      if (!hasPermission) {
        return reply.status(403).send({ error: "Access denied" });
      }
    } catch (err: any) {
      console.error("RBAC AUTH ERROR:", err.message);
      return reply.status(401).send({ error: "Unauthorized", message: "Invalid or expired token" });
    }
  };
}


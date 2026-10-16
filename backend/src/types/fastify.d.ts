import { JWT } from "@fastify/jwt";
import { UserRole } from "../middleware/rbac";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; roles: UserRole[] };
    user: { id: string; roles: UserRole[] };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    jwtVerify(): Promise<void>;
    user: {
      id: string;
      roles: UserRole[];
    };
  }
  interface FastifyInstance {
    authenticate: any;
  }
}

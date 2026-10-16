import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "../generated/client";

export function errorHandler(error: any, request: FastifyRequest, reply: FastifyReply) {
  // 1. Log the error for internal tracking
  request.log.error(error);

  // 2. Handle Zod Validation Errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "Validation Failed",
      details: error.errors.map(err => ({
        path: err.path.join("."),
        message: err.message
      }))
    });
  }

  // 3. Handle Prisma Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": // Unique constraint failed
        const targets = (error.meta?.target as string[]) || ["field"];
        return reply.status(409).send({
          error: "Conflict",
          message: `A record with this ${targets.join(", ")} already exists.`
        });
      case "P2025": // Record not found
        return reply.status(404).send({
          error: "Not Found",
          message: "The requested record does not exist."
        });
      case "P2003": // Foreign key constraint failed
        const fieldName = (error.meta?.field_name as string) || "foreign key";
        return reply.status(400).send({
          error: "Invalid Reference",
          message: `Referenced entity (${fieldName}) does not exist in the database.`
        });
      default:
        return reply.status(500).send({
          error: "Database Error",
          message: error.message || "A database error occurred."
        });
    }
  }

  // 4. Handle HTTP Errors (like 401, 403)
  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      error: error.name,
      message: error.message
    });
  }

  // 5. Fallback for unexpected errors
  return reply.status(500).send({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : error.message
  });
}

import fp from "fastify-plugin";
import fastifyRateLimit from "@fastify/rate-limit";
import { FastifyInstance } from "fastify";

export const rateLimitPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
});

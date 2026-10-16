import fp from "fastify-plugin";
import fastifyMultipart from "@fastify/multipart";
import { FastifyInstance } from "fastify";

export const multipartPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifyMultipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1000000,
      fields: 10,
      fileSize: 10000000,
      files: 1,
    },
  });
});

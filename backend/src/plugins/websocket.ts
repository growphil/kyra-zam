import fp from "fastify-plugin";
import fastifyWebsocket from "@fastify/websocket";
import { FastifyInstance } from "fastify";

export const websocketPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifyWebsocket);
});

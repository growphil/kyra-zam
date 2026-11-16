import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { MediaService } from "../services/media.service";
import { MediaCategory, MediaVisibility } from "../types/media.types";
import { z } from "zod";

const InitiateUploadSchema = z.object({
  originalName: z.string().min(1, "originalName is required"),
  mimeType: z.string().min(1, "mimeType is required"),
  fileSize: z.number().positive("fileSize must be positive"),
  category: z.nativeEnum(MediaCategory),
  visibility: z.nativeEnum(MediaVisibility).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const CompleteUploadSchema = z.object({
  mediaId: z.string().uuid("Invalid mediaId format"),
  objectKey: z.string().min(1, "objectKey is required"),
});

export async function mediaRoutes(fastify: FastifyInstance) {
  // Common authentication handler for all media routes
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as any;
      if (!payload?.id) {
        return reply.status(401).send({ error: "Unauthorized", message: "Invalid session token" });
      }
    } catch (err: any) {
      return reply.status(401).send({ error: "Unauthorized", message: "Invalid or expired session" });
    }
  };

  // POST /media/upload/initiate - Initiate S3 Presigned Upload
  fastify.post(
    "/upload/initiate",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string; roles: string[] };

      const parseResult = InitiateUploadSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        });
      }

      try {
        const response = await MediaService.initiateUpload(parseResult.data, user);
        return reply.status(201).send(response);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to initiate upload" });
      }
    }
  );

  // POST /media/upload/complete - Confirm and verify uploaded S3 object
  fastify.post(
    "/upload/complete",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string; roles: string[] };

      const parseResult = CompleteUploadSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        });
      }

      try {
        const media = await MediaService.completeUpload(parseResult.data, user);
        return reply.status(200).send({
          success: true,
          media,
        });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to complete upload" });
      }
    }
  );

  // GET /media/:id/access - Retrieve short-lived presigned download URL
  fastify.get(
    "/:id/access",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string; roles: string[] };
      const { id } = request.params as { id: string };
      const { expiresIn } = request.query as { expiresIn?: string };

      const parsedExpiresIn = expiresIn ? parseInt(expiresIn, 10) : 900;
      const safeExpiresIn = Math.min(Math.max(parsedExpiresIn, 60), 3600); // 1 min to 1 hour

      try {
        const access = await MediaService.getMediaAccess(id, user, safeExpiresIn);
        return reply.status(200).send(access);
      } catch (err: any) {
        const status = err.message.includes("Forbidden")
          ? 403
          : err.message.includes("not found")
          ? 404
          : 400;
        return reply.status(status).send({ error: err.message || "Failed to retrieve media access" });
      }
    }
  );

  // GET /media/:id/file - Direct streaming/redirect to S3 presigned URL
  fastify.get(
    "/:id/file",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { token } = request.query as { token?: string };

      let user: { id: string; roles: string[] } = { id: "anonymous", roles: [] };

      // Authenticate via query token or Bearer header if provided
      if (token) {
        try {
          const decoded = fastify.jwt.verify(token) as any;
          if (decoded?.id) {
            user = { id: decoded.id, roles: decoded.roles || [] };
          }
        } catch {
          // Token invalid
        }
      } else {
        try {
          await request.jwtVerify();
          const payload = request.user as any;
          if (payload?.id) {
            user = { id: payload.id, roles: payload.roles || [] };
          }
        } catch {
          // Not authenticated via header
        }
      }

      try {
        const access = await MediaService.getMediaAccess(id, user, 900);
        return reply.redirect(307, access.accessUrl);
      } catch (err: any) {
        const status = err.message.includes("Unauthorized")
          ? 401
          : err.message.includes("Forbidden")
          ? 403
          : err.message.includes("not found")
          ? 404
          : 400;
        return reply.status(status).send({ error: err.message || "Unauthorized to access media" });
      }
    }
  );

  // POST /media/:id/replace - Safely replace media asset with a new completed asset
  fastify.post(
    "/:id/replace",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string; roles: string[] };
      const { id } = request.params as { id: string };
      const { newMediaId } = request.body as { newMediaId: string };

      if (!newMediaId) {
        return reply.status(400).send({ error: "newMediaId is required in request body" });
      }

      try {
        const replaced = await MediaService.replaceMedia(id, newMediaId, user);
        return reply.status(200).send({
          success: true,
          message: "Media asset successfully replaced",
          asset: replaced,
        });
      } catch (err: any) {
        const status = err.message.includes("Forbidden") ? 403 : err.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({ error: err.message || "Failed to replace media asset" });
      }
    }
  );

  // POST /media/cleanup - Administrative cleanup of abandoned PENDING uploads
  fastify.post(
    "/cleanup",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string; roles: string[] };
      const isPrivileged = user.roles.some((r) =>
        ["ULTRA_ADMIN", "SUPERADMIN", "ADMIN"].includes(r)
      );

      if (!isPrivileged) {
        return reply.status(403).send({ error: "Forbidden: Cleanup requires administrative privileges" });
      }

      const { olderThanMinutes = 60 } = (request.body as { olderThanMinutes?: number }) || {};
      const safeMinutes = Math.max(15, olderThanMinutes);

      try {
        const cleanedCount = await MediaService.cleanupAbandonedUploads(safeMinutes);
        return reply.status(200).send({
          success: true,
          cleanedCount,
          message: `Cleaned ${cleanedCount} abandoned pending uploads older than ${safeMinutes} minutes`,
        });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message || "Failed to run media cleanup" });
      }
    }
  );

  // GET /media/:id/metadata - Retrieve MediaAsset metadata
  fastify.get(
    "/:id/metadata",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string; roles: string[] };
      const { id } = request.params as { id: string };

      try {
        const metadata = await MediaService.getMediaMetadata(id, user);
        return reply.status(200).send(metadata);
      } catch (err: any) {
        const status = err.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({ error: err.message || "Failed to retrieve media metadata" });
      }
    }
  );

  // DELETE /media/:id - Delete media from S3 and mark DELETED
  fastify.delete(
    "/:id",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string; roles: string[] };
      const { id } = request.params as { id: string };

      try {
        await MediaService.deleteMedia(id, user);
        return reply.status(200).send({
          success: true,
          message: "Media asset deleted successfully",
        });
      } catch (err: any) {
        const status = err.message.includes("Forbidden")
          ? 403
          : err.message.includes("not found")
          ? 404
          : 400;
        return reply.status(status).send({ error: err.message || "Failed to delete media asset" });
      }
    }
  );
}

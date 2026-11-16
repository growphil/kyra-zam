import { prisma } from "../prisma";
import { StorageService } from "./storage.service";
import { MediaValidationService } from "./media-validation.service";
import {
  MediaCategory,
  MediaVisibility,
  MediaUploadStatus,
  InitiateUploadInput,
  InitiateUploadResponse,
  CompleteUploadInput,
  MediaAccessResponse,
  UploadStreamOptions
} from "../types/media.types";
import path from "path";

export class MediaService {
  /**
   * 1. Initiate upload: Validates metadata, reserves MediaAsset row, generates S3 presigned PUT URL
   */
  public static async initiateUpload(
    input: InitiateUploadInput,
    user: { id: string; roles: string[] }
  ): Promise<InitiateUploadResponse> {
    const { sanitizedExt, rule } = MediaValidationService.validateUploadRequest(
      input.category,
      input.originalName,
      input.mimeType,
      input.fileSize,
      user.roles
    );

    const objectKey = StorageService.generateObjectKey(input.category, input.originalName);
    const bucket = StorageService.getBucketName();
    const visibility = input.visibility || rule.defaultVisibility;
    const expiresInSeconds = 900; // 15 mins

    // Generate S3 presigned PUT URL
    const uploadUrl = await StorageService.generatePresignedUploadUrl(
      objectKey,
      input.mimeType,
      expiresInSeconds
    );

    // Create initial pending MediaAsset record in PostgreSQL
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        originalName: input.originalName,
        objectKey,
        bucket,
        mimeType: input.mimeType,
        fileExtension: sanitizedExt,
        fileSize: input.fileSize,
        category: input.category,
        visibility,
        status: MediaUploadStatus.PENDING,
        uploadedById: user.id,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        metadata: input.metadata ? (input.metadata as any) : undefined,
      },
    });

    return {
      mediaId: mediaAsset.id,
      objectKey,
      uploadUrl,
      expiresInSeconds,
      bucket,
      mimeType: input.mimeType,
      category: input.category,
    };
  }

  /**
   * 2. Complete upload: Verifies uploaded object in S3, inspects real file bytes for magic signatures,
   * enforces size limits, and updates MediaAsset status to COMPLETED (or purges on failure).
   */
  public static async completeUpload(
    input: CompleteUploadInput,
    user: { id: string; roles: string[] }
  ) {
    const media = await prisma.mediaAsset.findUnique({
      where: { id: input.mediaId },
    });

    if (!media) {
      throw new Error(`Media asset with ID "${input.mediaId}" not found.`);
    }

    if (media.objectKey !== input.objectKey) {
      throw new Error("Mismatched object key for completion request.");
    }

    const isAdmin = user.roles.some((r) => r === "ULTRA_ADMIN" || r === "SUPERADMIN" || r === "ADMIN");
    if (media.uploadedById && media.uploadedById !== user.id && !isAdmin) {
      throw new Error("Forbidden: You are not authorized to complete this upload.");
    }

    if (media.status === MediaUploadStatus.COMPLETED) {
      return media;
    }

    // 1. Verify object existence and metadata in S3 via HeadObject
    const s3Metadata = await StorageService.verifyObject(media.objectKey);

    // 2. Enforce category file size limits
    const rule = MediaValidationService.getRule(media.category);
    if (s3Metadata.size > rule.maxSizeBytes) {
      await StorageService.deleteObject(media.objectKey).catch(() => {});
      await prisma.mediaAsset.update({
        where: { id: media.id },
        data: { status: MediaUploadStatus.FAILED },
      });
      throw new Error(`Uploaded file size (${s3Metadata.size} bytes) exceeds category maximum limit of ${rule.maxSizeBytes} bytes.`);
    }

    if (s3Metadata.size === 0) {
      await StorageService.deleteObject(media.objectKey).catch(() => {});
      await prisma.mediaAsset.update({
        where: { id: media.id },
        data: { status: MediaUploadStatus.FAILED },
      });
      throw new Error("Uploaded file is empty (0 bytes). Upload rejected.");
    }

    // 3. Retrieve actual binary file header bytes directly from S3
    const headerBytes = await StorageService.getObjectBytes(media.objectKey, 8192);

    // 4. Verify actual magic bytes and file signature
    const isValidSignature = MediaValidationService.verifyFileSignature(
      headerBytes,
      media.mimeType,
      media.fileExtension || ""
    );

    if (!isValidSignature) {
      // Security violation: delete the poisoned/spoofed object from S3 immediately
      await StorageService.deleteObject(media.objectKey).catch(() => {});
      await prisma.mediaAsset.update({
        where: { id: media.id },
        data: { status: MediaUploadStatus.FAILED },
      });
      throw new Error(`Upload rejected: File contents failed binary signature inspection and do not match declared MIME type "${media.mimeType}". Malformed object removed from S3.`);
    }

    // 5. Update database record to COMPLETED
    const updated = await prisma.mediaAsset.update({
      where: { id: media.id },
      data: {
        status: MediaUploadStatus.COMPLETED,
        fileSize: s3Metadata.size,
        mimeType: s3Metadata.contentType || media.mimeType,
      },
    });

    return updated;
  }

  /**
   * 3. Secure Media Retrieval: Checks authorization and returns temporary presigned GET URL.
   * STRICT: Never allows PENDING, FAILED, or DELETED media to be retrieved.
   */
  public static async getMediaAccess(
    mediaId: string,
    user: { id: string; roles: string[] },
    expiresInSeconds: number = 900 // 15 minutes default
  ): Promise<MediaAccessResponse> {
    const media = await prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });

    if (!media || media.status !== MediaUploadStatus.COMPLETED) {
      throw new Error("Media asset not found or upload is not verified and completed.");
    }

    // Check authorization based on visibility and category
    const isSuperAdminOrAdmin = user.roles.some((r) => r === "ULTRA_ADMIN" || r === "SUPERADMIN" || r === "ADMIN");
    const isUploader = media.uploadedById && media.uploadedById === user.id;

    if (!isSuperAdminOrAdmin && !isUploader) {
      if (media.visibility === MediaVisibility.PRIVATE || media.visibility === MediaVisibility.RESTRICTED) {
        if (user.id === "anonymous" || !user.roles || user.roles.length === 0) {
          throw new Error("Unauthorized: Authentication required to access private documents.");
        }
        // Must have the required category role
        const rule = MediaValidationService.getRule(media.category);
        const hasRole = user.roles.some((r) => rule.allowedRoles.includes(r));
        if (!hasRole) {
          throw new Error("Forbidden: You do not have departmental permission to access this private document.");
        }
      }
    }

    // Generate short-lived presigned GET URL
    const accessUrl = await StorageService.generatePresignedDownloadUrl(
      media.objectKey,
      expiresInSeconds,
      media.originalName
    );

    return {
      mediaId: media.id,
      accessUrl,
      expiresInSeconds,
      mimeType: media.mimeType,
      fileName: media.originalName,
      fileSize: media.fileSize,
      category: media.category,
    };
  }

  /**
   * 4. Retrieve metadata without generating presigned URL
   */
  public static async getMediaMetadata(mediaId: string, user: { id: string; roles: string[] }) {
    const media = await prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!media || media.status === MediaUploadStatus.DELETED) {
      throw new Error("Media asset not found.");
    }

    return media;
  }

  /**
   * 5. Delete media: Deletes object from S3 and marks MediaAsset as DELETED in PostgreSQL
   */
  public static async deleteMedia(mediaId: string, user: { id: string; roles: string[] }) {
    const media = await prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new Error("Media asset not found.");
    }

    const isAdmin = user.roles.some((r) => r === "SUPERADMIN" || r === "ADMIN");
    const isOwner = media.uploadedById === user.id;

    if (!isAdmin && !isOwner) {
      throw new Error("Forbidden: You do not have permission to delete this media asset.");
    }

    // Delete S3 object
    try {
      await StorageService.deleteObject(media.objectKey);
    } catch (err: any) {
      console.warn(`[MediaService] S3 deletion warning for ${media.objectKey}:`, err.message);
    }

    // Mark as DELETED in database
    return prisma.mediaAsset.update({
      where: { id: mediaId },
      data: { status: MediaUploadStatus.DELETED },
    });
  }

  /**
   * 6. Direct server-side upload helper (for backward-compatible endpoints & stream buffers)
   */
  public static async uploadDirectBuffer(
    buffer: Buffer,
    options: UploadStreamOptions,
    user: { id: string; roles: string[] }
  ) {
    const { sanitizedExt, rule } = MediaValidationService.validateUploadRequest(
      options.category,
      options.originalName,
      options.mimeType,
      buffer.length,
      user.roles
    );

    // Verify buffer magic bytes
    const isValidSignature = MediaValidationService.verifyFileSignature(
      buffer,
      options.mimeType,
      sanitizedExt
    );

    if (!isValidSignature) {
      throw new Error(`File contents do not match the expected MIME type "${options.mimeType}". Upload rejected.`);
    }

    const objectKey = StorageService.generateObjectKey(options.category, options.originalName);
    const bucket = StorageService.getBucketName();
    const visibility = options.visibility || rule.defaultVisibility;

    // Upload directly to S3
    await StorageService.uploadBuffer(buffer, objectKey, options.mimeType);

    // Create completed MediaAsset
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        originalName: options.originalName,
        objectKey,
        bucket,
        mimeType: options.mimeType,
        fileExtension: sanitizedExt,
        fileSize: buffer.length,
        category: options.category,
        visibility,
        status: MediaUploadStatus.COMPLETED,
        uploadedById: user.id,
        entityType: options.entityType || null,
        entityId: options.entityId || null,
      },
    });

    return mediaAsset;
  }

  /**
   * 7. Replace media asset: Safely updates reference, marks old asset DELETED, and cleans old S3 object
   */
  public static async replaceMedia(
    oldMediaId: string,
    newMediaId: string,
    user: { id: string; roles: string[] }
  ) {
    const oldMedia = await prisma.mediaAsset.findUnique({ where: { id: oldMediaId } });
    const newMedia = await prisma.mediaAsset.findUnique({ where: { id: newMediaId } });

    if (!newMedia || newMedia.status !== MediaUploadStatus.COMPLETED) {
      throw new Error("Replacement failed: New media asset must be verified and completed.");
    }

    if (oldMedia) {
      const isAdmin = user.roles.some((r) => r === "ULTRA_ADMIN" || r === "SUPERADMIN" || r === "ADMIN");
      const isOwner = oldMedia.uploadedById === user.id;
      if (!isAdmin && !isOwner) {
        throw new Error("Forbidden: You do not have permission to replace this media asset.");
      }

      // Safe deletion of old S3 object
      try {
        await StorageService.deleteObject(oldMedia.objectKey);
      } catch (err: any) {
        console.warn(`[MediaService] Cleanup warning during media replacement: ${err.message}`);
      }

      await prisma.mediaAsset.update({
        where: { id: oldMediaId },
        data: { status: MediaUploadStatus.DELETED },
      });
    }

    return newMedia;
  }

  /**
   * 8. Scheduled/Admin Cleanup of abandoned PENDING uploads older than threshold
   */
  public static async cleanupAbandonedUploads(olderThanMinutes: number = 60): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const expiredPending = await prisma.mediaAsset.findMany({
      where: {
        status: MediaUploadStatus.PENDING,
        createdAt: { lt: cutoff },
      },
    });

    let cleaned = 0;
    for (const asset of expiredPending) {
      try {
        await StorageService.deleteObject(asset.objectKey).catch(() => {});
        await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: { status: MediaUploadStatus.FAILED },
        });
        cleaned++;
      } catch (e: any) {
        console.warn(`[MediaService] Cleanup error for asset ${asset.id}:`, e.message);
      }
    }
    return cleaned;
  }
}

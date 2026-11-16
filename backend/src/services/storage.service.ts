import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommandOutput
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { MediaCategory, MediaVisibility, MediaUploadStatus } from "../types/media.types";
import { MediaValidationService } from "./media-validation.service";
import { prisma } from "../prisma";

export interface S3ObjectMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified?: Date;
  eTag?: string;
}

export interface UploadResult {
  fileName: string;
  url: string;
  objectKey: string;
  storageDriver: "s3";
  mediaId: string;
  filePath?: string;
}

export class StorageService {
  private static s3Client: S3Client | null = null;
  private static bucketName: string = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || "kyra-zam-media-prod";
  private static regionName: string = process.env.AWS_REGION || process.env.S3_REGION || "ap-south-1";

  /**
   * Lazily initialize S3Client using AWS SDK default credential provider chain (EC2 IAM Role)
   */
  public static getS3Client(): S3Client {
    if (this.s3Client) return this.s3Client;

    this.bucketName = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || "kyra-zam-media-prod";
    this.regionName = process.env.AWS_REGION || process.env.S3_REGION || "ap-south-1";

    const config: any = {
      region: this.regionName,
    };

    // Optional override if explicit valid credentials provided (e.g. local dev); otherwise AWS default chain (IAM Role) is used
    const clean = (val?: string) => val?.replace(/["']/g, "").trim();
    const rawKey = clean(process.env.AWS_ACCESS_KEY_ID);
    const rawSecret = clean(process.env.AWS_SECRET_ACCESS_KEY);
    const isPlaceholder = (val?: string) =>
      !val ||
      val === "your-key" ||
      val === "your-secret" ||
      val.toLowerCase().includes("your-") ||
      val.toLowerCase().includes("dummy") ||
      val.length < 12;

    if (rawKey && rawSecret && !isPlaceholder(rawKey) && !isPlaceholder(rawSecret)) {
      config.credentials = {
        accessKeyId: rawKey,
        secretAccessKey: rawSecret,
      };
    } else if (process.env.NODE_ENV === "test") {
      // In automated test mocks only
      config.credentials = {
        accessKeyId: "TESTINGMOCKKEY001",
        secretAccessKey: "TestingMockSecretKey0000000000000000001",
      };
    }

    if (process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT) {
      config.endpoint = process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT;
      config.forcePathStyle = true;
    }

    this.s3Client = new S3Client(config);
    return this.s3Client;
  }

  public static setS3Client(client: S3Client | null): void {
    this.s3Client = client;
  }

  public static getBucketName(): string {
    return process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || this.bucketName;
  }

  public static getRegion(): string {
    return process.env.AWS_REGION || process.env.S3_REGION || this.regionName;
  }

  /**
   * Generate an unpredictable, structured S3 object key based on category
   * Format: kyra-zam/<category-prefix>/<uuid>.<ext>
   */
  public static generateObjectKey(category: MediaCategory, originalName: string): string {
    const rule = MediaValidationService.getRule(category);
    const ext = path.extname(originalName).toLowerCase();
    const uniqueId = uuidv4();
    return `${rule.s3Prefix}/${uniqueId}${ext}`;
  }

  /**
   * Generate a short-lived presigned PUT URL for direct frontend client uploads
   */
  public static async generatePresignedUploadUrl(
    objectKey: string,
    mimeType: string,
    expiresInSeconds: number = 900 // 15 minutes
  ): Promise<string> {
    const s3 = this.getS3Client();
    const bucket = this.getBucketName();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: mimeType,
    });

    try {
      const url = await getSignedUrl(s3 as any, command, { expiresIn: expiresInSeconds });
      return url;
    } catch (err: any) {
      console.error(`[StorageService] Failed to generate presigned upload URL for key ${objectKey}:`, err);
      throw new Error(`Failed to generate upload authorization: ${err.message}`);
    }
  }

  /**
   * Generate a short-lived presigned GET URL for secure media retrieval
   */
  public static async generatePresignedDownloadUrl(
    objectKey: string,
    expiresInSeconds: number = 900, // 15 minutes default
    customFilename?: string
  ): Promise<string> {
    const s3 = this.getS3Client();
    const bucket = this.getBucketName();

    const getParams: any = {
      Bucket: bucket,
      Key: objectKey,
    };

    if (customFilename) {
      const sanitizedFilename = customFilename.replace(/[^a-zA-Z0-9_.-]/g, "_");
      getParams.ResponseContentDisposition = `inline; filename="${sanitizedFilename}"`;
    }

    const command = new GetObjectCommand(getParams);

    try {
      const url = await getSignedUrl(s3 as any, command, { expiresIn: expiresInSeconds });
      return url;
    } catch (err: any) {
      console.error(`[StorageService] Failed to generate presigned download URL for key ${objectKey}:`, err);
      throw new Error(`Failed to generate access URL: ${err.message}`);
    }
  }

  /**
   * Verify an uploaded object in S3 using HeadObject
   */
  public static async verifyObject(objectKey: string): Promise<S3ObjectMetadata> {
    const s3 = this.getS3Client();
    const bucket = this.getBucketName();

    try {
      const response: HeadObjectCommandOutput = await s3.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );

      return {
        key: objectKey,
        size: response.ContentLength || 0,
        contentType: response.ContentType || "application/octet-stream",
        lastModified: response.LastModified,
        eTag: response.ETag,
      };
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        throw new Error(`S3 Object "${objectKey}" was not found or upload was not completed.`);
      }
      console.error(`[StorageService] HeadObject failed for ${objectKey}:`, err);
      throw new Error(`Failed to verify uploaded object: ${err.message}`);
    }
  }

  /**
   * Check if an object exists in S3
   */
  public static async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.verifyObject(objectKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve bounded byte slice from S3 object (e.g. initial 8KB) using GetObjectCommand Range request.
   * Enables binary magic byte inspection without downloading large files into memory.
   */
  public static async getObjectBytes(objectKey: string, maxBytes: number = 8192): Promise<Buffer> {
    const s3 = this.getS3Client();
    const bucket = this.getBucketName();

    try {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Range: `bytes=0-${maxBytes - 1}`,
        })
      );

      if (!response.Body) {
        throw new Error(`S3 object "${objectKey}" returned empty body`);
      }

      if (typeof (response.Body as any).transformToByteArray === "function") {
        const byteArray = await (response.Body as any).transformToByteArray();
        return Buffer.from(byteArray);
      }

      // Stream fallback
      const chunks: Buffer[] = [];
      let totalLength = 0;
      for await (const chunk of response.Body as any) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buf);
        totalLength += buf.length;
        if (totalLength >= maxBytes) break;
      }
      return Buffer.concat(chunks).subarray(0, maxBytes);
    } catch (err: any) {
      console.error(`[StorageService] GetObject bytes failed for ${objectKey}:`, err);
      throw new Error(`Failed to read S3 object bytes for verification: ${err.message}`);
    }
  }

  /**
   * Upload a Buffer or Stream directly to S3 (backend-streamed upload)
   */
  public static async uploadBuffer(
    buffer: Buffer,
    objectKey: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<{ objectKey: string; size: number }> {
    const s3 = this.getS3Client();
    const bucket = this.getBucketName();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType,
      Metadata: metadata,
    });

    try {
      await s3.send(command);
      return {
        objectKey,
        size: buffer.length,
      };
    } catch (err: any) {
      console.error(`[StorageService] PutObject failed for key ${objectKey}:`, err);
      throw new Error(`S3 upload failed: ${err.message}`);
    }
  }

  /**
   * Delete an object from S3
   */
  public static async deleteObject(objectKey: string): Promise<boolean> {
    const s3 = this.getS3Client();
    const bucket = this.getBucketName();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    try {
      await s3.send(command);
      return true;
    } catch (err: any) {
      console.error(`[StorageService] DeleteObject failed for key ${objectKey}:`, err);
      throw new Error(`Failed to delete S3 object: ${err.message}`);
    }
  }

  /**
   * Administratively list objects under a prefix
   */
  public static async listObjects(prefix: string, maxKeys: number = 100): Promise<string[]> {
    const s3 = this.getS3Client();
    const bucket = this.getBucketName();

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    try {
      const response = await s3.send(command);
      return (response.Contents || []).map((item) => item.Key || "").filter(Boolean);
    } catch (err: any) {
      console.error(`[StorageService] ListObjects failed for prefix ${prefix}:`, err);
      throw new Error(`Failed to list S3 objects: ${err.message}`);
    }
  }

  // =========================================================================
  // BACKWARD-COMPATIBILITY ADAPTERS (Now S3 Native with MediaAsset Tracking)
  // =========================================================================

  /**
   * Upload PAX test report directly to AWS S3 & record MediaAsset
   */
  public static async uploadTestReport(
    fileStream: NodeJS.ReadableStream | Buffer,
    originalFilename: string,
    paxSerial: string,
    mimeType?: string,
    actorId?: string
  ): Promise<UploadResult> {
    let buffer: Buffer;
    if (Buffer.isBuffer(fileStream)) {
      buffer = fileStream;
    } else {
      const chunks: any[] = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
    }

    const ext = path.extname(originalFilename) || ".txt";
    const objectKey = this.generateObjectKey(MediaCategory.QUALITY_PAX_REPORT, originalFilename);
    const effectiveMime = mimeType || "application/octet-stream";

    await this.uploadBuffer(buffer, objectKey, effectiveMime);

    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        originalName: originalFilename,
        objectKey,
        bucket: this.getBucketName(),
        mimeType: effectiveMime,
        fileExtension: ext.toLowerCase(),
        fileSize: buffer.length,
        category: MediaCategory.QUALITY_PAX_REPORT,
        visibility: MediaVisibility.PRIVATE,
        status: MediaUploadStatus.COMPLETED,
        uploadedById: actorId || null,
        entityType: "pax",
        entityId: paxSerial,
      },
    });

    return {
      fileName: originalFilename,
      objectKey,
      mediaId: mediaAsset.id,
      url: `/media/${mediaAsset.id}/file`,
      storageDriver: "s3",
    };
  }

  /**
   * Upload Product Image directly to AWS S3 & record MediaAsset
   */
  public static async uploadProductImage(
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string,
    actorId?: string
  ): Promise<UploadResult> {
    const ext = path.extname(originalFilename).toLowerCase() || ".jpg";
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedMimes.includes(mimeType.toLowerCase())) {
      throw new Error(`Unsupported image format "${mimeType}". Only JPEG, PNG, and WebP are allowed.`);
    }

    if (fileBuffer.length > 10 * 1024 * 1024) {
      throw new Error("Product image exceeds the maximum limit of 10 MB.");
    }

    const objectKey = this.generateObjectKey(MediaCategory.PRODUCT_IMAGE, originalFilename);
    await this.uploadBuffer(fileBuffer, objectKey, mimeType);

    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        originalName: originalFilename,
        objectKey,
        bucket: this.getBucketName(),
        mimeType,
        fileExtension: ext,
        fileSize: fileBuffer.length,
        category: MediaCategory.PRODUCT_IMAGE,
        visibility: MediaVisibility.PUBLIC_CATALOG,
        status: MediaUploadStatus.COMPLETED,
        uploadedById: actorId || null,
        entityType: "product",
      },
    });

    return {
      fileName: originalFilename,
      objectKey,
      mediaId: mediaAsset.id,
      url: `/media/${mediaAsset.id}/file`,
      storageDriver: "s3",
    };
  }

  /**
   * Upload Purchase Order Attachment directly to AWS S3 & record MediaAsset
   */
  public static async uploadPOAttachment(
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string,
    actorId?: string,
    poId?: string
  ): Promise<UploadResult> {
    const ext = path.extname(originalFilename).toLowerCase() || ".pdf";
    if (fileBuffer.length > 25 * 1024 * 1024) {
      throw new Error("Attachment exceeds maximum limit of 25 MB.");
    }

    const objectKey = this.generateObjectKey(MediaCategory.PROCUREMENT_PO, originalFilename);
    const effectiveMime = mimeType || "application/octet-stream";

    await this.uploadBuffer(fileBuffer, objectKey, effectiveMime);

    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        originalName: originalFilename,
        objectKey,
        bucket: this.getBucketName(),
        mimeType: effectiveMime,
        fileExtension: ext,
        fileSize: fileBuffer.length,
        category: MediaCategory.PROCUREMENT_PO,
        visibility: MediaVisibility.PRIVATE,
        status: MediaUploadStatus.COMPLETED,
        uploadedById: actorId || null,
        entityType: "purchase_order",
        entityId: poId || null,
      },
    });

    return {
      fileName: originalFilename,
      objectKey,
      mediaId: mediaAsset.id,
      url: `/media/${mediaAsset.id}/file`,
      storageDriver: "s3",
    };
  }
}

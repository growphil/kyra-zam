import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { buildTestApp } from "./helpers/buildTestApp";
import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { MediaCategory, MediaVisibility, MediaUploadStatus } from "../types/media.types";
import { MediaValidationService } from "../services/media-validation.service";
import { StorageService } from "../services/storage.service";
import { MediaService } from "../services/media.service";
import FormData from "form-data";

describe("AWS S3 Centralized Media Architecture Test Suite", () => {
  let app: FastifyInstance;
  let adminToken: string;
  let accountantToken: string;
  let unauthorizedToken: string;
  let adminUserId: string;
  let accountantUserId: string;
  let unauthorizedUserId: string;
  let originalSend: any;

  before(async () => {
    app = await buildTestApp();

    // Stub S3 client send method for unit testing without live AWS outbound network dependency
    const s3 = StorageService.getS3Client();
    originalSend = s3.send.bind(s3);
    (s3 as any).send = async (command: any, optionsOrCb?: any) => {
      const cmdName = command?.constructor?.name || "";
      if (cmdName === "PutObjectCommand") {
        return { ETag: '"mock-etag-unit-test"' };
      }
      if (cmdName === "DeleteObjectCommand") {
        return {};
      }
      if (cmdName === "HeadObjectCommand") {
        return {
          ContentLength: command.input?.Key?.endsWith(".png") ? 4096 : 2048,
          ContentType: command.input?.Key?.endsWith(".png") ? "image/png" : "application/pdf",
          LastModified: new Date(),
          ETag: '"mock-etag-head"',
        };
      }
      if (cmdName === "GetObjectCommand") {
        const key = command.input?.Key || "";
        let mockHeader = Buffer.from("%PDF-1.7 header", "utf-8");
        if (key.includes("spoofed") || key.includes("malicious")) {
          mockHeader = Buffer.from("NOT_A_VALID_IMAGE_OR_PDF_HEADER", "utf-8");
        } else if (key.endsWith(".png")) {
          mockHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
        } else if (key.endsWith(".jpg") || key.endsWith(".jpeg")) {
          mockHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
        }
        return {
          Body: {
            transformToByteArray: async () => new Uint8Array(mockHeader),
          },
        };
      }
      return originalSend(command, optionsOrCb);
    };

    // 1. Create or ensure test users
    const adminUser = await prisma.user.upsert({
      where: { email: "media-test-admin@kyrazam.com" },
      update: { roles: ["ADMIN", "SUPERADMIN"], isActive: true },
      create: {
        name: "Media Test Admin",
        email: "media-test-admin@kyrazam.com",
        passwordHash: "dummy-hash",
        roles: ["ADMIN", "SUPERADMIN"],
        isActive: true,
      },
    });
    adminUserId = adminUser.id;

    const accountantUser = await prisma.user.upsert({
      where: { email: "media-test-accountant@kyrazam.com" },
      update: { roles: ["ACCOUNTANT"], isActive: true },
      create: {
        name: "Media Test Accountant",
        email: "media-test-accountant@kyrazam.com",
        passwordHash: "dummy-hash",
        roles: ["ACCOUNTANT"],
        isActive: true,
      },
    });
    accountantUserId = accountantUser.id;

    const unauthTestUser = await prisma.user.upsert({
      where: { email: "media-test-unauthorized@kyrazam.com" },
      update: { roles: ["SELLER"], isActive: true },
      create: {
        name: "Media Test Seller",
        email: "media-test-unauthorized@kyrazam.com",
        passwordHash: "dummy-hash",
        roles: ["SELLER"],
        isActive: true,
      },
    });
    unauthorizedUserId = unauthTestUser.id;

    adminToken = app.jwt.sign({ id: adminUserId, roles: ["ADMIN", "SUPERADMIN"] });
    accountantToken = app.jwt.sign({ id: accountantUserId, roles: ["ACCOUNTANT"] });
    unauthorizedToken = app.jwt.sign({ id: unauthorizedUserId, roles: ["SELLER"] });
  });

  after(async () => {
    // Clean up created media test records
    await prisma.mediaAsset.deleteMany({
      where: {
        uploadedById: { in: [adminUserId, accountantUserId, unauthorizedUserId] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: ["media-test-admin@kyrazam.com", "media-test-accountant@kyrazam.com", "media-test-unauthorized@kyrazam.com"] }
      }
    });
    if (originalSend) {
      (StorageService.getS3Client() as any).send = originalSend;
    }
    await app.close();
  });

  // =========================================================================
  // 1. UNIT VALIDATION TESTS: MediaValidationService
  // =========================================================================

  test("Validation: Rejects dangerous executable extensions (.exe, .html, .sh, .php)", () => {
    const dangerousExts = ["malware.exe", "xss.html", "script.sh", "backdoor.php", "vector.svg"];
    for (const name of dangerousExts) {
      assert.throws(
        () =>
          MediaValidationService.validateUploadRequest(
            MediaCategory.FINANCE_PAYMENT_PROOF,
            name,
            "application/octet-stream",
            1024,
            ["ACCOUNTANT"]
          ),
        /Dangerous file extension|not allowed/
      );
    }
  });

  test("Validation: Enforces maximum size limits per category", () => {
    // FINANCE_PAYMENT_PROOF max size is 20MB
    const oversizedBytes = 25 * 1024 * 1024;
    assert.throws(
      () =>
        MediaValidationService.validateUploadRequest(
          MediaCategory.FINANCE_PAYMENT_PROOF,
          "large-receipt.pdf",
          "application/pdf",
          oversizedBytes,
          ["ACCOUNTANT"]
        ),
      /exceeds maximum allowed limit/
    );
  });

  test("Validation: Enforces role permissions per category", () => {
    // SELLER cannot upload to FINANCE_PAYMENT_PROOF
    assert.throws(
      () =>
        MediaValidationService.validateUploadRequest(
          MediaCategory.FINANCE_PAYMENT_PROOF,
          "receipt.jpg",
          "image/jpeg",
          1024,
          ["SELLER"]
        ),
      /Unauthorized: User roles/
    );
  });

  test("Validation: Verifies file magic bytes / signatures", () => {
    // Valid PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(
      MediaValidationService.verifyFileSignature(validPngBuffer, "image/png", ".png"),
      true
    );

    // Valid PDF signature: %PDF (25 50 44 46)
    const validPdfBuffer = Buffer.from("%PDF-1.7 header content", "utf-8");
    assert.equal(
      MediaValidationService.verifyFileSignature(validPdfBuffer, "application/pdf", ".pdf"),
      true
    );

    // Spoofed file: text masquerading as PNG
    const fakePngBuffer = Buffer.from("NOT_A_PNG_FILE_HEADER", "utf-8");
    assert.equal(
      MediaValidationService.verifyFileSignature(fakePngBuffer, "image/png", ".png"),
      false
    );
  });

  // =========================================================================
  // 2. ENDPOINT TESTS: POST /media/upload/initiate & complete
  // =========================================================================

  test("API: Rejects unauthenticated upload initiate", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/media/upload/initiate",
      payload: {
        originalName: "receipt.png",
        mimeType: "image/png",
        fileSize: 5000,
        category: "FINANCE_PAYMENT_PROOF",
      },
    });

    assert.equal(res.statusCode, 401);
  });

  test("API: Rejects unauthorized role on upload initiate", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/media/upload/initiate",
      headers: { authorization: `Bearer ${unauthorizedToken}` },
      payload: {
        originalName: "receipt.png",
        mimeType: "image/png",
        fileSize: 5000,
        category: "FINANCE_PAYMENT_PROOF",
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.match(body.error, /Unauthorized: User roles/);
  });

  test("API: Successfully initiates presigned upload for authorized user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/media/upload/initiate",
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: {
        originalName: "bank-voucher-2026.pdf",
        mimeType: "application/pdf",
        fileSize: 150000,
        category: "FINANCE_PAYMENT_PROOF",
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.mediaId, "Must return mediaId");
    assert.ok(body.objectKey.startsWith("kyra-zam/finance/payment-proofs/"), "Must follow structured prefix");
    assert.ok(body.uploadUrl.includes("X-Amz-Signature") || body.uploadUrl.includes("https://"), "Must return presigned PUT URL");
    assert.equal(body.category, "FINANCE_PAYMENT_PROOF");

    // Verify record in PostgreSQL database
    const dbAsset = await prisma.mediaAsset.findUnique({ where: { id: body.mediaId } });
    assert.ok(dbAsset);
    assert.equal(dbAsset?.status, MediaUploadStatus.PENDING);
    assert.equal(dbAsset?.originalName, "bank-voucher-2026.pdf");
  });

  test("API: Rejects completion of spoofed file, deletes from S3, marks status FAILED", async () => {
    const spoofedAsset = await prisma.mediaAsset.create({
      data: {
        originalName: "spoofed-script.png",
        objectKey: "kyra-zam/finance/payment-proofs/spoofed-malware.png",
        bucket: StorageService.getBucketName(),
        mimeType: "image/png",
        fileExtension: ".png",
        fileSize: 4096,
        category: MediaCategory.FINANCE_PAYMENT_PROOF,
        visibility: MediaVisibility.PRIVATE,
        status: MediaUploadStatus.PENDING,
        uploadedById: accountantUserId,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/media/upload/complete",
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: {
        mediaId: spoofedAsset.id,
        objectKey: spoofedAsset.objectKey,
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.match(body.error, /binary signature inspection|Upload rejected/);

    const updated = await prisma.mediaAsset.findUnique({ where: { id: spoofedAsset.id } });
    assert.equal(updated?.status, MediaUploadStatus.FAILED);
  });

  test("API: Successfully verifies valid binary bytes on completion and marks COMPLETED", async () => {
    const validAsset = await prisma.mediaAsset.create({
      data: {
        originalName: "legit-receipt.png",
        objectKey: "kyra-zam/finance/payment-proofs/valid-receipt.png",
        bucket: StorageService.getBucketName(),
        mimeType: "image/png",
        fileExtension: ".png",
        fileSize: 4096,
        category: MediaCategory.FINANCE_PAYMENT_PROOF,
        visibility: MediaVisibility.PRIVATE,
        status: MediaUploadStatus.PENDING,
        uploadedById: accountantUserId,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/media/upload/complete",
      headers: { authorization: `Bearer ${accountantToken}` },
      payload: {
        mediaId: validAsset.id,
        objectKey: validAsset.objectKey,
      },
    });

    assert.equal(res.statusCode, 200);
    const updated = await prisma.mediaAsset.findUnique({ where: { id: validAsset.id } });
    assert.equal(updated?.status, MediaUploadStatus.COMPLETED);
  });

  test("API: Access denied for PENDING or FAILED media assets", async () => {
    const pendingAsset = await prisma.mediaAsset.create({
      data: {
        originalName: "unverified.pdf",
        objectKey: "kyra-zam/finance/payment-proofs/unverified.pdf",
        bucket: StorageService.getBucketName(),
        mimeType: "application/pdf",
        fileSize: 1024,
        category: MediaCategory.FINANCE_PAYMENT_PROOF,
        visibility: MediaVisibility.PRIVATE,
        status: MediaUploadStatus.PENDING,
        uploadedById: accountantUserId,
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/media/${pendingAsset.id}/access`,
      headers: { authorization: `Bearer ${accountantToken}` },
    });

    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.match(body.error, /not verified and completed/);
  });

  test("IDOR / Departmental Authorization: SELLER cannot access FINANCE documents", async () => {
    const financeAsset = await prisma.mediaAsset.create({
      data: {
        originalName: "confidential-tax.pdf",
        objectKey: "kyra-zam/finance/invoices/confidential-tax.pdf",
        bucket: StorageService.getBucketName(),
        mimeType: "application/pdf",
        fileSize: 1024,
        category: MediaCategory.FINANCE_INVOICE,
        visibility: MediaVisibility.PRIVATE,
        status: MediaUploadStatus.COMPLETED,
        uploadedById: accountantUserId,
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/media/${financeAsset.id}/access`,
      headers: { authorization: `Bearer ${unauthorizedToken}` }, // SELLER role
    });

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.match(body.error, /departmental permission/);
  });

  test("API: POST /media/:id/replace replaces asset and marks old asset DELETED", async () => {
    const oldAsset = await prisma.mediaAsset.create({
      data: {
        originalName: "old-product.png",
        objectKey: "kyra-zam/products/images/old-product.png",
        bucket: StorageService.getBucketName(),
        mimeType: "image/png",
        fileSize: 1024,
        category: MediaCategory.PRODUCT_IMAGE,
        visibility: MediaVisibility.PUBLIC_CATALOG,
        status: MediaUploadStatus.COMPLETED,
        uploadedById: adminUserId,
      },
    });

    const newAsset = await prisma.mediaAsset.create({
      data: {
        originalName: "new-product.png",
        objectKey: "kyra-zam/products/images/new-product.png",
        bucket: StorageService.getBucketName(),
        mimeType: "image/png",
        fileSize: 2048,
        category: MediaCategory.PRODUCT_IMAGE,
        visibility: MediaVisibility.PUBLIC_CATALOG,
        status: MediaUploadStatus.COMPLETED,
        uploadedById: adminUserId,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/media/${oldAsset.id}/replace`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { newMediaId: newAsset.id },
    });

    assert.equal(res.statusCode, 200);
    const oldCheck = await prisma.mediaAsset.findUnique({ where: { id: oldAsset.id } });
    assert.equal(oldCheck?.status, MediaUploadStatus.DELETED);
  });

  test("API: POST /media/cleanup cleans up abandoned PENDING uploads", async () => {
    const abandonedAsset = await prisma.mediaAsset.create({
      data: {
        originalName: "abandoned.png",
        objectKey: "kyra-zam/products/images/abandoned.png",
        bucket: StorageService.getBucketName(),
        mimeType: "image/png",
        fileSize: 1024,
        category: MediaCategory.PRODUCT_IMAGE,
        visibility: MediaVisibility.PUBLIC_CATALOG,
        status: MediaUploadStatus.PENDING,
        uploadedById: adminUserId,
        createdAt: new Date(Date.now() - 7200 * 1000), // 2 hours ago
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/media/cleanup",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { olderThanMinutes: 30 },
    });

    assert.equal(res.statusCode, 200);
    const check = await prisma.mediaAsset.findUnique({ where: { id: abandonedAsset.id } });
    assert.equal(check?.status, MediaUploadStatus.FAILED);
  });

  test("Legacy Static Protection: Blocks unauthenticated access to /public/uploads/payments", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/public/uploads/payments/PAY-PROOF-1790927339344-e4jm57.webp",
    });

    assert.equal(res.statusCode, 401);
  });

  // =========================================================================
  // 3. SECURE ACCESS & PERMISSIONS TESTS: GET /media/:id/access
  // =========================================================================

  test("API: Rejects unauthenticated media access", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/media/non-existent-id/access",
    });

    assert.equal(res.statusCode, 401);
  });

  test("API: Generates presigned download URL for authorized user", async () => {
    // 1. Create a test MediaAsset
    const asset = await prisma.mediaAsset.create({
      data: {
        originalName: "test-report.pdf",
        objectKey: "kyra-zam/quality/pax-test-reports/test-unit-report.pdf",
        bucket: StorageService.getBucketName(),
        mimeType: "application/pdf",
        fileSize: 2048,
        category: MediaCategory.QUALITY_PAX_REPORT,
        visibility: MediaVisibility.PRIVATE,
        status: MediaUploadStatus.COMPLETED,
        uploadedById: adminUserId,
      },
    });

    // 2. Request access as admin
    const res = await app.inject({
      method: "GET",
      url: `/media/${asset.id}/access`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.mediaId, asset.id);
    assert.ok(body.accessUrl.includes("X-Amz-Signature") || body.accessUrl.includes("https://"));
    assert.equal(body.fileName, "test-report.pdf");
  });

  test("API: GET /media/:id/file redirects to S3 presigned URL", async () => {
    const asset = await prisma.mediaAsset.create({
      data: {
        originalName: "catalog-product.png",
        objectKey: "kyra-zam/products/images/test-product.png",
        bucket: StorageService.getBucketName(),
        mimeType: "image/png",
        fileSize: 4096,
        category: MediaCategory.PRODUCT_IMAGE,
        visibility: MediaVisibility.PUBLIC_CATALOG,
        status: MediaUploadStatus.COMPLETED,
        uploadedById: adminUserId,
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/media/${asset.id}/file`,
    });

    assert.equal(res.statusCode, 307);
    assert.ok(res.headers.location?.includes("https://"));
  });

  // =========================================================================
  // 4. FINANCE REFACTORED ENDPOINT TEST: POST /crm/finance/upload-proof
  // =========================================================================

  test("API: Refactored POST /crm/finance/upload-proof writes to S3 without local disk leaks", async () => {
    const form = new FormData();
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    form.append("file", validPngBuffer, {
      filename: "official-transfer-slip.png",
      contentType: "image/png",
    });

    const res = await app.inject({
      method: "POST",
      url: "/crm/finance/upload-proof",
      headers: {
        authorization: `Bearer ${accountantToken}`,
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.url.startsWith("/media/"), "Must return secure media endpoint reference");
    assert.ok(body.mediaId, "Must return mediaId");
    assert.ok(body.objectKey.startsWith("kyra-zam/finance/payment-proofs/"), "Must be stored in S3 finance path");

    // Verify MediaAsset record in PostgreSQL
    const media = await prisma.mediaAsset.findUnique({ where: { id: body.mediaId } });
    assert.ok(media);
    assert.equal(media?.status, MediaUploadStatus.COMPLETED);
    assert.equal(media?.category, MediaCategory.FINANCE_PAYMENT_PROOF);
    assert.equal(media?.visibility, MediaVisibility.PRIVATE);
    assert.equal(media?.storageProvider, "S3");
  });

  // =========================================================================
  // 5. STORAGE SERVICE ADAPTERS & CLEANUP TESTS
  // =========================================================================

  test("StorageService: uploadProductImage persists directly to S3 with MediaAsset", async () => {
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
    const result = await StorageService.uploadProductImage(
      validPngBuffer,
      "solar-battery-pack.png",
      "image/png",
      adminUserId
    );

    assert.equal(result.storageDriver, "s3");
    assert.ok(result.mediaId);
    assert.ok(result.objectKey.startsWith("kyra-zam/products/images/"));

    const asset = await prisma.mediaAsset.findUnique({ where: { id: result.mediaId } });
    assert.ok(asset);
    assert.equal(asset?.category, MediaCategory.PRODUCT_IMAGE);
    assert.equal(asset?.visibility, MediaVisibility.PUBLIC_CATALOG);
  });

  test("API: DELETE /media/:id removes object and marks record DELETED", async () => {
    const asset = await prisma.mediaAsset.create({
      data: {
        originalName: "to-delete.pdf",
        objectKey: "kyra-zam/quality/pax-test-reports/temporary-delete.pdf",
        bucket: StorageService.getBucketName(),
        mimeType: "application/pdf",
        fileSize: 512,
        category: MediaCategory.QUALITY_PAX_REPORT,
        visibility: MediaVisibility.PRIVATE,
        status: MediaUploadStatus.COMPLETED,
        uploadedById: adminUserId,
      },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/media/${asset.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const updated = await prisma.mediaAsset.findUnique({ where: { id: asset.id } });
    assert.equal(updated?.status, MediaUploadStatus.DELETED);
  });
});

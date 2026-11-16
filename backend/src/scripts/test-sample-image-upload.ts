import { prisma } from "../prisma";
import { StorageService } from "../services/storage.service";
import { MediaService } from "../services/media.service";
import { MediaCategory, MediaVisibility, MediaUploadStatus } from "../types/media.types";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=================================================");
  console.log("   KYRA ZAM 2.0 — REAL AWS S3 IMAGE UPLOAD TEST   ");
  console.log("=================================================\n");

  const imagePath = path.resolve(__dirname, "../../../test-robot-avatar.png");
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found at ${imagePath}`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  console.log(`[1] Loaded image: test-robot-avatar.png (${imageBuffer.length} bytes)`);

  // Verify binary signature locally first
  const isPng = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4e && imageBuffer[3] === 0x47;
  console.log(`    PNG magic byte signature verified: ${isPng}\n`);

  // 2. Fetch actor
  const admin = await prisma.user.findFirst({
    where: { roles: { has: "ADMIN" } },
    select: { id: true, name: true, roles: true, email: true },
  });

  const actor = admin || {
    id: "system-test-user",
    roles: ["ADMIN", "SUPERADMIN"],
    name: "System Admin",
    email: "admin@kyrazam.com",
  };

  console.log(`[2] Executing as Actor: ${actor.name} (${actor.email})\n`);

  // 3. Initiate Media Upload via MediaService (Step 1)
  console.log("[3] Initiating S3 Upload Authorization (Step 1)...");
  const initResult = await MediaService.initiateUpload(
    {
      originalName: "robot-avatar.png",
      mimeType: "image/png",
      fileSize: imageBuffer.length,
      category: MediaCategory.PRODUCT_IMAGE,
      visibility: MediaVisibility.PUBLIC_CATALOG,
      entityType: "product",
    },
    actor
  );

  console.log("    Media Asset ID:", initResult.mediaId);
  console.log("    S3 Object Key :", initResult.objectKey);
  console.log("    S3 Bucket     :", initResult.bucket);
  console.log("    Presigned PUT :", initResult.uploadUrl.substring(0, 90) + "...\n");

  // 4. Upload directly to live AWS S3 using StorageService.uploadBuffer (Step 2)
  console.log("[4] Uploading real binary payload directly to AWS S3 bucket: kyra-zam-media-prod...");
  const uploadResult = await StorageService.uploadBuffer(
    imageBuffer,
    initResult.objectKey,
    "image/png"
  );
  console.log("    ✅ Direct AWS S3 Upload SUCCESS!");
  console.log("    Confirmed Object Key:", uploadResult.objectKey);
  console.log("    Uploaded Size       :", uploadResult.size, "bytes\n");

  // 5. Complete & Validate Upload (Step 3: HeadObject + GetObject binary byte validation)
  console.log("[5] Completing upload & verifying actual S3 binary bytes via GetObjectCommand...");
  const completedAsset = await MediaService.completeUpload(
    {
      mediaId: initResult.mediaId,
      objectKey: initResult.objectKey,
    },
    actor
  );

  console.log("    ✅ Byte Verification PASSED!");
  console.log("    Upload Status :", completedAsset.status);
  console.log("    Verified Size :", completedAsset.fileSize, "bytes");
  console.log("    Verified MIME :", completedAsset.mimeType);
  console.log("    Database ID   :", completedAsset.id, "\n");

  // 6. Test Secure Access Retrieval (Presigned GET URL)
  console.log("[6] Generating S3 Presigned Download Access URL...");
  const access = await MediaService.getMediaAccess(completedAsset.id, actor, 3600);
  console.log("    Access URL    :", access.accessUrl);
  console.log("    Expires in    :", access.expiresInSeconds, "seconds");
  console.log("    File Stream   : /media/" + completedAsset.id + "/file\n");

  console.log("=================================================");
  console.log("   🎉 REAL AWS S3 UPLOAD SUCCEEDED 100%!         ");
  console.log("   Image is live and persisted in S3 bucket!     ");
  console.log("=================================================");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});

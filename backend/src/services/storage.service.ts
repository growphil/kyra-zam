import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const pump = promisify(pipeline);

export interface UploadResult {
  fileName: string;
  url: string;
  filePath?: string;
  storageDriver: "local" | "s3";
}

export class StorageService {
  private static localUploadBase = path.join(__dirname, "../../public/uploads");
  private static s3Client: S3Client | null = null;

  /**
   * Lazily initialize S3Client using environment configuration
   */
  private static getS3Client(): S3Client | null {
    if (this.s3Client) return this.s3Client;

    const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET;
    const region = process.env.AWS_REGION || "us-east-1";

    if (!bucket) return null;

    const config: any = { region };

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    if (process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT) {
      config.endpoint = process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT;
      config.forcePathStyle = true;
    }

    this.s3Client = new S3Client(config);
    return this.s3Client;
  }

  /**
   * Check if S3 storage driver is configured and enabled
   */
  public static isS3Enabled(): boolean {
    const driver = process.env.STORAGE_DRIVER?.toLowerCase();
    const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET;
    return driver === "s3" && !!bucket;
  }

  /**
   * Upload test report to local uploads folder (default) or AWS S3 bucket (when configured)
   */
  public static async uploadTestReport(
    fileStream: NodeJS.ReadableStream | Buffer,
    originalFilename: string,
    paxSerial: string,
    mimeType?: string
  ): Promise<UploadResult> {
    const ext = path.extname(originalFilename) || ".txt";
    const sanitizedSerial = paxSerial.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${sanitizedSerial}-${Date.now()}${ext}`;

    // S3 Storage Driver
    if (this.isS3Enabled()) {
      const s3 = this.getS3Client();
      const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET!;
      const region = process.env.AWS_REGION || "us-east-1";
      const key = `reports/${fileName}`;

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

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType || "application/octet-stream",
      });

      await s3!.send(command);

      const s3Url = process.env.S3_PUBLIC_URL_PREFIX
        ? `${process.env.S3_PUBLIC_URL_PREFIX.replace(/\/$/, "")}/${key}`
        : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

      return {
        fileName,
        url: s3Url,
        storageDriver: "s3",
      };
    }

    // Default: Local uploads folder in public/uploads/reports
    const uploadDir = path.join(this.localUploadBase, "reports");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);

    if (Buffer.isBuffer(fileStream)) {
      await fs.promises.writeFile(filePath, fileStream);
    } else {
      await pump(fileStream, fs.createWriteStream(filePath));
    }

    const localUrl = `/public/uploads/reports/${fileName}`;

    return {
      fileName,
      filePath,
      url: localUrl,
      storageDriver: "local",
    };
  }
}

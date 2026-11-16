import path from "path";
import { MediaCategory, MediaVisibility, CategoryUploadRule } from "../types/media.types";

export class MediaValidationService {
  private static readonly BLOCKED_EXTENSIONS = new Set([
    ".html", ".htm", ".xhtml", ".svg", ".xml",
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs",
    ".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx",
    ".php", ".phtml", ".php3", ".php4", ".php5", ".phps",
    ".py", ".pyc", ".rb", ".pl", ".cgi",
    ".jar", ".war", ".ear", ".jsp", ".jspx",
    ".dll", ".so", ".dylib", ".scr", ".com", ".msi"
  ]);

  private static readonly CATEGORY_RULES: Record<MediaCategory, CategoryUploadRule> = {
    [MediaCategory.PRODUCT_IMAGE]: {
      allowedMimes: ["image/jpeg", "image/png", "image/webp"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
      maxSizeBytes: 10 * 1024 * 1024, // 10MB
      defaultVisibility: MediaVisibility.PUBLIC_CATALOG,
      s3Prefix: "kyra-zam/products/images",
      allowedRoles: ["PURCHASE_MANAGER", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.PRODUCT_GALLERY]: {
      allowedMimes: ["image/jpeg", "image/png", "image/webp"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
      maxSizeBytes: 10 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PUBLIC_CATALOG,
      s3Prefix: "kyra-zam/products/gallery",
      allowedRoles: ["PURCHASE_MANAGER", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.MATERIAL_IMAGE]: {
      allowedMimes: ["image/jpeg", "image/png", "image/webp"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
      maxSizeBytes: 10 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PUBLIC_CATALOG,
      s3Prefix: "kyra-zam/materials/images",
      allowedRoles: ["INVENTORY_MANAGER", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.EMPLOYEE_PROFILE]: {
      allowedMimes: ["image/jpeg", "image/png", "image/webp"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
      maxSizeBytes: 5 * 1024 * 1024,
      defaultVisibility: MediaVisibility.RESTRICTED,
      s3Prefix: "kyra-zam/employees/profiles",
      allowedRoles: ["HR_PAYROLL", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.EMPLOYEE_DOCUMENT]: {
      allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/employees/documents",
      allowedRoles: ["HR_PAYROLL", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.FINANCE_PAYMENT_PROOF]: {
      allowedMimes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/finance/payment-proofs",
      allowedRoles: ["ACCOUNTANT", "SALES_EXECUTIVE", "MARKETING_MANAGER", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.FINANCE_INVOICE]: {
      allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/finance/invoices",
      allowedRoles: ["ACCOUNTANT", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.FINANCE_RECEIPT]: {
      allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/finance/receipts",
      allowedRoles: ["ACCOUNTANT", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.PROCUREMENT_PO]: {
      allowedMimes: [
        "application/pdf", "image/jpeg", "image/png",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".xlsx"],
      maxSizeBytes: 25 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/procurement/purchase-orders",
      allowedRoles: ["PURCHASE_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.PROCUREMENT_GRN]: {
      allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/procurement/goods-receipts",
      allowedRoles: ["INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.PROCUREMENT_SUPPLIER_INVOICE]: {
      allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/procurement/supplier-invoices",
      allowedRoles: ["PURCHASE_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.PROCUREMENT_INVOICE_ORDER]: {
      allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/procurement/invoice-orders",
      allowedRoles: ["PURCHASE_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.PRODUCTION_JOB_CARD]: {
      allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/production/job-cards",
      allowedRoles: ["SUPERVISOR", "ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.PRODUCTION_REPORT]: {
      allowedMimes: ["application/pdf", "text/plain", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".txt", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/production/reports",
      allowedRoles: ["SUPERVISOR", "ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.QUALITY_PAX_REPORT]: {
      allowedMimes: ["application/pdf", "text/plain", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".txt", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 25 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/quality/pax-test-reports",
      allowedRoles: ["PAX_TEST_ENGINEER", "TEST_ENGINEER", "SUPERVISOR", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.QUALITY_INSPECTION]: {
      allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/quality/inspection-reports",
      allowedRoles: ["QC", "TEST_ENGINEER", "SUPERVISOR", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.SERVICE_RMA]: {
      allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/service/rma",
      allowedRoles: ["SUPERVISOR", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.SERVICE_BATTERY_PHOTO]: {
      allowedMimes: ["image/jpeg", "image/png", "image/webp"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
      maxSizeBytes: 10 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/service/battery-photos",
      allowedRoles: ["SUPERVISOR", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.SERVICE_REPORT]: {
      allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/service/test-reports",
      allowedRoles: ["SUPERVISOR", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.INVENTORY_SCRAP]: {
      allowedMimes: ["image/jpeg", "image/png", "application/pdf"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".pdf"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/inventory/scrap",
      allowedRoles: ["INVENTORY_MANAGER", "SUPERVISOR", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.DISPATCH_POD]: {
      allowedMimes: ["image/jpeg", "image/png", "application/pdf"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".pdf"],
      maxSizeBytes: 20 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/dispatch/proof-of-delivery",
      allowedRoles: ["PACKING_OPERATOR", "SUPERVISOR", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.DISPATCH_SIGNATURE]: {
      allowedMimes: ["image/png", "image/jpeg"],
      allowedExtensions: [".png", ".jpg", ".jpeg"],
      maxSizeBytes: 5 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/dispatch/signatures",
      allowedRoles: ["PACKING_OPERATOR", "SUPERVISOR", "ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    },
    [MediaCategory.GENERAL_ATTACHMENT]: {
      allowedMimes: [
        "application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ],
      allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".txt", ".docx", ".xlsx"],
      maxSizeBytes: 25 * 1024 * 1024,
      defaultVisibility: MediaVisibility.PRIVATE,
      s3Prefix: "kyra-zam/general/attachments",
      allowedRoles: ["ADMIN", "SUPERADMIN", "ULTRA_ADMIN"]
    }
  };

  public static getRule(category: MediaCategory): CategoryUploadRule {
    const rule = this.CATEGORY_RULES[category];
    if (!rule) {
      throw new Error(`Unsupported media category: "${category}"`);
    }
    return rule;
  }

  public static validateUploadRequest(
    category: MediaCategory,
    originalName: string,
    mimeType: string,
    fileSize: number,
    userRoles: string[]
  ): { sanitizedExt: string; rule: CategoryUploadRule } {
    const rule = this.getRule(category);

    // 1. Role validation
    const hasRole = userRoles.some(r => r === "SUPERADMIN" || r === "ADMIN" || rule.allowedRoles.includes(r));
    if (!hasRole) {
      throw new Error(`Unauthorized: User roles [${userRoles.join(", ")}] not permitted to upload to category "${category}"`);
    }

    // 2. Extension validation
    const ext = path.extname(originalName).toLowerCase();
    if (!ext) {
      throw new Error("File must have a valid file extension.");
    }

    if (this.BLOCKED_EXTENSIONS.has(ext)) {
      throw new Error(`Dangerous file extension "${ext}" is strictly blocked.`);
    }

    if (!rule.allowedExtensions.includes(ext)) {
      throw new Error(`Extension "${ext}" is not allowed for category "${category}". Allowed: ${rule.allowedExtensions.join(", ")}`);
    }

    // 3. MIME type validation
    const normalizedMime = mimeType.toLowerCase().trim();
    if (!rule.allowedMimes.includes(normalizedMime)) {
      throw new Error(`MIME type "${mimeType}" is not allowed for category "${category}". Allowed: ${rule.allowedMimes.join(", ")}`);
    }

    // 4. File size validation
    if (fileSize <= 0) {
      throw new Error("File size must be greater than 0 bytes.");
    }

    if (fileSize > rule.maxSizeBytes) {
      const maxMb = (rule.maxSizeBytes / (1024 * 1024)).toFixed(1);
      const actualMb = (fileSize / (1024 * 1024)).toFixed(1);
      throw new Error(`File size (${actualMb} MB) exceeds maximum allowed limit of ${maxMb} MB for category "${category}".`);
    }

    return { sanitizedExt: ext, rule };
  }

  /**
   * Verify buffer magic bytes / file signatures to prevent Content-Type spoofing
   */
  public static verifyFileSignature(buffer: Buffer, expectedMime: string, ext: string): boolean {
    if (!buffer || buffer.length < 4) return false;

    const mime = expectedMime.toLowerCase();

    // JPEG: FF D8 FF
    if (mime === "image/jpeg" || ext === ".jpg" || ext === ".jpeg") {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (mime === "image/png" || ext === ".png") {
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    }

    // WebP: RIFF .... WEBP
    if (mime === "image/webp" || ext === ".webp") {
      if (buffer.length < 12) return false;
      const isRiff = buffer.subarray(0, 4).toString("ascii") === "RIFF";
      const isWebp = buffer.subarray(8, 12).toString("ascii") === "WEBP";
      return isRiff && isWebp;
    }

    // PDF: %PDF (25 50 44 46)
    if (mime === "application/pdf" || ext === ".pdf") {
      return buffer.subarray(0, 4).toString("ascii") === "%PDF";
    }

    // ZIP based (Office Open XML: docx, xlsx): PK\x03\x04 (50 4B 03 04)
    if (
      mime.includes("officedocument") ||
      mime.includes("zip") ||
      ext === ".docx" ||
      ext === ".xlsx"
    ) {
      const isZip =
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04;
      if (!isZip) return false;

      // Verify Office XML container signatures within initial chunk
      const textSample = buffer.toString("binary");
      const hasOfficeXml =
        textSample.includes("[Content_Types].xml") ||
        textSample.includes("word/") ||
        textSample.includes("xl/") ||
        textSample.includes("_rels/");
      return hasOfficeXml;
    }

    // Text files
    if (mime === "text/plain" || ext === ".txt") {
      // Check for binary null bytes in initial sample
      const sample = buffer.subarray(0, Math.min(buffer.length, 512));
      if (sample.includes(0x00)) return false;

      // Check for dangerous script or markup injection in text files
      const textStr = sample.toString("utf-8").toLowerCase();
      if (
        textStr.includes("<script") ||
        textStr.includes("<html") ||
        textStr.includes("<svg") ||
        textStr.includes("<?php") ||
        textStr.includes("<%")
      ) {
        return false;
      }
      return true;
    }

    return true;
  }
}


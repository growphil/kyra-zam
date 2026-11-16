import { MediaCategory, MediaVisibility, MediaUploadStatus } from "../generated/client";

export { MediaCategory, MediaVisibility, MediaUploadStatus };

export interface CategoryUploadRule {
  allowedMimes: string[];
  allowedExtensions: string[];
  maxSizeBytes: number;
  defaultVisibility: MediaVisibility;
  s3Prefix: string;
  allowedRoles: string[];
}

export interface InitiateUploadInput {
  originalName: string;
  mimeType: string;
  fileSize: number;
  category: MediaCategory;
  visibility?: MediaVisibility;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

export interface InitiateUploadResponse {
  mediaId: string;
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  bucket: string;
  mimeType: string;
  category: MediaCategory;
}

export interface CompleteUploadInput {
  mediaId: string;
  objectKey: string;
}

export interface MediaAccessResponse {
  mediaId: string;
  accessUrl: string;
  expiresInSeconds: number;
  mimeType: string;
  fileName: string;
  fileSize: number | null;
  category: MediaCategory;
}

export interface UploadStreamOptions {
  category: MediaCategory;
  originalName: string;
  mimeType: string;
  entityType?: string;
  entityId?: string;
  uploadedById?: string;
  visibility?: MediaVisibility;
}


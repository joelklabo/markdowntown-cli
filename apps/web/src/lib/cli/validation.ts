import path from "node:path";
import type { ManifestEntryInput } from "@/lib/cli/upload";
import { MAX_BLOB_BYTES, MAX_SNAPSHOT_FILES, MAX_SNAPSHOT_FILE_BYTES, MAX_SNAPSHOT_TOTAL_BYTES } from "@/lib/validation";

const SHA256_REGEX = /^[a-f0-9]{64}$/i;
const MIME_TYPE_REGEX = /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/;

export type BlobValidationInput = {
  sha256: string;
  sizeBytes: number;
  contentType?: string | null;
};

export function validateUploadManifest(entries: ManifestEntryInput[]): string | null {
  if (entries.length > MAX_SNAPSHOT_FILES) {
    return `Snapshot exceeds file limit (max ${MAX_SNAPSHOT_FILES})`;
  }

  let totalBytes = 0;
  for (const entry of entries) {
    const pathError = validateUploadPath(entry.path);
    if (pathError) {
      return pathError;
    }

    const hashError = validateBlobHash(entry.blobHash);
    if (hashError) {
      return hashError;
    }

    const contentTypeError = validateContentType(entry.contentType);
    if (contentTypeError) {
      return contentTypeError;
    }

    if (entry.isDeleted && entry.sizeBytes > 0) {
      return `Deleted entry must have size 0 (${entry.path})`;
    }

    if (!entry.isDeleted && entry.sizeBytes > MAX_SNAPSHOT_FILE_BYTES) {
      return `File too large (${entry.path}); max ${MAX_SNAPSHOT_FILE_BYTES} bytes`;
    }

    totalBytes += entry.sizeBytes;
    if (totalBytes > MAX_SNAPSHOT_TOTAL_BYTES) {
      return `Snapshot exceeds total size limit (max ${MAX_SNAPSHOT_TOTAL_BYTES} bytes)`;
    }
  }

  return null;
}

export function validateBlobUpload(input: BlobValidationInput): string | null {
  const hashError = validateBlobHash(input.sha256);
  if (hashError) {
    return hashError;
  }

  if (input.sizeBytes > MAX_BLOB_BYTES) {
    return `Blob exceeds size limit (max ${MAX_BLOB_BYTES} bytes)`;
  }

  const contentTypeError = validateContentType(input.contentType);
  if (contentTypeError) {
    return contentTypeError;
  }

  return null;
}

function validateUploadPath(value: string): string | null {
  const cleaned = value.replace(/\\/g, "/").trim();
  if (!cleaned) {
    return "Path is required";
  }
  if (cleaned.includes("\0") || cleaned.includes("\n") || cleaned.includes("\r")) {
    return "Path contains invalid characters";
  }
  if (cleaned.startsWith("/") || cleaned.startsWith("\\")) {
    return "Path must be relative";
  }
  if (/^[A-Za-z]:/.test(cleaned)) {
    return "Path must be relative";
  }
  if (/(^|\/)\.\.(\/|$)/.test(cleaned)) {
    return "Path traversal detected";
  }

  const normalized = path.posix.normalize(cleaned);
  if (normalized.startsWith("..") || normalized === ".") {
    return "Path traversal detected";
  }

  return null;
}

function validateBlobHash(value: string): string | null {
  if (!SHA256_REGEX.test(value)) {
    return "Invalid blob hash";
  }
  return null;
}

function validateContentType(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) {
    return "Invalid content type";
  }
  if (trimmed.includes("\n") || trimmed.includes("\r")) {
    return "Invalid content type";
  }
  const [type] = trimmed.split(";");
  if (!MIME_TYPE_REGEX.test(type.trim())) {
    return "Invalid content type";
  }
  return null;
}

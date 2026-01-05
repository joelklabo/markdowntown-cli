import path from "node:path";
import type { ManifestEntryInput } from "@/lib/cli/upload";
import { MAX_BLOB_BYTES, MAX_SNAPSHOT_FILES, MAX_SNAPSHOT_FILE_BYTES, MAX_SNAPSHOT_TOTAL_BYTES } from "@/lib/validation";

const SHA256_REGEX = /^[a-f0-9]{64}$/i;
const MIME_TYPE_REGEX = /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/;

// Extensions that are typically not useful for this application or potentially harmful if served directly
const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".iso",
  ".img",
  ".dmg",
  ".jar", // Java archives
  ".class", // Java bytecode
]);

// Magic number signatures for common file types (first N bytes)
const MAGIC_NUMBERS: Record<string, { mime: string[]; signature: number[][] }> = {
  // Images
  png: { mime: ["image/png"], signature: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  jpeg: { mime: ["image/jpeg"], signature: [[0xff, 0xd8, 0xff]] },
  gif: { mime: ["image/gif"], signature: [[0x47, 0x49, 0x46, 0x38]] }, // GIF8
  webp: { mime: ["image/webp"], signature: [[0x52, 0x49, 0x46, 0x46]] }, // RIFF (check for WEBP at offset 8)
  svg: { mime: ["image/svg+xml"], signature: [] }, // SVG is XML-based, no binary magic

  // Text formats (UTF-8 BOM or printable ASCII)
  text: { mime: ["text/plain", "text/markdown", "text/csv"], signature: [] },
  json: { mime: ["application/json"], signature: [] },
  xml: { mime: ["application/xml", "text/xml"], signature: [] },
  yaml: { mime: ["application/x-yaml", "text/yaml"], signature: [] },

  // Archives
  zip: { mime: ["application/zip"], signature: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]] },
  gzip: { mime: ["application/gzip"], signature: [[0x1f, 0x8b]] },
  tar: { mime: ["application/x-tar"], signature: [] }, // TAR has no magic at start

  // Documents
  pdf: { mime: ["application/pdf"], signature: [[0x25, 0x50, 0x44, 0x46]] }, // %PDF

  // Executables (blocked by extension check, but also detected)
  exe: { mime: ["application/x-msdownload"], signature: [[0x4d, 0x5a]] }, // MZ
  elf: { mime: ["application/x-elf"], signature: [[0x7f, 0x45, 0x4c, 0x46]] }, // ELF
  mach: { mime: ["application/x-mach-binary"], signature: [[0xcf, 0xfa, 0xed, 0xfe], [0xce, 0xfa, 0xed, 0xfe]] },
};

// MIME types that are allowed (allowlist approach)
const ALLOWED_MIME_TYPES = new Set([
  // Text formats
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/yaml",
  "text/x-yaml",
  "application/x-yaml",
  "application/json",
  "application/xml",
  "text/xml",
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/typescript",

  // Images
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",

  // Documents
  "application/pdf",

  // Archives
  "application/zip",
  "application/gzip",
  "application/x-tar",

  // Binary data (generic)
  "application/octet-stream",
]);

export type BlobValidationInput = {
  sha256: string;
  sizeBytes: number;
  contentType?: string | null;
  path?: string | null;
  content?: Buffer | null;
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

    const extError = validateExtension(entry.path);
    if (extError) {
      return extError;
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

  if (input.path) {
    const extError = validateExtension(input.path);
    if (extError) return extError;
  }

  // Magic number validation if content is provided
  if (input.content && input.contentType) {
    const magicError = validateMagicNumber(input.content, input.contentType);
    if (magicError) return magicError;
  }

  return null;
}

/**
 * Validate that the content matches the declared MIME type using magic number signatures.
 * Returns error message if mismatch detected, null if valid.
 */
function validateMagicNumber(content: Buffer, declaredMime: string): string | null {
  // Skip validation for empty files
  if (content.length === 0) {
    return null;
  }

  // Extract base MIME type without parameters
  const [baseMime] = declaredMime.split(";").map((s) => s.trim().toLowerCase());

  // Check if MIME type is allowed
  if (!ALLOWED_MIME_TYPES.has(baseMime)) {
    return `Unsupported content type: ${baseMime}`;
  }

  // For text-based types, allow if content appears to be text
  if (baseMime.startsWith("text/") || baseMime.includes("json") || baseMime.includes("xml") || baseMime.includes("yaml") || baseMime.includes("javascript") || baseMime.includes("typescript")) {
    return isLikelyTextContent(content) ? null : `Content does not match declared type ${baseMime}`;
  }

  // Check binary magic numbers
  for (const [fileType, { mime, signature }] of Object.entries(MAGIC_NUMBERS)) {
    if (!mime.includes(baseMime)) continue;

    // If no signature defined, skip magic number check
    if (signature.length === 0) continue;

    // Check if any signature matches
    const matches = signature.some((sig) => {
      if (content.length < sig.length) return false;
      return sig.every((byte, i) => content[i] === byte);
    });

    if (!matches) {
      return `Content magic number does not match declared type ${baseMime}`;
    }

    // Special case: WEBP needs additional check at offset 8
    if (fileType === "webp" && content.length >= 12) {
      const webpSig = Buffer.from("WEBP", "ascii");
      if (!content.subarray(8, 12).equals(webpSig)) {
        return `Content magic number does not match declared type ${baseMime}`;
      }
    }

    return null; // Valid
  }

  // If we reach here and it's a binary type without a defined signature, allow it
  // (e.g., application/octet-stream, TAR files)
  return null;
}

/**
 * Heuristic to check if content appears to be text (UTF-8 or ASCII).
 * Returns true if content looks like text, false otherwise.
 */
function isLikelyTextContent(content: Buffer): boolean {
  const sampleSize = Math.min(content.length, 512);
  const sample = content.subarray(0, sampleSize);

  // Check for null bytes (common in binary files)
  if (sample.includes(0)) {
    return false;
  }

  // Count control characters (excluding common whitespace)
  let controlChars = 0;
  let printableChars = 0;

  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];

    // Common whitespace: tab, newline, carriage return, space
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x20) {
      printableChars++;
      continue;
    }

    // Control characters (0x00-0x1F and 0x7F)
    if (byte < 0x20 || byte === 0x7f) {
      controlChars++;
      continue;
    }

    // Printable ASCII (0x20-0x7E) or high-bit set (UTF-8 multi-byte)
    if ((byte >= 0x20 && byte <= 0x7e) || byte >= 0x80) {
      printableChars++;
    }
  }

  // If more than 5% control characters (excluding whitespace), likely binary
  const controlRatio = controlChars / Math.max(1, sample.length);
  return controlRatio < 0.05 && printableChars > 0;
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

function validateExtension(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `File extension not allowed: ${ext}`;
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

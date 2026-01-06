export type BlobStorePutInput = {
  sha256: string;
  sizeBytes: number;
  content: Buffer;
  contentType?: string | null;
};

export type BlobStorePutResult = {
  storageKey: string | null;
};

export type BlobStore = {
  putBlob(input: BlobStorePutInput): Promise<BlobStorePutResult>;
  getBlob(sha256: string): Promise<Buffer | null>;
  deleteBlob(sha256: string): Promise<void>;
};

export type ExistingBlobState = {
  content: Buffer | null;
  storageKey: string | null;
} | null;

export function shouldWriteBlob(existing: ExistingBlobState): boolean {
  return !existing || (!existing.content && !existing.storageKey);
}

const STORAGE_PREFIX = "cli/blobs";

/**
 * Validates a blob storage key (hash).
 * Keys must be lowercase hex strings (SHA-256 = 64 chars).
 * Rejects path traversal, unsafe characters, and invalid formats.
 */
export function validateBlobKey(key: string): void {
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("Invalid blob key: must be a non-empty string");
  }
  // SHA-256 hex is 64 lowercase hex characters
  if (!/^[a-f0-9]{64}$/.test(key)) {
    throw new Error("Invalid blob key: expected 64 character lowercase hex (SHA-256)");
  }
  // Additional safety: reject path traversal patterns
  if (key.includes("..") || key.includes("/") || key.includes("\\")) {
    throw new Error("Invalid blob key: contains path traversal characters");
  }
}

export function storageKeyForHash(hash: string): string {
  validateBlobKey(hash);
  return `${STORAGE_PREFIX}/${hash}`;
}

export type BlobFetchResult = {
  content: Buffer;
  source: "primary" | "secondary";
};

/**
 * Creates a blob store with fallback capability.
 * If primary returns null or throws, falls back to secondary.
 */
export function createFallbackBlobStore(
  primary: BlobStore,
  secondary: BlobStore | null,
  log?: (message: string) => void,
): BlobStore {
  const logger = log ?? (() => {});

  return {
    async putBlob(input: BlobStorePutInput): Promise<BlobStorePutResult> {
      // Writes always go to primary
      return primary.putBlob(input);
    },

    async getBlob(sha256: string): Promise<Buffer | null> {
      // Try primary first
      try {
        const result = await primary.getBlob(sha256);
        if (result !== null) {
          logger(`blob:${sha256.slice(0, 8)} served from primary`);
          return result;
        }
      } catch (error) {
        // Log primary error but continue to fallback
        const message = error instanceof Error ? error.message : String(error);
        logger(`blob:${sha256.slice(0, 8)} primary error: ${message}`);
      }

      // Try secondary if available
      if (secondary) {
        try {
          const result = await secondary.getBlob(sha256);
          if (result !== null) {
            logger(`blob:${sha256.slice(0, 8)} served from secondary (fallback)`);
            return result;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger(`blob:${sha256.slice(0, 8)} secondary error: ${message}`);
        }
      }

      logger(`blob:${sha256.slice(0, 8)} not found in any store`);
      return null;
    },

    async deleteBlob(sha256: string): Promise<void> {
      // Delete from primary; secondary cleanup is optional
      await primary.deleteBlob(sha256);
      if (secondary) {
        try {
          await secondary.deleteBlob(sha256);
        } catch {
          // Ignore secondary delete failures during migration
        }
      }
    },
  };
}

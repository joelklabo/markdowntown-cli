import type { BlobStore } from "@/lib/storage/blobStore";
import { createFallbackBlobStore } from "@/lib/storage/blobStore";
import { createAzureBlobStore, isAzureBlobStoreConfigured } from "@/lib/storage/azureBlobStore";
import { createDbBlobStore, isDbBlobStoreConfigured } from "@/lib/storage/dbBlobStore";

/** Environment variable to select primary blob store: 'azure' | 'db' */
const PRIMARY_STORE_ENV = "BLOB_STORE_PRIMARY";
/** Environment variable to enable fallback: '1' | 'true' */
const FALLBACK_ENABLED_ENV = "BLOB_STORE_FALLBACK";

type StoreType = "azure" | "db";

function getConfiguredPrimary(): StoreType {
  const value = process.env[PRIMARY_STORE_ENV]?.toLowerCase();
  if (value === "db") return "db";
  if (value === "azure") return "azure";
  // Default: prefer Azure if configured, otherwise DB
  if (isAzureBlobStoreConfigured()) return "azure";
  if (isDbBlobStoreConfigured()) return "db";
  throw new Error("No blob storage configured");
}

function isFallbackEnabled(): boolean {
  const value = process.env[FALLBACK_ENABLED_ENV]?.toLowerCase();
  return value === "1" || value === "true";
}

function createStoreByType(type: StoreType): BlobStore | null {
  switch (type) {
    case "azure":
      return isAzureBlobStoreConfigured() ? createAzureBlobStore() : null;
    case "db":
      return isDbBlobStoreConfigured() ? createDbBlobStore() : null;
  }
}

function blobStoreLogger(message: string): void {
  // Log to console for observability; can be replaced with structured logging
  console.log(`[blob-store] ${message}`);
}

let cachedStore: BlobStore | null = null;

export function getBlobStore(): BlobStore {
  if (cachedStore) return cachedStore;

  const primaryType = getConfiguredPrimary();
  const primary = createStoreByType(primaryType);

  if (!primary) {
    throw new Error("No blob storage configured");
  }

  // If fallback is enabled, create secondary store of the other type
  if (isFallbackEnabled()) {
    const secondaryType: StoreType = primaryType === "azure" ? "db" : "azure";
    const secondary = createStoreByType(secondaryType);

    if (secondary) {
      cachedStore = createFallbackBlobStore(primary, secondary, blobStoreLogger);
      return cachedStore;
    }
  }

  // No fallback, use primary directly
  cachedStore = primary;
  return cachedStore;
}

/** Reset cached store (for testing) */
export function resetBlobStoreCache(): void {
  cachedStore = null;
}

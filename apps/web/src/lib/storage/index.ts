import type { BlobStore } from "@/lib/storage/blobStore";
import { createAzureBlobStore, isAzureBlobStoreConfigured } from "@/lib/storage/azureBlobStore";
import { createDbBlobStore, isDbBlobStoreConfigured } from "@/lib/storage/dbBlobStore";

let cachedStore: BlobStore | null = null;

export function getBlobStore(): BlobStore {
  if (cachedStore) return cachedStore;

  if (isAzureBlobStoreConfigured()) {
    cachedStore = createAzureBlobStore();
    return cachedStore;
  }

  if (isDbBlobStoreConfigured()) {
    cachedStore = createDbBlobStore();
    return cachedStore;
  }

  throw new Error("No blob storage configured");
}

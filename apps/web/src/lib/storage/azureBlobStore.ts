import path from "node:path";
import { MAX_BLOB_BYTES } from "@/lib/validation";
import type { BlobStore, BlobStorePutInput, BlobStorePutResult } from "@/lib/storage/blobStore";
import { storageKeyForHash } from "@/lib/storage/blobStore";

const CONTAINER_URL_ENV = "AZURE_BLOB_CONTAINER_URL";

export function isAzureBlobStoreConfigured(): boolean {
  return Boolean(process.env[CONTAINER_URL_ENV]);
}

function getContainerUrl(): URL {
  const value = process.env[CONTAINER_URL_ENV];
  if (!value) {
    throw new Error("Azure Blob storage not configured");
  }
  return new URL(value);
}

function buildBlobUrl(storageKey: string): string {
  const base = getContainerUrl();
  const basePath = base.pathname.replace(/\/$/, "");
  base.pathname = path.posix.join(basePath, storageKey);
  return base.toString();
}

async function assertOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;
  const text = await response.text().catch(() => "");
  throw new Error(`${action} failed (${response.status}): ${text || response.statusText}`);
}

export function createAzureBlobStore(): BlobStore {
  if (!isAzureBlobStoreConfigured()) {
    throw new Error("Azure Blob storage not configured");
  }

  return {
    async putBlob(input: BlobStorePutInput): Promise<BlobStorePutResult> {
      if (input.sizeBytes > MAX_BLOB_BYTES) {
        throw new Error(`Blob exceeds size limit (max ${MAX_BLOB_BYTES} bytes)`);
      }

      const storageKey = storageKeyForHash(input.sha256);
      const url = buildBlobUrl(storageKey);
      const payload = new Uint8Array(input.content);
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Length": input.sizeBytes.toString(),
          "Content-Type": input.contentType ?? "application/octet-stream",
          "x-ms-blob-type": "BlockBlob",
        },
        body: payload,
      });
      await assertOk(response, "Azure blob upload");
      return { storageKey };
    },
    async getBlob(sha256: string): Promise<Buffer | null> {
      const storageKey = storageKeyForHash(sha256);
      const url = buildBlobUrl(storageKey);
      const response = await fetch(url, { method: "GET" });
      if (response.status === 404) return null;
      await assertOk(response, "Azure blob fetch");
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },
    async deleteBlob(sha256: string): Promise<void> {
      const storageKey = storageKeyForHash(sha256);
      const url = buildBlobUrl(storageKey);
      const response = await fetch(url, { method: "DELETE" });
      if (response.status === 404) return;
      await assertOk(response, "Azure blob delete");
    },
  };
}

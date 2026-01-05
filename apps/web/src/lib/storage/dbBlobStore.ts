import { MAX_BLOB_BYTES } from "@/lib/validation";
import { hasDatabaseEnv, prisma } from "@/lib/prisma";
import type { BlobStore, BlobStorePutInput, BlobStorePutResult } from "@/lib/storage/blobStore";

export function isDbBlobStoreConfigured(): boolean {
  return hasDatabaseEnv;
}

export function createDbBlobStore(): BlobStore {
  if (!hasDatabaseEnv) {
    throw new Error("Database storage unavailable");
  }

  return {
    async putBlob(input: BlobStorePutInput): Promise<BlobStorePutResult> {
      if (input.sizeBytes > MAX_BLOB_BYTES) {
        throw new Error(`Blob exceeds size limit (max ${MAX_BLOB_BYTES} bytes)`);
      }

      const existing = await prisma.blob.findUnique({ where: { sha256: input.sha256 } });
      if (existing && existing.sizeBytes !== input.sizeBytes) {
        throw new Error("Blob size mismatch");
      }

      const updated = await prisma.blob.upsert({
        where: { sha256: input.sha256 },
        create: {
          sha256: input.sha256,
          sizeBytes: input.sizeBytes,
          content: input.content,
          storageKey: null,
        },
        update: {
          sizeBytes: input.sizeBytes,
          content: existing?.content ?? input.content,
          storageKey: existing?.storageKey ?? null,
        },
      });

      return { storageKey: updated.storageKey };
    },
    async getBlob(sha256: string): Promise<Buffer | null> {
      const blob = await prisma.blob.findUnique({ where: { sha256 } });
      if (!blob?.content) {
        return null;
      }
      return Buffer.from(blob.content);
    },
    async deleteBlob(sha256: string): Promise<void> {
      const blob = await prisma.blob.findUnique({ where: { sha256 } });
      if (!blob) return;
      await prisma.blob.update({
        where: { sha256 },
        data: { content: null, storageKey: null },
      });
    },
  };
}

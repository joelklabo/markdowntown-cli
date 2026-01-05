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

export function storageKeyForHash(hash: string): string {
  return `${STORAGE_PREFIX}/${hash}`;
}

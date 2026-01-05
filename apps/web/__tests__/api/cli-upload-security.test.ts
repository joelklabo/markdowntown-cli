import { describe, expect, it } from "vitest";
import { validateBlobUpload, validateUploadManifest } from "@/lib/cli/validation";
import { MAX_SNAPSHOT_FILE_BYTES } from "@/lib/validation";

const VALID_HASH = "a".repeat(64);

describe("cli-upload-security", () => {
  it("accepts a basic manifest payload", () => {
    const error = validateUploadManifest([
      {
        path: "README.md",
        blobHash: VALID_HASH,
        sizeBytes: 12,
        mode: 0o644,
      },
    ]);
    expect(error).toBeNull();
  });

  it("rejects path traversal entries", () => {
    const error = validateUploadManifest([
      {
        path: "../secrets.txt",
        blobHash: VALID_HASH,
        sizeBytes: 12,
      },
    ]);
    expect(error).toMatch(/path traversal/i);
  });

  it("rejects oversized files in the manifest", () => {
    const error = validateUploadManifest([
      {
        path: "large.txt",
        blobHash: VALID_HASH,
        sizeBytes: MAX_SNAPSHOT_FILE_BYTES + 1,
      },
    ]);
    expect(error).toMatch(/too large/i);
  });

  it("rejects blocked file extensions", () => {
    const error = validateUploadManifest([
      {
        path: "malware.exe",
        blobHash: VALID_HASH,
        sizeBytes: 100,
      },
    ]);
    expect(error).toMatch(/extension not allowed/i);
  });

  it("rejects oversized blob uploads", () => {
    const error = validateBlobUpload({ sha256: VALID_HASH, sizeBytes: MAX_SNAPSHOT_FILE_BYTES + 1 });
    expect(error).toMatch(/size limit/i);
  });

  it("rejects invalid blob hashes", () => {
    const error = validateBlobUpload({ sha256: "bad-hash", sizeBytes: 10 });
    expect(error).toMatch(/hash/i);
  });
});

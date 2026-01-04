import { describe, it, expect } from "vitest";
import { validatePatchInput } from "@/lib/cli/patches";

const VALID_HASH = "a".repeat(64);

describe("cli-patches", () => {
  it("accepts a valid patch payload", () => {
    const error = validatePatchInput({
      snapshotId: "snap_123",
      path: "README.md",
      baseBlobHash: VALID_HASH,
      patchFormat: "unified",
      patchBody: "diff --git a/README.md b/README.md",
    });
    expect(error).toBeNull();
  });

  it("rejects invalid paths", () => {
    const error = validatePatchInput({
      snapshotId: "snap_123",
      path: "../secrets.txt",
      baseBlobHash: VALID_HASH,
      patchFormat: "unified",
      patchBody: "diff",
    });
    expect(error).toMatch(/path/i);
  });

  it("rejects invalid blob hashes", () => {
    const error = validatePatchInput({
      snapshotId: "snap_123",
      path: "README.md",
      baseBlobHash: "bad-hash",
      patchFormat: "unified",
      patchBody: "diff",
    });
    expect(error).toMatch(/hash/i);
  });

  it("rejects invalid patch formats", () => {
    const error = validatePatchInput({
      snapshotId: "snap_123",
      path: "README.md",
      baseBlobHash: VALID_HASH,
      patchFormat: "",
      patchBody: "diff",
    });
    expect(error).toMatch(/format/i);
  });
});

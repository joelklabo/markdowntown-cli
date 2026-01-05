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

  describe("magic number validation", () => {
    it("accepts valid PNG with correct magic number", () => {
      // PNG magic: 89 50 4E 47 0D 0A 1A 0A
      const pngContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(16).fill(0)]);
      const error = validateBlobUpload({
        sha256: VALID_HASH,
        sizeBytes: pngContent.length,
        contentType: "image/png",
        content: pngContent,
      });
      expect(error).toBeNull();
    });

    it("rejects PNG with JPEG magic number", () => {
      // JPEG magic: FF D8 FF
      const jpegContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(16).fill(0)]);
      const error = validateBlobUpload({
        sha256: VALID_HASH,
        sizeBytes: jpegContent.length,
        contentType: "image/png",
        content: jpegContent,
      });
      expect(error).toMatch(/magic number/i);
    });

    it("accepts valid JPEG with correct magic number", () => {
      // JPEG magic: FF D8 FF
      const jpegContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(16).fill(0)]);
      const error = validateBlobUpload({
        sha256: VALID_HASH,
        sizeBytes: jpegContent.length,
        contentType: "image/jpeg",
        content: jpegContent,
      });
      expect(error).toBeNull();
    });

    it("rejects executable disguised as text", () => {
      // EXE magic: MZ (4D 5A)
      const exeContent = Buffer.from([0x4d, 0x5a, 0x90, 0x00, ...Array(16).fill(0)]);
      const error = validateBlobUpload({
        sha256: VALID_HASH,
        sizeBytes: exeContent.length,
        contentType: "text/plain",
        content: exeContent,
      });
      expect(error).toMatch(/does not match/i);
    });

    it("accepts plain text content", () => {
      const textContent = Buffer.from("Hello, world!\nThis is a test file.\n", "utf-8");
      const error = validateBlobUpload({
        sha256: VALID_HASH,
        sizeBytes: textContent.length,
        contentType: "text/plain",
        content: textContent,
      });
      expect(error).toBeNull();
    });

    it("accepts JSON content", () => {
      const jsonContent = Buffer.from('{"key": "value", "number": 123}', "utf-8");
      const error = validateBlobUpload({
        sha256: VALID_HASH,
        sizeBytes: jsonContent.length,
        contentType: "application/json",
        content: jsonContent,
      });
      expect(error).toBeNull();
    });

    it("rejects binary data as JSON", () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, ...Array(16).fill(0x80)]);
      const error = validateBlobUpload({
        sha256: VALID_HASH,
        sizeBytes: binaryContent.length,
        contentType: "application/json",
        content: binaryContent,
      });
      expect(error).toMatch(/does not match/i);
    });

    it("accepts empty files", () => {
      const emptyContent = Buffer.from([]);
      const error = validateBlobUpload({
        sha256: VALID_HASH,
        sizeBytes: 0,
        contentType: "text/plain",
        content: emptyContent,
      });
      expect(error).toBeNull();
    });

    it("accepts PDF with correct magic number", () => {
      // PDF magic: %PDF
      const pdfContent = Buffer.from("%PDF-1.4\n", "ascii");
      const error = validateBlobUpload({
        sha256: VALID_HASH,
        sizeBytes: pdfContent.length,
        contentType: "application/pdf",
        content: pdfContent,
      });
      expect(error).toBeNull();
    });

    it("rejects unsupported MIME type", () => {
      const content = Buffer.from("test content", "utf-8");
      const error = validateBlobUpload({
        sha256: VALID_HASH,
        sizeBytes: content.length,
        contentType: "application/x-custom-unsupported",
        content,
      });
      expect(error).toMatch(/unsupported content type/i);
    });
  });
});


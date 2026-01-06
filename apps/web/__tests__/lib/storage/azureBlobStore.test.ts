import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test the internal functions, so we use a different approach
// Test validateAzureBlobConfig and error behaviors through integration

describe("azureBlobStore", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isAzureBlobStoreConfigured", () => {
    it("returns false when env var is not set", async () => {
      delete process.env.AZURE_BLOB_CONTAINER_URL;
      const { isAzureBlobStoreConfigured } = await import("@/lib/storage/azureBlobStore");
      expect(isAzureBlobStoreConfigured()).toBe(false);
    });

    it("returns true when env var is set", async () => {
      process.env.AZURE_BLOB_CONTAINER_URL = "https://test.blob.core.windows.net/container?sig=test";
      const { isAzureBlobStoreConfigured } = await import("@/lib/storage/azureBlobStore");
      expect(isAzureBlobStoreConfigured()).toBe(true);
    });
  });

  describe("validateAzureBlobConfig", () => {
    it("returns error when env var is missing", async () => {
      delete process.env.AZURE_BLOB_CONTAINER_URL;
      const { validateAzureBlobConfig } = await import("@/lib/storage/azureBlobStore");
      expect(validateAzureBlobConfig()).toContain("Missing");
    });

    it("returns error for invalid URL", async () => {
      process.env.AZURE_BLOB_CONTAINER_URL = "not-a-url";
      const { validateAzureBlobConfig } = await import("@/lib/storage/azureBlobStore");
      expect(validateAzureBlobConfig()).toContain("not a valid URL");
    });

    it("returns error for non-Azure URL", async () => {
      process.env.AZURE_BLOB_CONTAINER_URL = "https://example.com/container";
      const { validateAzureBlobConfig } = await import("@/lib/storage/azureBlobStore");
      expect(validateAzureBlobConfig()).toContain("Azure blob storage URL");
    });

    it("returns null for valid Azure URL with SAS token", async () => {
      process.env.AZURE_BLOB_CONTAINER_URL = "https://test.blob.core.windows.net/container?sig=test";
      const { validateAzureBlobConfig } = await import("@/lib/storage/azureBlobStore");
      expect(validateAzureBlobConfig()).toBeNull();
    });

    it("warns but succeeds for Azure URL without SAS token", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      process.env.AZURE_BLOB_CONTAINER_URL = "https://test.blob.core.windows.net/container";
      const { validateAzureBlobConfig } = await import("@/lib/storage/azureBlobStore");
      expect(validateAzureBlobConfig()).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no SAS token"));
      warnSpy.mockRestore();
    });
  });

  describe("createAzureBlobStore", () => {
    it("throws when not configured", async () => {
      delete process.env.AZURE_BLOB_CONTAINER_URL;
      const { createAzureBlobStore } = await import("@/lib/storage/azureBlobStore");
      expect(() => createAzureBlobStore()).toThrow("not configured");
    });

    it("throws for invalid config", async () => {
      process.env.AZURE_BLOB_CONTAINER_URL = "https://example.com/container";
      const { createAzureBlobStore } = await import("@/lib/storage/azureBlobStore");
      expect(() => createAzureBlobStore()).toThrow("Azure blob storage URL");
    });

    it("creates store with valid config", async () => {
      process.env.AZURE_BLOB_CONTAINER_URL = "https://test.blob.core.windows.net/container?sig=test";
      const { createAzureBlobStore } = await import("@/lib/storage/azureBlobStore");
      const store = createAzureBlobStore();
      expect(store).toHaveProperty("putBlob");
      expect(store).toHaveProperty("getBlob");
      expect(store).toHaveProperty("deleteBlob");
    });
  });

  describe("retry behavior", () => {
    it("getBlob returns null for 404", async () => {
      process.env.AZURE_BLOB_CONTAINER_URL = "https://test.blob.core.windows.net/container?sig=test";

      // Mock fetch to return 404
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createAzureBlobStore } = await import("@/lib/storage/azureBlobStore");
      const store = createAzureBlobStore();

      const result = await store.getBlob("a".repeat(64));
      expect(result).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });

    it("getBlob throws for 500 after retries", async () => {
      process.env.AZURE_BLOB_CONTAINER_URL = "https://test.blob.core.windows.net/container?sig=test";

      // Mock fetch to always return 500
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        url: "https://test.blob.core.windows.net/container/cli/blobs/a?sig=test",
        text: () => Promise.resolve("Server error"),
      });
      vi.stubGlobal("fetch", mockFetch);

      // Suppress retry warnings
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const { createAzureBlobStore } = await import("@/lib/storage/azureBlobStore");
      const store = createAzureBlobStore();

      await expect(store.getBlob("a".repeat(64))).rejects.toThrow("500");
      // Should have retried: 1 initial + 3 retries = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);

      vi.unstubAllGlobals();
    }, 10000);

    it("getBlob succeeds on retry after transient failure", async () => {
      process.env.AZURE_BLOB_CONTAINER_URL = "https://test.blob.core.windows.net/container?sig=test";

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call fails with 503
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            url: "https://test.blob.core.windows.net/container/cli/blobs/a?sig=test",
          });
        }
        // Second call succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      // Suppress retry warnings
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const { createAzureBlobStore } = await import("@/lib/storage/azureBlobStore");
      const store = createAzureBlobStore();

      const result = await store.getBlob("a".repeat(64));
      expect(result).toEqual(Buffer.from([1, 2, 3]));
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.unstubAllGlobals();
    }, 10000);
  });
});

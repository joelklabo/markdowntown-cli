import path from "node:path";
import { MAX_BLOB_BYTES } from "@/lib/validation";
import type { BlobStore, BlobStorePutInput, BlobStorePutResult } from "@/lib/storage/blobStore";
import { storageKeyForHash } from "@/lib/storage/blobStore";

const CONTAINER_URL_ENV = "AZURE_BLOB_CONTAINER_URL";

/** Maximum retries for transient failures (429, 500, 502, 503, 504) */
const MAX_RETRIES = 3;
/** Base delay in ms for exponential backoff */
const BASE_DELAY_MS = 500;
/** Request timeout in ms */
const REQUEST_TIMEOUT_MS = 30_000;

/** Status codes that should trigger a retry */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export function isAzureBlobStoreConfigured(): boolean {
  return Boolean(process.env[CONTAINER_URL_ENV]);
}

/**
 * Validates Azure blob storage configuration.
 * Returns null if valid, or an error message if invalid.
 */
export function validateAzureBlobConfig(): string | null {
  const value = process.env[CONTAINER_URL_ENV];
  if (!value) {
    return `Missing ${CONTAINER_URL_ENV} environment variable`;
  }
  try {
    const url = new URL(value);
    if (!url.hostname.endsWith(".blob.core.windows.net")) {
      return `${CONTAINER_URL_ENV} must be an Azure blob storage URL (*.blob.core.windows.net)`;
    }
    // Check for SAS token or warn about authentication
    if (!url.searchParams.has("sig")) {
      // Not an error - could be using managed identity
      console.warn(`[azure-blob] ${CONTAINER_URL_ENV} has no SAS token; ensure managed identity is configured`);
    }
    return null;
  } catch {
    return `${CONTAINER_URL_ENV} is not a valid URL`;
  }
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

/**
 * Redacts SAS token query parameters from a URL string.
 * Removes common Azure SAS parameters (sig, se, sp, sv, etc.) to prevent leaking tokens in logs.
 */
function redactSasToken(url: string): string {
  try {
    const parsed = new URL(url);
    const sasParams = ["sig", "se", "sp", "sv", "sr", "st", "spr", "sip", "si"];
    for (const param of sasParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, "[REDACTED]");
      }
    }
    return parsed.toString();
  } catch {
    // If URL parsing fails, redact entire query string as fallback
    const queryIndex = url.indexOf("?");
    return queryIndex >= 0 ? url.slice(0, queryIndex) + "?[REDACTED]" : url;
  }
}

async function assertOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;
  const text = await response.text().catch(() => "");
  const safeUrl = redactSasToken(response.url);
  throw new Error(`${action} failed (${response.status}) for ${safeUrl}: ${text || response.statusText}`);
}

/**
 * Sleep for the specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout support.
 */
async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retry wrapper with exponential backoff for transient failures.
 */
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);

      // If response is successful or non-retryable error, return it
      if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status)) {
        return response;
      }

      // Retryable status code - log and retry
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[azure-blob] Retrying after ${response.status} (attempt ${attempt + 1}/${MAX_RETRIES}, delay ${delay}ms)`,
        );
        await sleep(delay);
      } else {
        // Last attempt, return the response for normal error handling
        return response;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Network errors or timeouts should retry
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[azure-blob] Retrying after error: ${lastError.message} (attempt ${attempt + 1}/${MAX_RETRIES}, delay ${delay}ms)`,
        );
        await sleep(delay);
      }
    }
  }

  // If we get here, all retries failed with network/timeout errors
  throw lastError ?? new Error("Request failed after retries");
}

export function createAzureBlobStore(): BlobStore {
  if (!isAzureBlobStoreConfigured()) {
    throw new Error("Azure Blob storage not configured");
  }

  // Validate config at creation time
  const configError = validateAzureBlobConfig();
  if (configError) {
    throw new Error(configError);
  }

  return {
    async putBlob(input: BlobStorePutInput): Promise<BlobStorePutResult> {
      if (input.sizeBytes > MAX_BLOB_BYTES) {
        throw new Error(`Blob exceeds size limit (max ${MAX_BLOB_BYTES} bytes)`);
      }

      const storageKey = storageKeyForHash(input.sha256);
      const url = buildBlobUrl(storageKey);
      const payload = new Uint8Array(input.content);
      const response = await fetchWithRetry(url, {
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
      const response = await fetchWithRetry(url, { method: "GET" });
      if (response.status === 404) return null;
      await assertOk(response, "Azure blob fetch");
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },
    async deleteBlob(sha256: string): Promise<void> {
      const storageKey = storageKeyForHash(sha256);
      const url = buildBlobUrl(storageKey);
      const response = await fetchWithRetry(url, { method: "DELETE" });
      if (response.status === 404) return;
      await assertOk(response, "Azure blob delete");
    },
  };
}

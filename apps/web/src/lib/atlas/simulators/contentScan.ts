export type ContentScanOptions = {
  allowlist?: RegExp[];
  maxBytes?: number;
};

export type ContentReadReason = "not-allowlisted" | "too-large" | "unreadable" | "binary";

export type ContentReadResult = {
  content: string | null;
  truncated: boolean;
  skipped: boolean;
  reason?: ContentReadReason;
};

type ReadableFile = {
  size?: number;
  text: () => Promise<string>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
};

export const DEFAULT_MAX_CONTENT_BYTES = 64 * 1024;

export const DEFAULT_INSTRUCTION_ALLOWLIST: RegExp[] = [
  /^AGENTS\.md$/,
  /^AGENTS\.override\.md$/,
  /\/AGENTS\.md$/,
  /\/AGENTS\.override\.md$/,
  /^CLAUDE\.md$/,
  /\/CLAUDE\.md$/,
  /^GEMINI\.md$/,
  /\/GEMINI\.md$/,
  /^\.github\/copilot-instructions\.md$/,
  /^\.github\/copilot-instructions\/.+\.instructions\.md$/,
  /^\.github\/instructions\/.+\.instructions\.md$/,
  /^\.github\/agents\/.+/,
];

const SENSITIVE_BASENAME_PATTERNS: RegExp[] = [
  /^\.?env(\..+)?$/i,
  /^\.?netrc$/i,
  /^\.?npmrc$/i,
  /^\.?pypirc$/i,
  /^\.?git-credentials$/i,
  /^\.?dockercfg$/i,
  /^\.?dockerconfigjson$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^authorized_keys$/i,
  /^known_hosts$/i,
  /^credentials?$/i,
  /^password$/i,
  /^passwd$/i,
  /^api[-_]?key$/i,
  /^token$/i,
];

const SENSITIVE_PATH_SEGMENTS = new Set([".ssh", ".gnupg", ".aws", ".azure", ".gcp", ".kube"]);

const SENSITIVE_EXTENSIONS = new Set([".pem", ".key", ".p12", ".pfx", ".kdbx", ".jks", ".keystore"]);

const MAX_BINARY_SCAN_BYTES = 8000;
const BINARY_SUSPICIOUS_RATIO = 0.3;

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+$/, "");
  if (!normalized || normalized === ".") return "";
  return normalized;
}

export function isAllowlistedInstructionPath(path: string, allowlist: RegExp[] = DEFAULT_INSTRUCTION_ALLOWLIST): boolean {
  const normalized = normalizePath(path);
  if (!normalized) return false;
  return allowlist.some((pattern) => pattern.test(normalized));
}

function redactBasename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith(".env")) return "[redacted].env";
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex > 0 && dotIndex < name.length - 1) {
    return `[redacted]${name.slice(dotIndex)}`;
  }
  return "[redacted]";
}

function isBinaryBuffer(bytes: Uint8Array): boolean {
  const sampleSize = Math.min(bytes.length, MAX_BINARY_SCAN_BYTES);
  if (sampleSize === 0) return false;
  let suspicious = 0;
  for (let i = 0; i < sampleSize; i += 1) {
    const byte = bytes[i];
    if (byte === 0) return true;
    if (byte < 7 || byte === 11 || byte === 12 || (byte > 13 && byte < 32) || byte === 127) {
      suspicious += 1;
    }
  }
  return suspicious / sampleSize > BINARY_SUSPICIOUS_RATIO;
}

function truncateToByteLength(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const encoder = new TextEncoder();
  const byteLength = encoder.encode(text).length;
  if (byteLength <= maxBytes) {
    return { text, truncated: false };
  }
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const chunk = text.slice(0, mid);
    if (encoder.encode(chunk).length <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return { text: text.slice(0, low), truncated: true };
}

export function redactSensitivePath(path: string): string {
  const normalized = normalizePath(path);
  if (!normalized) return normalized;
  const parts = normalized.split("/");
  const basename = parts[parts.length - 1] ?? "";
  const lowerPath = normalized.toLowerCase();
  const lowerBasename = basename.toLowerCase();
  const dirSegments = parts.slice(0, -1).map((segment) => segment.toLowerCase());

  if (lowerPath.startsWith(".aws/credentials") || lowerPath.startsWith(".aws/config") || lowerPath === ".kube/config") {
    parts[parts.length - 1] = redactBasename(basename);
    return parts.join("/");
  }

  if (dirSegments.some((segment) => SENSITIVE_PATH_SEGMENTS.has(segment))) {
    parts[parts.length - 1] = redactBasename(basename);
    return parts.join("/");
  }

  if (SENSITIVE_BASENAME_PATTERNS.some((pattern) => pattern.test(lowerBasename))) {
    parts[parts.length - 1] = redactBasename(basename);
    return parts.join("/");
  }

  for (const ext of SENSITIVE_EXTENSIONS) {
    if (lowerBasename.endsWith(ext)) {
      parts[parts.length - 1] = `[redacted]${ext}`;
      return parts.join("/");
    }
  }

  return normalized;
}

export async function readInstructionContent(
  path: string,
  readFile: () => Promise<ReadableFile>,
  options: ContentScanOptions = {},
): Promise<ContentReadResult> {
  const allowlist = options.allowlist ?? DEFAULT_INSTRUCTION_ALLOWLIST;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_CONTENT_BYTES;

  if (!isAllowlistedInstructionPath(path, allowlist)) {
    return { content: null, truncated: false, skipped: true, reason: "not-allowlisted" };
  }

  try {
    const file = await readFile();
    if (typeof file.size === "number" && file.size > maxBytes) {
      return { content: null, truncated: false, skipped: true, reason: "too-large" };
    }
    if (typeof file.arrayBuffer === "function") {
      const buffer = new Uint8Array(await file.arrayBuffer());
      if (isBinaryBuffer(buffer)) {
        return { content: null, truncated: false, skipped: true, reason: "binary" };
      }
      const decoder = new TextDecoder();
      if (buffer.length > maxBytes) {
        const truncated = buffer.slice(0, maxBytes);
        return { content: decoder.decode(truncated), truncated: true, skipped: false };
      }
      return { content: decoder.decode(buffer), truncated: false, skipped: false };
    }
    const text = await file.text();
    if (text.includes("\u0000")) {
      return { content: null, truncated: false, skipped: true, reason: "binary" };
    }
    const truncated = truncateToByteLength(text, maxBytes);
    return { content: truncated.text, truncated: truncated.truncated, skipped: false };
  } catch {
    return { content: null, truncated: false, skipped: true, reason: "unreadable" };
  }
}

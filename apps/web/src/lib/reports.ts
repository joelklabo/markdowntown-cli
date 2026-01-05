import fs from "node:fs";
import path from "node:path";

export type AbuseSignal = {
  ip?: string | null;
  userId?: string | null;
  reason: string;
  at?: Date;
  traceId?: string;
};

export type AuditEvent = {
  event: string;
  ip?: string | null;
  userId?: string | null;
  snapshotId?: string | null;
  projectId?: string | null;
  traceId?: string | null;
  metadata?: Record<string, unknown> | null;
  at?: Date;
  [key: string]: unknown; // Allow additional fields that will be sanitized
};

const LOG_DIR = "logs";
const ABUSE_LOG = "abuse-signals.log";
const AUDIT_LOG = "cli-audit.log";

// Fields that are allowed in metadata (allowlist approach)
const ALLOWED_METADATA_KEYS = new Set([
  "snapshotId",
  "projectId",
  "blobCount",
  "totalBytes",
  "status",
  "duration",
  "contentType",
  "reason",
  "details",
  "fileCount",
  "errorType",
  "method",
]);

// Keys that should be redacted if found anywhere
const SENSITIVE_KEYS = new Set([
  "token",
  "accessToken",
  "access_token",
  "password",
  "secret",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "session",
]);

/**
 * Sanitize a string value by removing control characters and limiting length.
 * Prevents log injection attacks via newlines/carriage returns.
 */
function sanitizeString(value: string, maxLength = 500): string {
  // Remove null bytes, newlines, carriage returns, and other control chars
  let cleaned = value.replace(/[\x00-\x1F\x7F]/g, "");
  
  // Truncate to max length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength) + "...";
  }
  
  return cleaned;
}

/**
 * Sanitize and redact a metadata object.
 * - Allowlist keys to prevent arbitrary data logging
 * - Redact sensitive keys
 * - Sanitize string values to remove control characters
 */
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    // Check if key is sensitive (redact regardless of allowlist)
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEYS.has(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }
    
    // Only allow specific keys (sensitive keys were already handled above)
    if (!ALLOWED_METADATA_KEYS.has(key)) {
      // If not allowlisted but is complex type, mark as such for visibility
      if (typeof value === "object" && value !== null) {
        sanitized[key] = "[COMPLEX]";
      }
      continue; // Skip non-allowlisted keys
    }
    
    // Sanitize value based on type
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    } else if (value === null || value === undefined) {
      sanitized[key] = value;
    } else {
      // Complex types (objects, arrays) are not logged
      sanitized[key] = "[COMPLEX]";
    }
  }
  
  return sanitized;
}

/**
 * Sanitize an audit event entry before logging.
 * Removes control characters, redacts sensitive data, and enforces structure.
 */
function sanitizeAuditEvent(event: AuditEvent): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
    event: sanitizeString(event.event, 100),
    at: event.at ?? new Date().toISOString(),
  };
  
  // Sanitize optional fields
  if (event.ip) {
    sanitized.ip = sanitizeString(event.ip, 50);
  }
  if (event.userId) {
    sanitized.userId = sanitizeString(event.userId, 100);
  }
  if (event.snapshotId) {
    sanitized.snapshotId = sanitizeString(event.snapshotId, 100);
  }
  if (event.projectId) {
    sanitized.projectId = sanitizeString(event.projectId, 100);
  }
  if (event.traceId) {
    sanitized.traceId = sanitizeString(event.traceId, 100);
  }
  
  // Sanitize metadata if present
  if (event.metadata && typeof event.metadata === "object") {
    sanitized.metadata = sanitizeMetadata(event.metadata);
  }
  
  // Sanitize any additional fields (e.g., reason, details, contentType)
  for (const [key, value] of Object.entries(event)) {
    if (key in sanitized || key === "metadata") continue;
    
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

function getPaths(filename: string) {
  const dir = path.join(process.cwd(), LOG_DIR);
  const file = path.join(dir, filename);
  return { dir, file };
}

function ensureFile(filename: string) {
  const { dir, file } = getPaths(filename);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, "");
}

export function logAbuseSignal(signal: AbuseSignal) {
  try {
    const { file } = getPaths(ABUSE_LOG);
    ensureFile(ABUSE_LOG);
    
    // Sanitize abuse signal fields
    const entry = {
      reason: sanitizeString(signal.reason, 200),
      at: signal.at ?? new Date().toISOString(),
      ...(signal.ip && { ip: sanitizeString(signal.ip, 50) }),
      ...(signal.userId && { userId: sanitizeString(signal.userId, 100) }),
      ...(signal.traceId && { traceId: sanitizeString(signal.traceId, 100) }),
    };
    
    fs.appendFileSync(file, JSON.stringify(entry) + "\n", { encoding: "utf8" });
  } catch (err) {
    console.error("Failed to log abuse signal", err);
  }
}

export function logAuditEvent(event: AuditEvent) {
  try {
    const { file } = getPaths(AUDIT_LOG);
    ensureFile(AUDIT_LOG);
    
    const sanitizedEntry = sanitizeAuditEvent(event);
    
    fs.appendFileSync(file, JSON.stringify(sanitizedEntry) + "\n", { encoding: "utf8" });
  } catch (err) {
    console.error("Failed to log audit event", err);
  }
}


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
};

const LOG_DIR = "logs";
const ABUSE_LOG = "abuse-signals.log";
const AUDIT_LOG = "cli-audit.log";

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
    const entry = {
      ...signal,
      at: signal.at ?? new Date().toISOString(),
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
    const entry = {
      ...event,
      at: event.at ?? new Date().toISOString(),
    };
    fs.appendFileSync(file, JSON.stringify(entry) + "\n", { encoding: "utf8" });
  } catch (err) {
    console.error("Failed to log audit event", err);
  }
}

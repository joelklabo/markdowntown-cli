import fs from "node:fs";
import path from "node:path";

export type AbuseSignal = {
  ip?: string | null;
  userId?: string | null;
  reason: string;
  at?: Date;
  traceId?: string;
};

function getPaths() {
  const dir = path.join(process.cwd(), "logs");
  const file = path.join(dir, "abuse-signals.log");
  return { dir, file };
}

function ensureFile() {
  const { dir, file } = getPaths();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, "");
}

export function logAbuseSignal(signal: AbuseSignal) {
  try {
    const { file } = getPaths();
    ensureFile();
    const entry = {
      ...signal,
      at: signal.at ?? new Date().toISOString(),
    };
    fs.appendFileSync(file, JSON.stringify(entry) + "\n", { encoding: "utf8" });
  } catch (err) {
    console.error("Failed to log abuse signal", err);
  }
}

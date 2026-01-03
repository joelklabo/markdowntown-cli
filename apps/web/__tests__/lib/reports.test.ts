import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { logAbuseSignal } from "@/lib/reports";

function withTempCwd(cb: () => void) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mdt-reports-"));
  const spy = vi.spyOn(process, "cwd").mockReturnValue(tmp);
  try {
    cb();
  } finally {
    spy.mockRestore();
  }
  return tmp;
}

describe("logAbuseSignal", () => {
  it("creates log file and appends entry", () => {
    const tmp = withTempCwd(() => {
      logAbuseSignal({ reason: "spam", ip: "1.1.1.1", userId: "u1" });
    });

    const file = path.join(tmp, "logs", "abuse-signals.log");
    expect(fs.existsSync(file)).toBe(true);
    const contents = fs.readFileSync(file, "utf8").trim().split("\n");
    expect(contents).toHaveLength(1);
    const entry = JSON.parse(contents[0]);
    expect(entry.reason).toBe("spam");
    expect(entry.ip).toBe("1.1.1.1");
    expect(entry.userId).toBe("u1");
    expect(entry.at).toBeDefined();
  });
});

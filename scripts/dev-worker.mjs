import { spawn } from "node:child_process";
import path from "node:path";

const port = process.env.ENGINE_WORKER_PORT || "3001";
const repoRoot = path.resolve(process.cwd());

console.log(`Starting engine-worker on port ${port}...`);

const worker = spawn("go", ["run", "./cmd/engine-worker"], {
  cwd: path.join(repoRoot, "cli"),
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: port,
  },
});

worker.on("close", (code) => {
  console.log(`engine-worker exited with code ${code}`);
});

process.on("SIGINT", () => worker.kill("SIGINT"));
process.on("SIGTERM", () => worker.kill("SIGTERM"));

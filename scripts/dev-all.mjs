import { spawn } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());

const processes = [
  {
    name: "web",
    command: "pnpm",
    args: ["--filter", "web", "dev"],
    cwd: repoRoot,
  },
  {
    name: "worker",
    command: "node",
    args: ["scripts/dev-worker.mjs"],
    cwd: repoRoot,
  },
  {
    name: "wasm-watch",
    command: "node",
    args: ["scripts/watch-wasm.mjs"],
    cwd: repoRoot,
  },
];

console.log("Starting all dev services...");

const runners = processes.map((p) => {
  console.log(`[${p.name}] starting ${p.command} ${p.args.join(" ")}...`);
  const proc = spawn(p.command, p.args, {
    cwd: p.cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      ENGINE_WORKER_URL: "http://localhost:3001",
    },
  });

  proc.on("close", (code) => {
    console.log(`[${p.name}] exited with code ${code}`);
  });

  return proc;
});

process.on("SIGINT", () => {
  console.log("Shutting down all services...");
  runners.forEach((r) => r.kill("SIGINT"));
});

process.on("SIGTERM", () => {
  runners.forEach((r) => r.kill("SIGTERM"));
});

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const cliDir = path.join(repoRoot, "cli");

let building = false;
let pending = false;

async function buildWasm() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  console.log("Rebuilding WASM engine...");
  
  const build = spawn("bash", ["cli/scripts/build-wasm.sh"], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  build.on("close", (code) => {
    building = false;
    console.log(`WASM build finished with code ${code}`);
    if (pending) {
      pending = false;
      buildWasm();
    }
  });
}

console.log("Watching cli/ for changes to rebuild WASM...");

// Initial build
buildWasm();

fs.watch(cliDir, { recursive: true }, (event, filename) => {
  if (filename && (filename.endsWith(".go") || filename.endsWith(".sh"))) {
    buildWasm();
  }
});

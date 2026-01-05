#!/usr/bin/env node
import { hasHardFailure, refreshDocumentation } from "../../apps/web/src/lib/docs/refresh";

async function main() {
  const result = await refreshDocumentation();
  console.log(JSON.stringify(result, null, 2));

  if (hasHardFailure(result)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

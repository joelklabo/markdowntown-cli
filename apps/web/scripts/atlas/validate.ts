import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { safeParsePlatformFacts } from "../../src/lib/atlas/schema.ts";
import { isAtlasFeatureId, parseAtlasCrosswalk } from "../../src/lib/atlas/features.ts";
import { loadAtlasSources } from "../../src/lib/atlas/sources.ts";

export type AtlasValidationError = {
  filePath: string;
  message: string;
};

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const at = issue.path.length ? issue.path.join(".") : "(root)";
      return `${at}: ${issue.message}`;
    })
    .join("\n");
}

function readJsonFile(filePath: string): unknown {
  let text = "";
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read file\n${cause}`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON\n${cause}`);
  }
}

function validateFactsFile(filePath: string): AtlasValidationError[] {
  const errors: AtlasValidationError[] = [];

  let raw: unknown;
  try {
    raw = readJsonFile(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({ filePath, message });
    return errors;
  }

  const parsed = safeParsePlatformFacts(raw);
  if (!parsed.success) {
    errors.push({ filePath, message: `Schema validation failed\n${formatZodError(parsed.error)}` });
    return errors;
  }

  const facts = parsed.data;

  for (const featureId of Object.keys(facts.featureSupport ?? {})) {
    if (!isAtlasFeatureId(featureId)) {
      errors.push({
        filePath,
        message: `Unknown featureSupport key "${featureId}" (not in taxonomy)`,
      });
    }
  }

  for (const claim of facts.claims ?? []) {
    for (const featureId of claim.features ?? []) {
      if (!isAtlasFeatureId(featureId)) {
        errors.push({
          filePath,
          message: `Unknown claim feature "${featureId}" in claim "${claim.id}" (not in taxonomy)`,
        });
      }
    }
  }

  return errors;
}

export function validateAtlas(atlasDir: string): AtlasValidationError[] {
  const errors: AtlasValidationError[] = [];

  if (!fs.existsSync(atlasDir)) {
    return [{ filePath: atlasDir, message: "atlas/ directory not found" }];
  }

  // Validate crosswalk.json
  const crosswalkPath = path.join(atlasDir, "crosswalk.json");
  if (!fs.existsSync(crosswalkPath)) {
    errors.push({ filePath: crosswalkPath, message: "Missing atlas/crosswalk.json" });
  } else {
    try {
      parseAtlasCrosswalk(readJsonFile(crosswalkPath));
    } catch (error) {
      const message = error instanceof ZodError ? formatZodError(error) : error instanceof Error ? error.message : String(error);
      errors.push({ filePath: crosswalkPath, message: `Crosswalk validation failed\n${message}` });
    }
  }

  // Validate sources.yml
  try {
    loadAtlasSources({ atlasDir });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({ filePath: path.join(atlasDir, "sources.yml"), message: `Sources registry validation failed\n${message}` });
  }

  // Validate facts files (if present)
  const factsDir = path.join(atlasDir, "facts");
  if (fs.existsSync(factsDir)) {
    const files = fs.readdirSync(factsDir).filter((name) => name.endsWith(".json"));
    for (const fileName of files) {
      const filePath = path.join(factsDir, fileName);
      errors.push(...validateFactsFile(filePath));
    }
  }

  return errors;
}

function printErrors(errors: AtlasValidationError[]) {
  for (const error of errors) {
    console.error(`[atlas:validate] ${error.filePath}\n${error.message}\n`);
  }
}

async function main() {
  const atlasDir = path.join(process.cwd(), "atlas");
  const errors = validateAtlas(atlasDir);
  if (errors.length > 0) {
    printErrors(errors);
    process.exitCode = 1;
    return;
  }
  console.log("[atlas:validate] OK");
}

const isEntrypoint = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  void main();
}

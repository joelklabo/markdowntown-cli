import type { AdapterRegistry } from '../adapters';
import { adapterRegistry } from '../adapters';
import type { CompiledFile, CompileResult } from '../adapters/types';
import type { UamTargetV1, UamV1 } from '../uam/uamTypes';

function stableSortTargets(targets: UamTargetV1[]): UamTargetV1[] {
  return [...targets].sort(
    (a, b) => a.targetId.localeCompare(b.targetId) || a.adapterVersion.localeCompare(b.adapterVersion)
  );
}

export async function compileUamV1(
  uam: UamV1,
  targets: UamTargetV1[] = uam.targets,
  registry: AdapterRegistry = adapterRegistry
): Promise<CompileResult> {
  const warnings: string[] = [];
  const info: string[] = [];
  const filesByPath = new Map<
    string,
    {
      file: CompiledFile;
      producer: { targetId: string; adapterVersion: string; label: string };
    }
  >();

  for (const target of stableSortTargets(targets)) {
    const adapter = registry.resolve(target.targetId, target.adapterVersion);
    if (!adapter) {
      warnings.push(`Unknown target: ${target.targetId}@${target.adapterVersion}`);
      continue;
    }

    let result: CompileResult;
    try {
      result = await adapter.compile(uam, target);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      warnings.push(`[${adapter.label}] Compile failed: ${message}`);
      continue;
    }

    const prefix = `${adapter.label} (${adapter.id}@${adapter.version})`;
    for (const w of result.warnings ?? []) warnings.push(`[${prefix}] ${w}`);
    for (const i of result.info ?? []) info.push(`[${prefix}] ${i}`);

    for (const file of result.files ?? []) {
      const existing = filesByPath.get(file.path);
      if (existing) {
        warnings.push(
          `File path collision: ${file.path} from ${target.targetId}@${target.adapterVersion} conflicts with ${existing.producer.targetId}@${existing.producer.adapterVersion}`
        );
        continue;
      }
      filesByPath.set(file.path, {
        file,
        producer: { targetId: target.targetId, adapterVersion: target.adapterVersion, label: adapter.label },
      });
    }
  }

  const files = Array.from(filesByPath.values())
    .map(v => v.file)
    .sort((a, b) => a.path.localeCompare(b.path));

  return { files, warnings, info };
}


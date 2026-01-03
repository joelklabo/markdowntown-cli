import { UniversalAgentDefinition } from '../types';
import { CompilationResult, CompiledFile, getAdapter, registerAdapter } from '../adapters';
import { agentsMdAdapter } from '../adapters/agentsMd';
import { githubCopilotAdapter } from '../adapters/githubCopilot';
import { claudeCodeAdapter } from '../adapters/claudeCode';
import { geminiCliAdapter } from '../adapters/geminiCli';
import { cursorRulesAdapter } from '../adapters/cursorRules';
import { windsurfRulesAdapter } from '../adapters/windsurfRules';

// Register built-in adapters
registerAdapter(agentsMdAdapter);
registerAdapter(githubCopilotAdapter);
registerAdapter(claudeCodeAdapter);
registerAdapter(geminiCliAdapter);
registerAdapter(cursorRulesAdapter);
registerAdapter(windsurfRulesAdapter);

export async function compile(
  def: UniversalAgentDefinition,
  targetIds: string[]
): Promise<CompilationResult> {
  const aggregatedFiles: CompiledFile[] = [];
  const aggregatedWarnings: string[] = [];
  const aggregatedInfo: string[] = [];

  for (const id of targetIds) {
    const adapter = getAdapter(id);
    if (!adapter) {
      aggregatedWarnings.push(`Target adapter '${id}' not found.`);
      continue;
    }

    try {
      const result = await adapter.compile(def);
      
      // Merge files
      aggregatedFiles.push(...result.files);

      // Merge warnings with prefix
      if (result.warnings) {
        aggregatedWarnings.push(...result.warnings.map(w => `[${adapter.name}] ${w}`));
      }

      // Merge info
      if (result.info) {
        aggregatedInfo.push(...result.info.map(i => `[${adapter.name}] ${i}`));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      aggregatedWarnings.push(`[${adapter.name}] Compilation failed: ${msg}`);
    }
  }

  return {
    files: aggregatedFiles,
    warnings: aggregatedWarnings,
    info: aggregatedInfo,
  };
}

export function validateTargets(targetIds: string[]): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const id of targetIds) {
    const normalized = id.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    if (getAdapter(normalized)) {
      valid.push(normalized);
    } else {
      invalid.push(normalized);
    }
  }

  return { valid, invalid };
}

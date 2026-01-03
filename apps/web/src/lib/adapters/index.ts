import type { Adapter } from './types';
import { agentsMdCodexAdapter } from './agentsMdCodex';
import { githubCopilotAdapter } from './githubCopilot';
import { claudeCodeAdapter } from './claudeCode';
import { geminiCliAdapter } from './geminiCli';
import { cursorRulesAdapter } from './cursorRules';
import { windsurfRulesAdapter } from './windsurfRules';

export interface AdapterRegistry {
  register(adapter: Adapter): void;
  resolve(targetId: string, adapterVersion: string): Adapter | undefined;
  list(targetId?: string): Adapter[];
}

export function createAdapterRegistry(): AdapterRegistry {
  const byTargetId = new Map<string, Map<string, Adapter>>();

  return {
    register(adapter) {
      const byVersion = byTargetId.get(adapter.id) ?? new Map<string, Adapter>();
      byVersion.set(adapter.version, adapter);
      byTargetId.set(adapter.id, byVersion);
    },

    resolve(targetId, adapterVersion) {
      return byTargetId.get(targetId)?.get(adapterVersion);
    },

    list(targetId) {
      if (targetId) {
        return Array.from(byTargetId.get(targetId)?.values() ?? []).sort((a, b) =>
          a.version.localeCompare(b.version)
        );
      }

      return Array.from(byTargetId.values())
        .flatMap(byVersion => Array.from(byVersion.values()))
        .sort((a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version));
    },
  };
}

export const adapterRegistry = createAdapterRegistry();
adapterRegistry.register(agentsMdCodexAdapter);
adapterRegistry.register(githubCopilotAdapter);
adapterRegistry.register(claudeCodeAdapter);
adapterRegistry.register(geminiCliAdapter);
adapterRegistry.register(cursorRulesAdapter);
adapterRegistry.register(windsurfRulesAdapter);

export function resolveAdapter(targetId: string, adapterVersion: string) {
  return adapterRegistry.resolve(targetId, adapterVersion);
}

export type { Adapter } from './types';
export type { CompileResult, CompiledFile } from './types';

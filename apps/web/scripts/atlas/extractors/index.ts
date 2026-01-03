import type { AtlasExtractor } from "./types.ts";
import { claudeCodeMemoryExtractor } from "./claude_code_memory.ts";
import { codexCliAgentsExtractor } from "./codex_cli_agents.ts";
import { copilotCliDocsExtractor } from "./copilot_cli.ts";
import { copilotDocsInstructionsExtractor } from "./copilot_docs_instructions.ts";
import { cursorRulesDocsExtractor } from "./cursor_rules.ts";
import { geminiCliDocsExtractor } from "./gemini_cli.ts";
import { windsurfRulesDocsExtractor } from "./windsurf_rules.ts";

const noopExtractor: AtlasExtractor = {
  sourceId: "__noop__",
  extract: async () => ({ claims: [], featureSupport: {} }),
};

const registry = new Map<string, AtlasExtractor>();

export function registerExtractor(extractor: AtlasExtractor) {
  registry.set(extractor.sourceId, extractor);
}

export function getExtractor(sourceId: string): AtlasExtractor {
  return registry.get(sourceId) ?? { ...noopExtractor, sourceId };
}

registerExtractor(copilotDocsInstructionsExtractor);
registerExtractor(claudeCodeMemoryExtractor);
registerExtractor(geminiCliDocsExtractor);
registerExtractor(codexCliAgentsExtractor);
registerExtractor(cursorRulesDocsExtractor);
registerExtractor(windsurfRulesDocsExtractor);
registerExtractor(copilotCliDocsExtractor);

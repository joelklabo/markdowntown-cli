import { ContextSimulator } from "@/components/atlas/ContextSimulator";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { loadAtlasFacts } from "@/lib/atlas/load";
import type { AtlasPlatformId } from "@/lib/atlas/types";
import type { SimulatorToolId, ToolRulesMetadataMap } from "@/lib/atlas/simulators/types";

const TOOL_FACTS: Record<SimulatorToolId, AtlasPlatformId> = {
  "github-copilot": "github-copilot",
  "copilot-cli": "copilot-cli",
  "claude-code": "claude-code",
  "gemini-cli": "gemini-cli",
  "codex-cli": "codex-cli",
  cursor: "cursor",
};

function buildToolRulesMeta(): ToolRulesMetadataMap {
  const out = {} as ToolRulesMetadataMap;
  (Object.keys(TOOL_FACTS) as SimulatorToolId[]).forEach((tool) => {
    const facts = loadAtlasFacts(TOOL_FACTS[tool]);
    out[tool] = {
      docUrl: facts.docHome,
      lastVerified: facts.lastVerified,
    };
  });
  return out;
}

export default function AtlasSimulatorPage() {
  const toolRulesMeta = buildToolRulesMeta();

  return (
    <main className="py-mdt-6 md:py-mdt-8">
      <Container>
        <Stack gap={5}>
          <Stack gap={2} className="max-w-2xl">
            <Heading level="h1">Scan a folder</Heading>
            <Text tone="muted">
              Preview which instruction files load for your tool, then open Workbench to export. Scans stay local in your
              browser—nothing is uploaded.
            </Text>
          </Stack>
          <ContextSimulator toolRulesMeta={toolRulesMeta} />
        </Stack>
      </Container>
    </main>
  );
}

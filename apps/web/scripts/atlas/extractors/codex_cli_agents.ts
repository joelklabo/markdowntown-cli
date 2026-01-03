import type { AtlasExtractor } from "./types.ts";
import type { AtlasFeatureId } from "../../../src/lib/atlas/features.ts";
import type { Claim, FeatureSupportLevel } from "../../../src/lib/atlas/types.ts";

function normalizeText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildClaim(params: {
  id: string;
  statement: string;
  confidence: Claim["confidence"];
  evidenceUrl: string;
  evidenceTitle: string;
  excerpt?: string;
  features?: AtlasFeatureId[];
}): Claim {
  return {
    id: params.id,
    statement: params.statement,
    confidence: params.confidence,
    evidence: [
      {
        url: params.evidenceUrl,
        title: params.evidenceTitle,
        excerpt: params.excerpt,
      },
    ],
    features: params.features,
  };
}

function setSupport(
  out: Partial<Record<AtlasFeatureId, FeatureSupportLevel>>,
  key: AtlasFeatureId,
  value: FeatureSupportLevel
) {
  out[key] = value;
}

export const codexCliAgentsExtractor: AtlasExtractor = {
  sourceId: "codex-cli-agents-md",
  extract: ({ source, html }) => {
    const text = normalizeText(html);
    const evidenceTitle = "Codex CLI documentation";

    const hasAgentsMd = /\bAGENTS\.md\b/i.test(text);
    const hasOverrideFile = /\bAGENTS\.override\.md\b/i.test(text);
    const hasHierarchy =
      /\b(directory|directories|subdirectory|subdirectories|folder|nested|ancestor|hierarchy)\b/i.test(text) && hasAgentsMd;

    const claims: Claim[] = [];
    const featureSupport: Partial<Record<AtlasFeatureId, FeatureSupportLevel>> = {};

    if (hasAgentsMd) {
      claims.push(
        buildClaim({
          id: "codex-cli.repo-instructions.file",
          statement: "Codex CLI loads repository instructions from AGENTS.md.",
          confidence: "high",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "AGENTS.md",
          features: ["repo-instructions"],
        })
      );
      setSupport(featureSupport, "repo-instructions", "yes");
    }

    if (hasHierarchy) {
      claims.push(
        buildClaim({
          id: "codex-cli.path-scoping.hierarchy",
          statement: "Codex CLI supports directory-scoped instructions via additional AGENTS.md files in subdirectories.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "subdirectories",
          features: ["path-scoping"],
        })
      );
      setSupport(featureSupport, "path-scoping", "yes");
    }

    if (hasOverrideFile) {
      claims.push(
        buildClaim({
          id: "codex-cli.path-scoping.override-file",
          statement: "Codex CLI supports AGENTS.override.md to override AGENTS.md instructions.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "AGENTS.override.md",
          features: ["path-scoping"],
        })
      );
      setSupport(featureSupport, "path-scoping", "yes");
    }

    setSupport(featureSupport, "imports", "no");

    claims.sort((a, b) => a.id.localeCompare(b.id));
    return { claims, featureSupport };
  },
};


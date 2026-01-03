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

export const copilotCliDocsExtractor: AtlasExtractor = {
  sourceId: "copilot-cli-agents-md",
  extract: ({ source, html }) => {
    const text = normalizeText(html);
    const evidenceTitle = "GitHub Copilot CLI documentation";

    const hasRepoInstructions = /\B\.github\/copilot-instructions\.md\b/i.test(text);
    const hasPathInstructions = /\B\.github\/copilot-instructions\/\*\*\/\*\.instructions\.md\b/i.test(text);
    const hasAgentsMd = /\bAGENTS\.md\b/i.test(text);

    const hasUserAgentDir = /~\/\.copilot\/agents\b/i.test(text);
    const hasRepoAgentDir = /\B\.github\/agents\b/i.test(text);
    const hasOrgAgentDir = /\B\.github-private\b/i.test(text) && /\B\/agents\b/i.test(text);

    const hasAgentPrecedence =
      /\bnaming conflicts\b/i.test(text) && /\boverrides?\b/i.test(text);

    const claims: Claim[] = [];
    const featureSupport: Partial<Record<AtlasFeatureId, FeatureSupportLevel>> = {};

    if (hasRepoInstructions) {
      claims.push(
        buildClaim({
          id: "copilot-cli.repo-instructions.file",
          statement: "GitHub Copilot CLI supports repository-wide instructions via .github/copilot-instructions.md.",
          confidence: "high",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: ".github/copilot-instructions.md",
          features: ["repo-instructions"],
        })
      );
      setSupport(featureSupport, "repo-instructions", "yes");
    }

    if (hasPathInstructions) {
      claims.push(
        buildClaim({
          id: "copilot-cli.path-scoping.instructions-files",
          statement: "GitHub Copilot CLI supports path-scoped instructions via .github/copilot-instructions/**/*.instructions.md files.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: ".instructions.md",
          features: ["path-scoping"],
        })
      );
      setSupport(featureSupport, "path-scoping", "yes");
    }

    if (hasAgentsMd) {
      claims.push(
        buildClaim({
          id: "copilot-cli.repo-instructions.agents-file",
          statement: "GitHub Copilot CLI supports agent files such as AGENTS.md.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "AGENTS.md",
          features: ["repo-instructions"],
        })
      );
      setSupport(featureSupport, "repo-instructions", "yes");
    }

    if (hasUserAgentDir) {
      claims.push(
        buildClaim({
          id: "copilot-cli.custom-agents.user-dir",
          statement: "GitHub Copilot CLI can load user-level custom agent profiles from ~/.copilot/agents.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "~/.copilot/agents",
        })
      );
    }

    if (hasRepoAgentDir) {
      claims.push(
        buildClaim({
          id: "copilot-cli.custom-agents.repo-dir",
          statement: "GitHub Copilot CLI can load repository-level custom agent profiles from .github/agents.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: ".github/agents",
        })
      );
    }

    if (hasOrgAgentDir) {
      claims.push(
        buildClaim({
          id: "copilot-cli.custom-agents.org-dir",
          statement: "GitHub Copilot CLI can load organization-level custom agent profiles from /agents in an organization .github-private repository.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: ".github-private",
        })
      );
    }

    if (hasAgentPrecedence) {
      claims.push(
        buildClaim({
          id: "copilot-cli.custom-agents.precedence",
          statement: "When custom agent names conflict, Copilot CLI prefers higher-precedence agent scopes over lower-precedence ones.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "naming conflicts",
        })
      );
    }

    setSupport(featureSupport, "imports", "no");

    claims.sort((a, b) => a.id.localeCompare(b.id));
    return { claims, featureSupport };
  },
};


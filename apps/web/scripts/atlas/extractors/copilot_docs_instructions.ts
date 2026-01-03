import type { AtlasExtractor } from "./types.ts";
import type { Claim, FeatureSupportLevel } from "../../../src/lib/atlas/types.ts";
import type { AtlasFeatureId } from "../../../src/lib/atlas/features.ts";

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
  features: AtlasFeatureId[];
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

function setSupport(out: Partial<Record<AtlasFeatureId, FeatureSupportLevel>>, key: AtlasFeatureId, value: FeatureSupportLevel) {
  out[key] = value;
}

export const copilotDocsInstructionsExtractor: AtlasExtractor = {
  sourceId: "github-copilot-repo-instructions",
  extract: ({ source, html }) => {
    const text = normalizeText(html);
    const evidenceTitle = "GitHub Copilot documentation";

    const hasRepoInstructions = text.includes(".github/copilot-instructions.md");
    const hasApplyTo = /\bapplyTo\b/i.test(text);
    const hasPrecedence = /\bprecedence\b/i.test(text) || /\boverride\b/i.test(text) || /\bmore specific\b/i.test(text);

    const claims: Claim[] = [];
    const featureSupport: Partial<Record<AtlasFeatureId, FeatureSupportLevel>> = {};

    if (hasRepoInstructions) {
      claims.push(
        buildClaim({
          id: "github-copilot.repo-instructions.file",
          statement: "GitHub Copilot loads repository instructions from .github/copilot-instructions.md.",
          confidence: "high",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: ".github/copilot-instructions.md",
          features: ["repo-instructions"],
        })
      );
      setSupport(featureSupport, "repo-instructions", "yes");
    }

    if (hasApplyTo) {
      claims.push(
        buildClaim({
          id: "github-copilot.path-scoping.applyto",
          statement: "GitHub Copilot supports scoping instructions using applyTo frontmatter in instructions files.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "applyTo",
          features: ["path-scoping"],
        })
      );
      setSupport(featureSupport, "path-scoping", "yes");
    }

    if (hasPrecedence) {
      claims.push(
        buildClaim({
          id: "github-copilot.path-scoping.precedence",
          statement: "More specific scoped Copilot instructions take precedence over more general instructions.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "precedence",
          features: ["path-scoping"],
        })
      );
    }

    // Copilot docs in this extractor do not describe imports/includes.
    setSupport(featureSupport, "imports", "no");

    claims.sort((a, b) => a.id.localeCompare(b.id));
    return { claims, featureSupport };
  },
};

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

export const geminiCliDocsExtractor: AtlasExtractor = {
  sourceId: "gemini-cli-gemini-md",
  extract: ({ source, html }) => {
    const text = normalizeText(html);
    const evidenceTitle = "Gemini CLI documentation";

    const hasGeminiMd = /\bGEMINI\.md\b/i.test(text);
    const hasIgnore = /\B\.geminiignore\b/i.test(text) || /\bgeminiignore\b/i.test(text);

    const claims: Claim[] = [];
    const featureSupport: Partial<Record<AtlasFeatureId, FeatureSupportLevel>> = {};

    if (hasGeminiMd) {
      claims.push(
        buildClaim({
          id: "gemini-cli.repo-instructions.file",
          statement: "Gemini CLI loads repository instructions from GEMINI.md.",
          confidence: "high",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "GEMINI.md",
          features: ["repo-instructions"],
        })
      );
      setSupport(featureSupport, "repo-instructions", "yes");
    }

    if (hasIgnore) {
      claims.push(
        buildClaim({
          id: "gemini-cli.ignore-file.geminiignore",
          statement: "Gemini CLI supports ignoring files via a .geminiignore file.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: ".geminiignore",
        })
      );
    }

    setSupport(featureSupport, "path-scoping", "no");
    setSupport(featureSupport, "imports", "no");

    claims.sort((a, b) => a.id.localeCompare(b.id));
    return { claims, featureSupport };
  },
};


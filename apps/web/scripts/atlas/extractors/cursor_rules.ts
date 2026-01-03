import type { AtlasExtractor } from "./types.ts";
import type { AtlasFeatureId } from "../../../src/lib/atlas/features.ts";
import type { Claim, FeatureSupportLevel } from "../../../src/lib/atlas/types.ts";

function normalizeText(html: string): string {
  return html
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

export const cursorRulesDocsExtractor: AtlasExtractor = {
  sourceId: "cursor-cursorrules",
  extract: ({ source, html }) => {
    const text = normalizeText(html);
    const evidenceTitle = "Cursor documentation";

    const hasRulesDirectory = text.includes(".cursor/rules") && text.includes(".mdc");
    const hasGlobs = /\bglobs\b/i.test(text) || /\bglob\b/i.test(text);
    const hasAlwaysApply = /\balwaysApply\b/i.test(text);
    const hasPrecedence = /\bprecedence\b/i.test(text) || /\bmore specific\b/i.test(text) || /\bpriority\b/i.test(text);

    const claims: Claim[] = [];
    const featureSupport: Partial<Record<AtlasFeatureId, FeatureSupportLevel>> = {};

    if (hasRulesDirectory) {
      claims.push(
        buildClaim({
          id: "cursor.repo-instructions.rules-files",
          statement: "Cursor supports repository instructions via .cursor/rules/*.mdc rule files.",
          confidence: "high",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: ".cursor/rules/*.mdc",
          features: ["repo-instructions"],
        })
      );
      setSupport(featureSupport, "repo-instructions", "yes");
    }

    if (hasGlobs) {
      claims.push(
        buildClaim({
          id: "cursor.path-scoping.globs",
          statement: "Cursor supports scoping rules to file globs using a globs field in rule frontmatter.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "globs",
          features: ["path-scoping"],
        })
      );
      setSupport(featureSupport, "path-scoping", "yes");
    }

    if (hasAlwaysApply) {
      claims.push(
        buildClaim({
          id: "cursor.path-scoping.alwaysapply",
          statement: "Cursor supports alwaysApply to apply a rule regardless of globs scope.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "alwaysApply",
          features: ["path-scoping"],
        })
      );
      setSupport(featureSupport, "path-scoping", "yes");
    }

    if (hasPrecedence) {
      claims.push(
        buildClaim({
          id: "cursor.path-scoping.precedence",
          statement: "When multiple Cursor rules match, more specific scoped rules take precedence.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "precedence",
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

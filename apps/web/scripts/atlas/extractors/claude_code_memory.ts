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

function setSupport(
  out: Partial<Record<AtlasFeatureId, FeatureSupportLevel>>,
  key: AtlasFeatureId,
  value: FeatureSupportLevel
) {
  out[key] = value;
}

export const claudeCodeMemoryExtractor: AtlasExtractor = {
  sourceId: "claude-code-claude-md",
  extract: ({ source, html }) => {
    const text = normalizeText(html);
    const evidenceTitle = "Claude Code documentation";

    const hasClaudeMd = text.includes("CLAUDE.md");
    const hasProjectMemory =
      /\bproject memory\b/i.test(text) || /\bproject instructions\b/i.test(text) || /\bmemory\b/i.test(text);
    const hasDirectoryMemory =
      /\bdirectory memory\b/i.test(text) ||
      (/\b(subdirectory|sub-directory|folder|directory|nested)\b/i.test(text) && /\bCLAUDE\.md\b/i.test(text));
    const hasPrecedence =
      /\bprecedence\b/i.test(text) || /\boverride\b/i.test(text) || /\bmore specific\b/i.test(text) || /\btakes precedence\b/i.test(text);

    const claims: Claim[] = [];
    const featureSupport: Partial<Record<AtlasFeatureId, FeatureSupportLevel>> = {};

    if (hasClaudeMd && hasProjectMemory) {
      claims.push(
        buildClaim({
          id: "claude-code.repo-instructions.claude-md",
          statement: "Claude Code uses CLAUDE.md as project memory (repository instructions).",
          confidence: "high",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "CLAUDE.md",
          features: ["repo-instructions"],
        })
      );
      setSupport(featureSupport, "repo-instructions", "yes");
    }

    if (hasDirectoryMemory) {
      claims.push(
        buildClaim({
          id: "claude-code.path-scoping.directory-memory",
          statement: "Claude Code supports directory-scoped memory via additional CLAUDE.md files in subdirectories.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "directory memory",
          features: ["path-scoping"],
        })
      );
      setSupport(featureSupport, "path-scoping", "yes");
    }

    if (hasPrecedence) {
      claims.push(
        buildClaim({
          id: "claude-code.path-scoping.precedence",
          statement: "More specific Claude Code memory can take precedence over more general project memory.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "precedence",
          features: ["path-scoping"],
        })
      );
    }

    setSupport(featureSupport, "imports", "no");

    claims.sort((a, b) => a.id.localeCompare(b.id));
    return { claims, featureSupport };
  },
};

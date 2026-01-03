import type { AtlasExtractor } from "./types.ts";
import type { AtlasFeatureId } from "../../../src/lib/atlas/features.ts";
import type { Claim, FeatureSupportLevel } from "../../../src/lib/atlas/types.ts";

function normalizeText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // Windsurf Docs uses Next.js RSC; the page content is serialized into inline scripts.
    // Keep script *contents* while removing script tags so we can match docs text reliably.
    .replace(/<script\b[^>]*>/gi, " ")
    .replace(/<\/script>/gi, " ")
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

export const windsurfRulesDocsExtractor: AtlasExtractor = {
  sourceId: "windsurf-windsurfrules",
  extract: ({ source, html }) => {
    const text = normalizeText(html);
    const evidenceTitle = "Windsurf documentation";

    const hasAgentsMd = /\bAGENTS\.md\b/i.test(text) || /\bagents\.md\b/i.test(text);
    const hasDirectoryScoping =
      /\bdirectory-scoped\b/i.test(text) ||
      /\bsubdirectories\b/i.test(text) ||
      /\bsubdirectory\b/i.test(text) ||
      /\bDiscovery and Scoping\b/i.test(text);

    const hasCodeiumIgnore = /\B\.codeiumignore\b/i.test(text) || /\bcodeiumignore\b/i.test(text);

    const claims: Claim[] = [];
    const featureSupport: Partial<Record<AtlasFeatureId, FeatureSupportLevel>> = {};

    if (hasAgentsMd) {
      claims.push(
        buildClaim({
          id: "windsurf.repo-instructions.file",
          statement: "Windsurf Cascade supports directory-scoped instructions via AGENTS.md files.",
          confidence: "high",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "AGENTS.md",
          features: ["repo-instructions"],
        })
      );
      setSupport(featureSupport, "repo-instructions", "yes");
    }

    if (hasAgentsMd && hasDirectoryScoping) {
      claims.push(
        buildClaim({
          id: "windsurf.path-scoping.hierarchy",
          statement: "Windsurf Cascade applies subdirectory AGENTS.md instructions to files within that directory and its subdirectories.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: "directory-scoped",
          features: ["path-scoping"],
        })
      );
      setSupport(featureSupport, "path-scoping", "yes");
    }

    if (hasCodeiumIgnore) {
      claims.push(
        buildClaim({
          id: "windsurf.ignore-file.codeiumignore",
          statement: "Windsurf Indexing supports ignoring files via a .codeiumignore file.",
          confidence: "medium",
          evidenceUrl: source.url,
          evidenceTitle,
          excerpt: ".codeiumignore",
        })
      );
    }

    setSupport(featureSupport, "imports", "no");

    claims.sort((a, b) => a.id.localeCompare(b.id));
    return { claims, featureSupport };
  },
};

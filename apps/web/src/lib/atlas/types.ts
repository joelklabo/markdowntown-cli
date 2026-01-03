export const ATLAS_FACTS_SCHEMA_VERSION = 1 as const;

export type AtlasFactsSchemaVersion = typeof ATLAS_FACTS_SCHEMA_VERSION;

export type AtlasPlatformId =
  | 'github-copilot'
  | 'copilot-cli'
  | 'claude-code'
  | 'gemini-cli'
  | 'codex-cli'
  | 'cursor'
  | 'windsurf';

export type ArtifactKind = string;

export type ClaimConfidence = 'high' | 'medium' | 'low';

export type FeatureSupportLevel = 'yes' | 'partial' | 'no';

export interface Evidence {
  url: string;
  excerpt?: string;
  title?: string;
}

export interface Claim {
  id: string;
  statement: string;
  confidence: ClaimConfidence;
  evidence: Evidence[];
  features?: string[];
  artifacts?: ArtifactKind[];
}

export interface ArtifactSpec {
  kind: ArtifactKind;
  label: string;
  description?: string;
  paths: string[];
  docs?: string;
}

export interface PlatformFacts {
  schemaVersion: AtlasFactsSchemaVersion;
  platformId: AtlasPlatformId;
  name: string;
  docHome?: string;
  retrievedAt: string;
  lastVerified: string;
  artifacts: ArtifactSpec[];
  claims: Claim[];
  featureSupport: Record<string, FeatureSupportLevel>;
}


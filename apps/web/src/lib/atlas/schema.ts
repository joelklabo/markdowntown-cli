import { z } from 'zod';
import { ATLAS_FACTS_SCHEMA_VERSION, type PlatformFacts } from './types.ts';

export const AtlasPlatformIdSchema = z.enum([
  'github-copilot',
  'copilot-cli',
  'claude-code',
  'gemini-cli',
  'codex-cli',
  'cursor',
  'windsurf',
]);

const ArtifactKindSchema = z.string().min(1);

const FeatureSupportLevelSchema = z.enum(['yes', 'partial', 'no']);

const EvidenceSchema = z.object({
  url: z
    .string()
    .url()
    .refine(url => url.startsWith('http://') || url.startsWith('https://'), {
      message: 'Evidence url must use http(s)',
    }),
  excerpt: z.string().max(200).optional(),
  title: z.string().min(1).optional(),
});

const ClaimConfidenceSchema = z.enum(['high', 'medium', 'low']);

const ClaimSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  confidence: ClaimConfidenceSchema,
  evidence: z.array(EvidenceSchema).min(1),
  features: z.array(z.string().min(1)).optional(),
  artifacts: z.array(ArtifactKindSchema).optional(),
});

const ArtifactSpecSchema = z.object({
  kind: ArtifactKindSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  paths: z.array(z.string().min(1)).min(1),
  docs: z.string().url().optional(),
});

export const PlatformFactsSchema = z.object({
  schemaVersion: z.literal(ATLAS_FACTS_SCHEMA_VERSION),
  platformId: AtlasPlatformIdSchema,
  name: z.string().min(1),
  docHome: z.string().url().optional(),
  retrievedAt: z.string().datetime(),
  lastVerified: z.string().datetime(),
  artifacts: z.array(ArtifactSpecSchema).default(() => []),
  claims: z.array(ClaimSchema).default(() => []),
  featureSupport: z.record(z.string().min(1), FeatureSupportLevelSchema).default(() => ({})),
});

export function parsePlatformFacts(input: unknown): PlatformFacts {
  return PlatformFactsSchema.parse(input);
}

export function safeParsePlatformFacts(input: unknown) {
  return PlatformFactsSchema.safeParse(input);
}

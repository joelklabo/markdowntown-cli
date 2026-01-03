import { describe, expect, it } from 'vitest';
import { PlatformFactsSchema } from '@/lib/atlas/schema';

const validFacts = {
  schemaVersion: 1,
  platformId: 'cursor',
  name: 'Cursor',
  docHome: 'https://example.com/docs',
  retrievedAt: '2025-12-17T00:00:00Z',
  lastVerified: '2025-12-17T00:00:00Z',
  artifacts: [
    {
      kind: 'cursor-rules',
      label: 'Project rules',
      paths: ['.cursor/rules/*.mdc'],
      docs: 'https://example.com/docs/rules',
    },
  ],
  claims: [
    {
      id: 'cursor.rules.paths',
      statement: 'Cursor loads project rules from .cursor/rules/*.mdc.',
      confidence: 'high',
      evidence: [
        {
          url: 'https://example.com/docs/rules',
          excerpt: 'Rules live under .cursor/rules/*.mdc (example excerpt).',
        },
      ],
      features: ['repo-instructions'],
      artifacts: ['cursor-rules'],
    },
  ],
  featureSupport: {
    'repo-instructions': 'yes',
  },
};

describe('PlatformFactsSchema', () => {
  it('validates a valid facts payload', () => {
    const result = PlatformFactsSchema.safeParse(validFacts);
    expect(result.success).toBe(true);
  });

  it('rejects evidence.url that is not http(s)', () => {
    const result = PlatformFactsSchema.safeParse({
      ...validFacts,
      claims: [
        {
          ...validFacts.claims[0],
          evidence: [{ url: 'ftp://example.com/doc' }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects evidence.excerpt longer than 200 chars', () => {
    const result = PlatformFactsSchema.safeParse({
      ...validFacts,
      claims: [
        {
          ...validFacts.claims[0],
          evidence: [{ url: 'https://example.com/doc', excerpt: 'a'.repeat(201) }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects claims with empty evidence arrays', () => {
    const result = PlatformFactsSchema.safeParse({
      ...validFacts,
      claims: [
        {
          ...validFacts.claims[0],
          evidence: [],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown confidence values', () => {
    const result = PlatformFactsSchema.safeParse({
      ...validFacts,
      claims: [
        {
          ...validFacts.claims[0],
          confidence: 'certain',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-ISO retrievedAt/lastVerified timestamps', () => {
    const result = PlatformFactsSchema.safeParse({
      ...validFacts,
      retrievedAt: '2025-12-17',
      lastVerified: 'nope',
    });

    expect(result.success).toBe(false);
  });
});


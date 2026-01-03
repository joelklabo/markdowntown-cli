import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listAtlasPlatforms,
  loadAtlasCrosswalk,
  loadAtlasExample,
  loadAtlasFacts,
  loadAtlasGuideMdx,
} from '@/lib/atlas/load';

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function writeText(filePath: string, contents: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

let tempAtlasDir: string | undefined;

afterEach(() => {
  if (tempAtlasDir) fs.rmSync(tempAtlasDir, { recursive: true, force: true });
  tempAtlasDir = undefined;
});

describe('atlas/load', () => {
  it('loads platforms, facts, guides, examples, and crosswalk', () => {
    tempAtlasDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdt-atlas-'));

    writeJson(path.join(tempAtlasDir, 'crosswalk.json'), {
      schemaVersion: 1,
      crosswalk: { 'repo-instructions': { cursor: ['repo-instructions'] } },
    });

    writeJson(path.join(tempAtlasDir, 'facts', 'cursor.json'), {
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
              excerpt: 'Rules live under .cursor/rules/*.mdc.',
            },
          ],
          features: ['repo-instructions'],
          artifacts: ['cursor-rules'],
        },
      ],
      featureSupport: {
        'repo-instructions': 'yes',
      },
    });

    writeText(path.join(tempAtlasDir, 'guides', 'getting-started.mdx'), '# Hello');

    writeText(path.join(tempAtlasDir, 'examples', 'cursor', 'basic.md'), 'Example text');

    expect(listAtlasPlatforms({ atlasDir: tempAtlasDir })).toEqual(['cursor']);
    expect(loadAtlasFacts('cursor', { atlasDir: tempAtlasDir }).platformId).toBe('cursor');
    expect(loadAtlasGuideMdx('getting-started', { atlasDir: tempAtlasDir })).toContain('Hello');
    expect(loadAtlasExample('cursor', 'basic.md', { atlasDir: tempAtlasDir })).toContain('Example text');
    expect(loadAtlasCrosswalk({ atlasDir: tempAtlasDir }).schemaVersion).toBe(1);
  });

  it('surfaces actionable schema errors when facts are invalid', () => {
    tempAtlasDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdt-atlas-'));

    writeJson(path.join(tempAtlasDir, 'facts', 'cursor.json'), {
      schemaVersion: 1,
      platformId: 'cursor',
      name: 'Cursor',
      retrievedAt: '2025-12-17T00:00:00Z',
      lastVerified: '2025-12-17T00:00:00Z',
      artifacts: [],
      claims: [
        {
          id: 'bad.url',
          statement: 'Bad evidence url',
          confidence: 'high',
          evidence: [{ url: 'ftp://example.com/docs' }],
        },
      ],
      featureSupport: {},
    });

    expect(() => loadAtlasFacts('cursor', { atlasDir: tempAtlasDir })).toThrow(/Invalid facts/);
    expect(() => loadAtlasFacts('cursor', { atlasDir: tempAtlasDir })).toThrow(/evidence/);
  });

  it('surfaces actionable JSON parse errors', () => {
    tempAtlasDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdt-atlas-'));

    const factsPath = path.join(tempAtlasDir, 'facts', 'cursor.json');
    fs.mkdirSync(path.dirname(factsPath), { recursive: true });
    fs.writeFileSync(factsPath, '{', 'utf8');

    expect(() => loadAtlasFacts('cursor', { atlasDir: tempAtlasDir })).toThrow(/Invalid JSON/);
  });

  it('throws when facts directory contains unknown platform ids', () => {
    tempAtlasDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdt-atlas-'));
    writeJson(path.join(tempAtlasDir, 'facts', 'unknown.json'), { schemaVersion: 1 });

    expect(() => listAtlasPlatforms({ atlasDir: tempAtlasDir })).toThrow(/Unknown platformId/);
  });
});


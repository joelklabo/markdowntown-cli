import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATLAS_FEATURES, parseAtlasCrosswalk } from '@/lib/atlas/features';

describe('atlas/features', () => {
  it('defines stable, unique feature ids', () => {
    const ids = ATLAS_FEATURES.map(feature => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes core compare concepts', () => {
    const ids = new Set(ATLAS_FEATURES.map(feature => feature.id));
    expect(ids.has('repo-instructions')).toBe(true);
    expect(ids.has('path-scoping')).toBe(true);
    expect(ids.has('imports')).toBe(true);
  });
});

describe('atlas/crosswalk.json', () => {
  it('parses and validates', () => {
    const crosswalkPath = path.join(process.cwd(), 'atlas', 'crosswalk.json');
    const raw = JSON.parse(fs.readFileSync(crosswalkPath, 'utf8'));
    expect(() => parseAtlasCrosswalk(raw)).not.toThrow();
  });
});


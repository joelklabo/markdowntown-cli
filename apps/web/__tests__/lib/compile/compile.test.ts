import { describe, expect, it } from 'vitest';
import type { Adapter } from '@/lib/adapters';
import { createAdapterRegistry } from '@/lib/adapters';
import { compileUamV1 } from '@/lib/compile/compile';
import { createEmptyUamV1, createUamTargetV1 } from '@/lib/uam/uamTypes';

describe('adapter registry + compile orchestrator', () => {
  it('resolves adapters by targetId + version', () => {
    const registry = createAdapterRegistry();

    const v1: Adapter = {
      id: 'agents-md',
      version: '1',
      label: 'AGENTS.md',
      compile: () => ({ files: [], warnings: [], info: [] }),
    };

    const v2: Adapter = {
      id: 'agents-md',
      version: '2',
      label: 'AGENTS.md',
      compile: () => ({ files: [], warnings: [], info: [] }),
    };

    registry.register(v1);
    registry.register(v2);

    expect(registry.resolve('agents-md', '1')).toBe(v1);
    expect(registry.resolve('agents-md', '2')).toBe(v2);
    expect(registry.resolve('agents-md', '999')).toBeUndefined();
    expect(registry.resolve('missing', '1')).toBeUndefined();
  });

  it('aggregates results with stable file ordering', async () => {
    const registry = createAdapterRegistry();

    registry.register({
      id: 'b',
      version: '1',
      label: 'B',
      compile: () => ({
        files: [{ path: 'b.txt', content: 'B' }],
        warnings: ['wb'],
        info: ['ib'],
      }),
    });

    registry.register({
      id: 'a',
      version: '1',
      label: 'A',
      compile: () => ({
        // Deliberately reversed order to prove stable sorting.
        files: [
          { path: 'c.txt', content: 'C' },
          { path: 'a.txt', content: 'A' },
        ],
        warnings: [],
        info: [],
      }),
    });

    const uam = createEmptyUamV1();
    const targets = [createUamTargetV1('b'), createUamTargetV1('a')];
    const result = await compileUamV1(uam, targets, registry);

    expect(result.files.map(f => f.path)).toEqual(['a.txt', 'b.txt', 'c.txt']);
    expect(result.warnings.some(w => w.includes('wb'))).toBe(true);
    expect(result.info.some(i => i.includes('ib'))).toBe(true);
  });

  it('warns on unknown targets and unknown versions', async () => {
    const registry = createAdapterRegistry();
    registry.register({
      id: 'known',
      version: '1',
      label: 'Known',
      compile: () => ({ files: [], warnings: [], info: [] }),
    });

    const uam = createEmptyUamV1();
    const result = await compileUamV1(
      uam,
      [createUamTargetV1('missing'), { targetId: 'known', adapterVersion: '2', options: {} }],
      registry
    );

    expect(result.warnings).toEqual(
      expect.arrayContaining(['Unknown target: known@2', 'Unknown target: missing@1'])
    );
  });

  it('detects file path collisions deterministically', async () => {
    const registry = createAdapterRegistry();

    registry.register({
      id: 'a',
      version: '1',
      label: 'A',
      compile: () => ({ files: [{ path: 'same.txt', content: 'A' }], warnings: [], info: [] }),
    });

    registry.register({
      id: 'b',
      version: '1',
      label: 'B',
      compile: () => ({ files: [{ path: 'same.txt', content: 'B' }], warnings: [], info: [] }),
    });

    const uam = createEmptyUamV1();

    const result1 = await compileUamV1(uam, [createUamTargetV1('b'), createUamTargetV1('a')], registry);
    const result2 = await compileUamV1(uam, [createUamTargetV1('a'), createUamTargetV1('b')], registry);

    expect(result1.files).toHaveLength(1);
    expect(result2.files).toHaveLength(1);
    expect(result1.files[0]?.content).toBe('A');
    expect(result2.files[0]?.content).toBe('A');
    expect(result1.warnings.some(w => w.includes('File path collision'))).toBe(true);
  });
});

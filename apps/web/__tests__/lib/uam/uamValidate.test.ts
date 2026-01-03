import { describe, expect, it } from 'vitest';
import { parseUamV1, safeParseUamV1 } from '@/lib/uam/uamValidate';
import { createEmptyUamV1, wrapMarkdownAsGlobal } from '@/lib/uam/uamTypes';

describe('UAM v1 validation', () => {
  it('parses a minimal payload and applies array defaults', () => {
    const parsed = parseUamV1({
      schemaVersion: 1,
      meta: { title: 'Test' },
    });

    expect(parsed.scopes).toEqual([]);
    expect(parsed.blocks).toEqual([]);
    expect(parsed.capabilities).toEqual([]);
    expect(parsed.targets).toEqual([]);
  });

  it('applies minimal target defaults', () => {
    const parsed = parseUamV1({
      schemaVersion: 1,
      meta: { title: 'Test' },
      targets: [{ targetId: 'agents-md-codex' }],
    });

    expect(parsed.targets).toHaveLength(1);
    expect(parsed.targets[0]?.adapterVersion).toBe('1');
    expect(parsed.targets[0]?.options).toEqual({});
  });

  it('rejects unknown block kinds', () => {
    const result = safeParseUamV1({
      schemaVersion: 1,
      meta: { title: 'Test' },
      scopes: [{ id: 'global', kind: 'global' }],
      blocks: [{ id: 'b1', scopeId: 'global', kind: 'instruction', body: 'hi' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid glob patterns', () => {
    const result = safeParseUamV1({
      schemaVersion: 1,
      meta: { title: 'Test' },
      scopes: [{ id: 's1', kind: 'glob', patterns: ['[abc'] }],
      blocks: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects blocks that reference unknown scopes', () => {
    const result = safeParseUamV1({
      schemaVersion: 1,
      meta: { title: 'Test' },
      scopes: [{ id: 'global', kind: 'global' }],
      blocks: [{ id: 'b1', scopeId: 'missing', kind: 'markdown', body: 'hi' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects duplicate capability ids', () => {
    const result = safeParseUamV1({
      schemaVersion: 1,
      meta: { title: 'Test' },
      capabilities: [{ id: 'dup' }, { id: 'dup' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid capability ids', () => {
    const result = safeParseUamV1({
      schemaVersion: 1,
      meta: { title: 'Test' },
      capabilities: [{ id: 'Not Allowed' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects too many capabilities', () => {
    const capabilities = Array.from({ length: 65 }, (_, index) => ({ id: `cap-${index}` }));
    const result = safeParseUamV1({
      schemaVersion: 1,
      meta: { title: 'Test' },
      capabilities,
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-serializable capability params', () => {
    const result = safeParseUamV1({
      schemaVersion: 1,
      meta: { title: 'Test' },
      capabilities: [{ id: 'json-only', params: { value: BigInt(1) } }],
    });

    expect(result.success).toBe(false);
  });

  it('helper constructors create valid UAM v1', () => {
    expect(() => parseUamV1(createEmptyUamV1())).not.toThrow();
    expect(() => parseUamV1(wrapMarkdownAsGlobal('# Hello'))).not.toThrow();
  });
});

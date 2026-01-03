import { describe, it, expect, beforeEach } from 'vitest';
import { registerAdapter, getAdapter, getAllAdapters, Adapter } from '@/lib/uam/adapters';

describe('Adapter Registry', () => {
  const mockAdapter: Adapter = {
    id: 'test-adapter',
    name: 'Test Adapter',
    compile: () => {
      return { files: [], warnings: [] };
    },
  };

  beforeEach(() => {
    // Note: Registry is a module-level singleton, so state persists. 
    // In a real app we might want a clearRegistry() for testing, but for now we just register.
    registerAdapter(mockAdapter);
  });

  it('can retrieve a registered adapter', () => {
    const adapter = getAdapter('test-adapter');
    expect(adapter).toBeDefined();
    expect(adapter?.name).toBe('Test Adapter');
  });

  it('returns undefined for unknown adapter', () => {
    const adapter = getAdapter('unknown-adapter');
    expect(adapter).toBeUndefined();
  });

  it('lists all registered adapters', () => {
    const adapters = getAllAdapters();
    expect(adapters).toContain(mockAdapter);
  });
});

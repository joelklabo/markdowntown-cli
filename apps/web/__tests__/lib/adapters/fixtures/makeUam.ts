import type { UamV1 } from '@/lib/uam/uamTypes';

export function makeUam(overrides: Partial<UamV1> = {}): UamV1 {
  return {
    schemaVersion: 1,
    meta: { title: 'Test' },
    scopes: [],
    blocks: [],
    capabilities: [],
    targets: [],
    ...overrides,
  };
}


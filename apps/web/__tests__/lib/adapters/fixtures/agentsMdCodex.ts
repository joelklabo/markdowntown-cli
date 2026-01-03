import type { AdapterFixture } from './types';
import { makeUam } from './makeUam';

export const agentsMdCodexFixtures: AdapterFixture[] = [
  {
    name: 'basic',
    uam: makeUam({
      scopes: [
        { id: 'global', kind: 'global' },
        { id: 'src', kind: 'dir', dir: 'src' },
        { id: 'lib', kind: 'dir', dir: 'src/lib/' },
      ],
      blocks: [
        { id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Root content' },
        { id: 'b2', scopeId: 'src', kind: 'markdown', body: 'Src content' },
        { id: 'b3', scopeId: 'lib', kind: 'markdown', body: 'Lib content' },
      ],
    }),
    expected: {
      files: [
        { path: 'AGENTS.md', content: 'Root content' },
        { path: 'src/AGENTS.md', content: 'Src content' },
        { path: 'src/lib/AGENTS.md', content: 'Lib content' },
      ],
      warnings: [],
      info: [],
    },
  },
];


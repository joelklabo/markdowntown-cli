import type { AdapterFixture } from './types';
import { makeUam } from './makeUam';

export const claudeCodeFixtures: AdapterFixture[] = [
  {
    name: 'global+dir',
    uam: makeUam({
      scopes: [
        { id: 'global', kind: 'global' },
        { id: 'src', kind: 'dir', dir: 'src' },
      ],
      blocks: [
        { id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Global rules' },
        { id: 'b2', scopeId: 'src', kind: 'markdown', body: 'Src rules' },
      ],
    }),
    expected: {
      files: [
        { path: '.claude/rules/src.md', content: ['# Rules for src', '', 'Src rules', ''].join('\n') },
        { path: 'CLAUDE.md', content: 'Global rules\n' },
      ],
      warnings: [],
      info: [],
    },
  },
];


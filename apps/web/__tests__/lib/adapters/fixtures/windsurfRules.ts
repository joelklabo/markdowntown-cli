import type { AdapterFixture } from './types';
import { makeUam } from './makeUam';

export const windsurfRulesFixtures: AdapterFixture[] = [
  {
    name: 'global+dir+glob',
    uam: makeUam({
      scopes: [
        { id: 'global', kind: 'global' },
        { id: 'src', kind: 'dir', dir: 'src' },
        { id: 'ts', kind: 'glob', name: 'typescript', patterns: ['src/**/*.ts'] },
      ],
      blocks: [
        { id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Global rules' },
        { id: 'b2', scopeId: 'src', kind: 'markdown', body: 'Src rules' },
        { id: 'b3', scopeId: 'ts', kind: 'markdown', body: 'TS rules' },
      ],
    }),
    expected: {
      files: [
        { path: '.windsurf/rules/src.md', content: ['# Rules for src', '', 'Src rules', ''].join('\n') },
        { path: '.windsurf/rules/typescript.md', content: ['# Rules for src/**/*.ts', '', 'TS rules', ''].join('\n') },
        { path: 'global_rules.md', content: 'Global rules\n' },
      ],
      warnings: [],
      info: [],
    },
  },
];


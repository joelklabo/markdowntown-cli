import type { AdapterFixture } from './types';
import { makeUam } from './makeUam';

export const githubCopilotFixtures: AdapterFixture[] = [
  {
    name: 'global+glob',
    uam: makeUam({
      scopes: [
        { id: 'global', kind: 'global' },
        { id: 'ts', kind: 'glob', name: 'typescript', patterns: ['src/**/*.ts'] },
      ],
      blocks: [
        { id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Global rules' },
        { id: 'b2', scopeId: 'ts', kind: 'markdown', body: 'TS rules' },
      ],
    }),
    expected: {
      files: [
        { path: '.github/copilot-instructions.md', content: 'Global rules' },
        {
          path: '.github/instructions/typescript.instructions.md',
          content: ['---', 'applyTo: "src/**/*.ts"', '---', 'TS rules', ''].join('\n'),
        },
      ],
      warnings: [],
      info: [],
    },
  },
];


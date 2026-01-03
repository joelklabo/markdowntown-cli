import type { AdapterFixture } from './types';
import { makeUam } from './makeUam';

export const geminiCliFixtures: AdapterFixture[] = [
  {
    name: 'modular',
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
    target: { targetId: 'gemini-cli', adapterVersion: '1', options: { modular: true } },
    expected: {
      files: [
        { path: '.gemini/scopes/src.md', content: ['# Scope: src', '', 'Src rules', ''].join('\n') },
        { path: '.gemini/scopes/typescript.md', content: ['# Scope: src/**/*.ts', '', 'TS rules', ''].join('\n') },
        {
          path: 'GEMINI.md',
          content: ['Global rules', '', '---', '', '@.gemini/scopes/src.md', '@.gemini/scopes/typescript.md', ''].join(
            '\n'
          ),
        },
      ],
      warnings: [
        "Scope 'src' cannot be enforced in GEMINI.md. Exported content will apply globally (lossy).",
        "Scope 'src/**/*.ts' cannot be enforced in GEMINI.md. Exported content will apply globally (lossy).",
      ],
      info: [],
    },
  },
];


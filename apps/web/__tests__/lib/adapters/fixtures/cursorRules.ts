import type { AdapterFixture } from './types';
import { makeUam } from './makeUam';

export const cursorRulesFixtures: AdapterFixture[] = [
  {
    name: 'global+dir+glob',
    uam: makeUam({
      scopes: [
        { id: 'global', kind: 'global' },
        { id: 'src', kind: 'dir', dir: 'src' },
        { id: 'ts', kind: 'glob', name: 'typescript', patterns: ['src/**/*.ts'] },
      ],
      blocks: [
        { id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Global body' },
        { id: 'b2', scopeId: 'src', kind: 'markdown', body: 'Src body' },
        { id: 'b3', scopeId: 'ts', kind: 'markdown', body: 'TS body' },
      ],
    }),
    expected: {
      files: [
        {
          path: '.cursor/rules/global.mdc',
          content: [
            '---',
            'description: "Global rules"',
            'globs:',
            '  - "**/*"',
            'alwaysApply: true',
            '---',
            '',
            'Global body',
            '',
          ].join('\n'),
        },
        {
          path: '.cursor/rules/src.mdc',
          content: [
            '---',
            'description: "Rules for src"',
            'globs:',
            '  - "src/**"',
            'alwaysApply: false',
            '---',
            '',
            'Src body',
            '',
          ].join('\n'),
        },
        {
          path: '.cursor/rules/typescript.mdc',
          content: [
            '---',
            'description: "typescript"',
            'globs:',
            '  - "src/**/*.ts"',
            'alwaysApply: false',
            '---',
            '',
            'TS body',
            '',
          ].join('\n'),
        },
      ],
      warnings: [],
      info: [],
    },
  },
];


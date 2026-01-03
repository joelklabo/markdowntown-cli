import type { CompiledFile, CompileResult } from '@/lib/adapters/types';
import type { UamTargetV1, UamV1 } from '@/lib/uam/uamTypes';

export type ExpectedCompileResult = Pick<CompileResult, 'warnings' | 'info'> & {
  files: CompiledFile[];
};

export type AdapterFixture = {
  name: string;
  uam: UamV1;
  target?: UamTargetV1;
  expected: ExpectedCompileResult;
};


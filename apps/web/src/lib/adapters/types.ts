import type { UamTargetV1, UamV1 } from '../uam/uamTypes';

export interface CompiledFile {
  path: string;
  content: string;
}

export interface CompileResult {
  files: CompiledFile[];
  warnings: string[];
  info: string[];
}

export interface Adapter {
  id: string;
  version: string;
  label: string;
  description?: string;
  compile(uam: UamV1, target?: UamTargetV1): Promise<CompileResult> | CompileResult;
  detect?: (input: unknown) => boolean;
  import?: (input: unknown) => UamV1;
}

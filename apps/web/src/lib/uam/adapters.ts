import { UniversalAgentDefinition } from './types';

export interface CompiledFile {
  path: string;
  content: string;
}

export interface CompilationResult {
  files: CompiledFile[];
  warnings: string[];
  info?: string[];
}

export interface CompileOptions {
  // potentially add context or override options here
  targetPlatform?: string;
}

export interface Adapter {
  id: string;
  name: string;
  description?: string;
  compile(def: UniversalAgentDefinition, options?: CompileOptions): Promise<CompilationResult> | CompilationResult;
}

const registry = new Map<string, Adapter>();

export function registerAdapter(adapter: Adapter) {
  registry.set(adapter.id, adapter);
}

export function getAdapter(id: string): Adapter | undefined {
  return registry.get(id);
}

export function getAllAdapters(): Adapter[] {
  return Array.from(registry.values());
}

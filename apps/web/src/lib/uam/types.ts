export interface UAMMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  homepage?: string;
  license?: string;
}

export type UAMScope = string;

export interface UAMCapability {
  name: string;
  description?: string;
  params?: Record<string, unknown>;
}

export type UAMBlockType = 'instruction' | 'prompt' | 'code' | 'context' | 'unknown';

export interface UAMBlock {
  id: string;
  type: UAMBlockType;
  content: string;
  metadata?: Record<string, unknown>;
  scopes?: UAMScope[];
}

export interface UAMTarget {
  platform: string;
  minVersion?: string;
}

export interface UniversalAgentDefinition {
  kind: 'UniversalAgent';
  apiVersion: 'v1';
  metadata: UAMMetadata;
  scopes?: UAMScope[];
  capabilities?: UAMCapability[];
  blocks: UAMBlock[];
  targets?: UAMTarget[];
}

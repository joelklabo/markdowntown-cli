import { z } from 'zod';
import { DEFAULT_ADAPTER_VERSION, UAM_V1_SCHEMA_VERSION, type UamV1 } from './uamTypes';

const MAX_CAPABILITIES = 64;
const MAX_CAPABILITY_ID = 80;
const MAX_CAPABILITY_TITLE = 120;
const MAX_CAPABILITY_DESCRIPTION = 4000;
const MAX_CAPABILITY_PARAM_KEYS = 32;
const MAX_CAPABILITY_PARAM_KEY_LENGTH = 64;
const MAX_CAPABILITY_PARAMS_BYTES = 32768;
const CAPABILITY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

function isValidGlobPattern(pattern: string): boolean {
  if (pattern.trim().length === 0) return false;

  let escaping = false;
  let inClass = false;
  let braceDepth = 0;

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (ch === '\\') {
      escaping = true;
      continue;
    }

    if (inClass) {
      if (ch === ']') inClass = false;
      continue;
    }

    if (ch === '[') {
      inClass = true;
      continue;
    }

    if (ch === ']') {
      return false;
    }

    if (ch === '{') {
      braceDepth++;
      continue;
    }

    if (ch === '}') {
      if (braceDepth === 0) return false;
      braceDepth--;
      continue;
    }
  }

  return !escaping && !inClass && braceDepth === 0;
}

const UamMetaV1Schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

const UamGlobPatternSchema = z
  .string()
  .min(1)
  .refine(isValidGlobPattern, { message: 'Invalid glob pattern syntax' });

export const UamScopeV1Schema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    kind: z.literal('global'),
    name: z.string().min(1).optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('dir'),
    dir: z.string().min(1),
    name: z.string().min(1).optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('glob'),
    patterns: z.array(UamGlobPatternSchema).min(1),
    name: z.string().min(1).optional(),
  }),
]);

const UamBlockKindV1Schema = z.enum(['markdown', 'checklist', 'commands', 'dos-donts', 'files']);

const UamBlockV1Schema = z.object({
  id: z.string().min(1),
  scopeId: z.string().min(1),
  kind: UamBlockKindV1Schema,
  title: z.string().min(1).optional(),
  body: z.string(),
});

const UamCapabilityParamsSchema = z
  .record(z.string().min(1).max(MAX_CAPABILITY_PARAM_KEY_LENGTH), z.unknown())
  .superRefine((params, ctx) => {
    const keys = Object.keys(params);
    if (keys.length > MAX_CAPABILITY_PARAM_KEYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Capability params exceed ${MAX_CAPABILITY_PARAM_KEYS} keys`,
      });
    }

    try {
      const size = JSON.stringify(params).length;
      if (size > MAX_CAPABILITY_PARAMS_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Capability params exceed ${MAX_CAPABILITY_PARAMS_BYTES} bytes`,
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Capability params must be JSON-serializable',
      });
    }
  })
  .optional();

const UamCapabilityV1Schema = z.object({
  id: z.string().min(1).max(MAX_CAPABILITY_ID).regex(CAPABILITY_ID_PATTERN, {
    message: 'Capability id must be slug-like (letters, numbers, ., _, -)',
  }),
  title: z.string().min(1).max(MAX_CAPABILITY_TITLE).optional(),
  description: z.string().max(MAX_CAPABILITY_DESCRIPTION).optional(),
  params: UamCapabilityParamsSchema,
});

export const UamTargetV1Schema = z.object({
  targetId: z.string().min(1),
  adapterVersion: z.string().min(1).default(DEFAULT_ADAPTER_VERSION),
  options: z.record(z.string(), z.unknown()).default(() => ({})),
});

export const UamV1Schema = z
  .object({
    schemaVersion: z.literal(UAM_V1_SCHEMA_VERSION),
    meta: UamMetaV1Schema,
    scopes: z.array(UamScopeV1Schema).default(() => []),
    blocks: z.array(UamBlockV1Schema).default(() => []),
    capabilities: z.array(UamCapabilityV1Schema).default(() => []),
    targets: z.array(UamTargetV1Schema).default(() => []),
  })
  .superRefine((value, ctx) => {
    const scopeIds = new Set(value.scopes.map(s => s.id));

    const duplicates = new Set<string>();
    for (const id of value.scopes.map(s => s.id)) {
      if (duplicates.has(id)) continue;
      if (value.scopes.filter(s => s.id === id).length > 1) {
        duplicates.add(id);
      }
    }

    for (const dup of duplicates) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scopes'],
        message: `Duplicate scope id: ${dup}`,
      });
    }

    value.blocks.forEach((block, index) => {
      if (!scopeIds.has(block.scopeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['blocks', index, 'scopeId'],
          message: `Unknown scopeId: ${block.scopeId}`,
        });
      }
    });

    if (value.capabilities.length > MAX_CAPABILITIES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capabilities'],
        message: `Capabilities exceed ${MAX_CAPABILITIES} entries`,
      });
    }

    const capabilityIds = new Set<string>();
    value.capabilities.forEach((capability, index) => {
      if (capabilityIds.has(capability.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['capabilities', index, 'id'],
          message: `Duplicate capability id: ${capability.id}`,
        });
      } else {
        capabilityIds.add(capability.id);
      }
    });
  });

export function parseUamV1(input: unknown): UamV1 {
  return UamV1Schema.parse(input);
}

export function safeParseUamV1(input: unknown) {
  return UamV1Schema.safeParse(input);
}

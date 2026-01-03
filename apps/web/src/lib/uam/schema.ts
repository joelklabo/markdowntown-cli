import { z } from 'zod';

// Legacy UniversalAgentDefinition (pre-UAM v1).
// Used by the /translate compile API; newer UAM v1 flows use uamTypes.ts + uamValidate.ts.

const UAMMetadataSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  icon: z.string().optional(),
  homepage: z.string().url().optional(),
  license: z.string().optional(),
});

const UAMScopeSchema = z.string();

const MAX_CAPABILITY_NAME = 80;
const MAX_CAPABILITY_DESCRIPTION = 4000;
const MAX_CAPABILITY_PARAM_KEYS = 32;
const MAX_CAPABILITY_PARAM_KEY_LENGTH = 64;
const MAX_CAPABILITY_PARAMS_BYTES = 32768;

const UAMCapabilitySchema = z.object({
  name: z.string().min(1).max(MAX_CAPABILITY_NAME),
  description: z.string().max(MAX_CAPABILITY_DESCRIPTION).optional(),
  params: z
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
    .optional(),
});

const UAMBlockTypeSchema = z.enum(['instruction', 'prompt', 'code', 'context', 'unknown']);

const UAMBlockSchema = z.object({
  id: z.string().min(1),
  type: UAMBlockTypeSchema,
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  scopes: z.array(UAMScopeSchema).optional(),
});

const UAMTargetSchema = z.object({
  platform: z.string().min(1),
  minVersion: z.string().optional(),
});

export const UniversalAgentDefinitionSchema = z.object({
  kind: z.literal('UniversalAgent'),
  apiVersion: z.literal('v1'),
  metadata: UAMMetadataSchema,
  scopes: z.array(UAMScopeSchema).optional(),
  capabilities: z.array(UAMCapabilitySchema).optional(),
  blocks: z.array(UAMBlockSchema),
  targets: z.array(UAMTargetSchema).optional(),
});

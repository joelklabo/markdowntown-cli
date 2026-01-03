import { describe, expect, it } from 'vitest';
import { validateSkillPayload } from '@/lib/skills/skillValidate';
import { createEmptyUamV1 } from '@/lib/uam/uamTypes';

describe('Skill payload validation', () => {
  it('accepts valid UAM v1 payloads', () => {
    const payload = createEmptyUamV1({ title: 'Skill Pack' });
    const result = validateSkillPayload(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.meta.title).toBe('Skill Pack');
    }
  });

  it('returns formatted issues for invalid payloads', () => {
    const result = validateSkillPayload({ schemaVersion: 1, meta: {} });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((issue) => issue.path.includes('meta.title'))).toBe(true);
    }
  });
});

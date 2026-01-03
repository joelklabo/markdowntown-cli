import { safeParseUamV1 } from "@/lib/uam/uamValidate";
import type { UamV1 } from "@/lib/uam/uamTypes";

export type SkillValidationIssue = {
  path: string;
  message: string;
};

export class SkillValidationError extends Error {
  slugOrId: string;
  issues: SkillValidationIssue[];

  constructor(slugOrId: string, issues: SkillValidationIssue[]) {
    super(`Invalid skill payload for ${slugOrId}`);
    this.name = "SkillValidationError";
    this.slugOrId = slugOrId;
    this.issues = issues;
  }
}

function formatIssues(input: ReturnType<typeof safeParseUamV1>): SkillValidationIssue[] {
  if (input.success) return [];
  return input.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function validateSkillPayload(input: unknown) {
  const parsed = safeParseUamV1(input);
  if (!parsed.success) {
    return { success: false as const, issues: formatIssues(parsed) };
  }
  return { success: true as const, data: parsed.data as UamV1 };
}

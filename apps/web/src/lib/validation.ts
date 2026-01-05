export const MAX_CONTENT_LENGTH = 10_000;
export const MAX_TITLE_LENGTH = 140;
export const MAX_PROJECT_NAME_LENGTH = 120;
export const MAX_SNAPSHOT_FILES = 5_000;
export const MAX_SNAPSHOT_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_SNAPSHOT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_BLOB_BYTES = MAX_SNAPSHOT_FILE_BYTES;
export const MAX_SNAPSHOT_METADATA_BYTES = 50 * 1024;
export const MAX_CLI_TOKEN_LABEL_LENGTH = 80;

export const MAX_PATCH_BODY_BYTES = 1024 * 1024; // 1MB
export const MAX_AUDIT_ISSUES_PER_UPLOAD = 5000;
export const MAX_AUDIT_MESSAGE_LENGTH = 2000;
export const MAX_RULE_ID_LENGTH = 160;

export function validateSectionPayload(title: string | null, content: string) {
  if (!title) return "Title is required";
  if (title.length > MAX_TITLE_LENGTH) return `Title is too long (max ${MAX_TITLE_LENGTH} characters)`;
  if (content.length > MAX_CONTENT_LENGTH) return `Content is too long (max ${MAX_CONTENT_LENGTH} characters)`;
  const lower = content.toLowerCase();
  if (lower.includes("<script") || lower.includes("<iframe") || lower.includes("javascript:")) {
    return "Content contains disallowed markup";
  }
  return null;
}

export function validatePatchBody(body: string) {
  const size = Buffer.byteLength(body, "utf8");
  if (size > MAX_PATCH_BODY_BYTES) {
    return `Patch body exceeds size limit (max ${MAX_PATCH_BODY_BYTES} bytes)`;
  }
  return null;
}

export function validateAuditIssue(ruleId: string, message: string) {
  if (ruleId.length > MAX_RULE_ID_LENGTH) {
    return `Rule id is too long (max ${MAX_RULE_ID_LENGTH} characters)`;
  }
  if (message.length > MAX_AUDIT_MESSAGE_LENGTH) {
    return `Message is too long (max ${MAX_AUDIT_MESSAGE_LENGTH} characters)`;
  }
  return null;
}

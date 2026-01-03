export const MAX_CONTENT_LENGTH = 10_000;
export const MAX_TITLE_LENGTH = 140;

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

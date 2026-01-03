export const TAG_MAX_COUNT = 8;
export const TAG_MAX_LENGTH = 32;

type NormalizeResult = { ok: true; tag: string } | { ok: false; error: string };

const RAW_TAG_PATTERN = /^[a-zA-Z0-9 _-]+$/;

function normalizeTag(raw: string): NormalizeResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "Tags must be strings" };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Tags cannot be empty" };
  }

  if (!RAW_TAG_PATTERN.test(trimmed)) {
    return { ok: false, error: "Tags can only include letters, numbers, spaces, underscores, or hyphens" };
  }

  const withSpaces = trimmed.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const kebab = withSpaces
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!kebab) {
    return { ok: false, error: "Tags cannot be empty" };
  }

  if (kebab.length > TAG_MAX_LENGTH) {
    return { ok: false, error: `Tags must be ${TAG_MAX_LENGTH} characters or less` };
  }

  return { ok: true, tag: kebab };
}

export function normalizeTags(
  input: unknown,
  options: { strict?: boolean } = {}
): { tags: string[]; error?: string } {
  const { strict = true } = options;

  if (input === undefined || input === null) {
    return { tags: [] };
  }

  let values: string[];
  if (Array.isArray(input)) {
    values = input as string[];
  } else if (typeof input === "string") {
    values = input
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  } else {
    return { tags: [], error: "Tags must be an array of strings" };
  }

  const tags: string[] = [];
  for (const raw of values) {
    if (typeof raw !== "string") {
      if (strict) return { tags: [], error: "Tags must be strings" };
      continue;
    }

    const normalized = normalizeTag(raw);
    if (!normalized.ok) {
      if (strict) return { tags: [], error: normalized.error };
      continue;
    }

    if (!tags.includes(normalized.tag)) {
      tags.push(normalized.tag);
    }

    if (strict && tags.length > TAG_MAX_COUNT) {
      return { tags: [], error: `Too many tags (max ${TAG_MAX_COUNT})` };
    }
  }

  if (!strict && tags.length > TAG_MAX_COUNT) {
    return { tags: tags.slice(0, TAG_MAX_COUNT) };
  }

  return { tags };
}

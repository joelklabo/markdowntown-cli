import { describe, it, expect } from "vitest";
import { normalizeTags, TAG_MAX_COUNT, TAG_MAX_LENGTH } from "@/lib/tags";

describe("normalizeTags", () => {
  it("normalizes casing and spaces to kebab-case", () => {
    const result = normalizeTags([" System Prompt "]);
    expect(result.tags).toEqual(["system-prompt"]);
    expect(result.error).toBeUndefined();
  });

  it("rejects invalid characters", () => {
    const result = normalizeTags(["bad$tag"]);
    expect(result.error).toMatch(/letters, numbers/);
  });

  it("rejects tags over max length", () => {
    const result = normalizeTags(["a".repeat(TAG_MAX_LENGTH + 1)]);
    expect(result.error).toMatch(new RegExp(`${TAG_MAX_LENGTH}`));
  });

  it("enforces a maximum tag count", () => {
    const tooMany = Array.from({ length: TAG_MAX_COUNT + 1 }, (_, i) => `tag-${i}`);
    const result = normalizeTags(tooMany);
    expect(result.error).toMatch(/Too many tags/);
  });

  it("splits comma-separated strings and deduplicates", () => {
    const result = normalizeTags("tools, tools, Style\ncli");
    expect(result.tags).toEqual(["tools", "style", "cli"]);
  });
});

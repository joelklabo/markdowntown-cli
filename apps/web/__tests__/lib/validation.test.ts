import { describe, expect, it } from "vitest";
import {
  MAX_AUDIT_MESSAGE_LENGTH,
  MAX_CONTENT_LENGTH,
  MAX_PATCH_BODY_BYTES,
  MAX_RULE_ID_LENGTH,
  MAX_TITLE_LENGTH,
  validateAuditIssue,
  validatePatchBody,
  validateSectionPayload,
} from "@/lib/validation";

describe("validation", () => {
  describe("validateSectionPayload", () => {
    it("validates title length", () => {
      const validTitle = "a".repeat(MAX_TITLE_LENGTH);
      expect(validateSectionPayload(validTitle, "content")).toBeNull();

      const invalidTitle = "a".repeat(MAX_TITLE_LENGTH + 1);
      expect(validateSectionPayload(invalidTitle, "content")).toContain("Title is too long");
    });

    it("validates content length", () => {
      const validContent = "a".repeat(MAX_CONTENT_LENGTH);
      expect(validateSectionPayload("title", validContent)).toBeNull();

      const invalidContent = "a".repeat(MAX_CONTENT_LENGTH + 1);
      expect(validateSectionPayload("title", invalidContent)).toContain("Content is too long");
    });

    it("requires title", () => {
      expect(validateSectionPayload(null, "content")).toBe("Title is required");
      expect(validateSectionPayload("", "content")).toBe("Title is required");
    });

    it("disallows script tags", () => {
      expect(validateSectionPayload("title", "<script>alert(1)</script>")).toContain("Content contains disallowed markup");
      expect(validateSectionPayload("title", "<iframe src='...'></iframe>")).toContain("Content contains disallowed markup");
      expect(validateSectionPayload("title", "javascript:void(0)")).toContain("Content contains disallowed markup");
    });
  });

  describe("validatePatchBody", () => {
    it("validates body size", () => {
      const validBody = "a".repeat(MAX_PATCH_BODY_BYTES);
      expect(validatePatchBody(validBody)).toBeNull();

      const invalidBody = "a".repeat(MAX_PATCH_BODY_BYTES + 1);
      expect(validatePatchBody(invalidBody)).toContain("Patch body exceeds size limit");
    });

    it("handles multi-byte characters correctly", () => {
      // '€' is 3 bytes.
      // If limit is 10 bytes:
      // "€€€" = 9 bytes (ok)
      // "€€€a" = 10 bytes (ok)
      // "€€€€" = 12 bytes (fail)
      
      // We test against MAX_PATCH_BODY_BYTES.
      // Let's test a small overflow with multi-byte.
      const multiByteChar = "€"; // 3 bytes
      const targetBytes = MAX_PATCH_BODY_BYTES;
      
      // Construct a string that is exactly limit bytes using 'a'
      const exact = "a".repeat(targetBytes);
      expect(validatePatchBody(exact)).toBeNull();

      // Construct a string that is exactly limit + 1 bytes?
      // "a" * (limit) + "a" -> limit + 1
      
      // Try with multi-byte:
      // "a" * (limit - 3) + "€" -> limit bytes.
      const mixed = "a".repeat(targetBytes - 3) + multiByteChar;
      expect(validatePatchBody(mixed)).toBeNull();

      // "a" * (limit - 2) + "€" -> limit - 2 + 3 = limit + 1 bytes.
      const overflow = "a".repeat(targetBytes - 2) + multiByteChar;
      expect(validatePatchBody(overflow)).toContain("Patch body exceeds size limit");
    });
  });

  describe("validateAuditIssue", () => {
    it("validates rule id length", () => {
      const validRuleId = "a".repeat(MAX_RULE_ID_LENGTH);
      expect(validateAuditIssue(validRuleId, "message")).toBeNull();

      const invalidRuleId = "a".repeat(MAX_RULE_ID_LENGTH + 1);
      expect(validateAuditIssue(invalidRuleId, "message")).toContain("Rule id is too long");
    });

    it("validates message length", () => {
      const validMessage = "a".repeat(MAX_AUDIT_MESSAGE_LENGTH);
      expect(validateAuditIssue("rule", validMessage)).toBeNull();

      const invalidMessage = "a".repeat(MAX_AUDIT_MESSAGE_LENGTH + 1);
      expect(validateAuditIssue("rule", invalidMessage)).toContain("Message is too long");
    });
  });
});

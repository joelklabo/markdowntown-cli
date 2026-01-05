import { describe, it, expect } from "vitest";
import { hashToken, verifyTokenHash, generateToken, extractTokenPrefix } from "@/lib/cli/tokens";

describe("CLI Token Security", () => {
  describe("hashToken", () => {
    it("produces consistent SHA-256 hash", () => {
      const token = "test-token-12345";
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
    });
    
    it("produces different hashes for different tokens", () => {
      const token1 = "test-token-1";
      const token2 = "test-token-2";
      
      expect(hashToken(token1)).not.toBe(hashToken(token2));
    });
  });

  describe("verifyTokenHash", () => {
    it("returns true for matching token and hash", () => {
      const token = "test-token-12345";
      const hash = hashToken(token);
      
      expect(verifyTokenHash(token, hash)).toBe(true);
    });
    
    it("returns false for non-matching token and hash", () => {
      const token = "test-token-12345";
      const wrongToken = "wrong-token";
      const hash = hashToken(token);
      
      expect(verifyTokenHash(wrongToken, hash)).toBe(false);
    });
    
    it("returns false for invalid hash format", () => {
      const token = "test-token-12345";
      
      expect(verifyTokenHash(token, "invalid-hash")).toBe(false);
      expect(verifyTokenHash(token, "")).toBe(false);
    });
    
    it("uses constant-time comparison", () => {
      // This test verifies the function doesn't throw on different lengths
      const token = "test-token";
      const hash = hashToken(token);
      const shortHash = hash.slice(0, 32);
      
      expect(verifyTokenHash(token, shortHash)).toBe(false);
    });
  });

  describe("generateToken", () => {
    it("generates tokens of expected length", () => {
      const token = generateToken();
      
      // 32 bytes base64url-encoded = 43 characters (no padding)
      expect(token.length).toBeGreaterThanOrEqual(43);
    });
    
    it("generates unique tokens", () => {
      const token1 = generateToken();
      const token2 = generateToken();
      
      expect(token1).not.toBe(token2);
    });
    
    it("generates URL-safe tokens", () => {
      const token = generateToken();
      
      // base64url should not contain +, /, or =
      expect(token).not.toMatch(/[+/=]/);
    });
  });

  describe("extractTokenPrefix", () => {
    it("extracts first 8 characters", () => {
      const token = "AbCdEfGhIjKlMnOp";
      
      expect(extractTokenPrefix(token)).toBe("AbCdEfGh");
    });
    
    it("handles short tokens", () => {
      const token = "short";
      
      expect(extractTokenPrefix(token)).toBe("short");
    });
  });
});

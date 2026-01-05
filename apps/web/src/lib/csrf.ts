import { createHmac } from "crypto";

const CSRF_SECRET = process.env.NEXTAUTH_SECRET ?? "dev-secret-do-not-use-in-production";

/**
 * Generate a CSRF token for a session.
 * Uses HMAC-SHA256 with the session user ID to create a deterministic token.
 */
export function generateCsrfToken(sessionUserId: string): string {
  const hmac = createHmac("sha256", CSRF_SECRET);
  hmac.update(`csrf:${sessionUserId}`);
  return hmac.digest("hex");
}

/**
 * Verify a CSRF token matches the expected value for the session.
 */
export function verifyCsrfToken(sessionUserId: string, token: string): boolean {
  const expected = generateCsrfToken(sessionUserId);
  
  // Constant-time comparison to prevent timing attacks
  if (token.length !== expected.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  
  return result === 0;
}

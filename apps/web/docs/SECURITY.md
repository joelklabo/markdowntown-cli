# Security Guide

## CLI Token Management

### Token Security

CLI tokens are long-lived bearer tokens used to authenticate CLI requests to the web API. They are:

- **Hashed before storage**: SHA-256 hash stored in database; plaintext token never persisted
- **Verified with constant-time compare**: Prevents timing attacks during authentication
- **Prefix-based display**: First 8 characters stored separately for user-facing identification (e.g., "AbCdEfGh...")
- **Scoped**: Each token has specific permissions (read, upload, run, patch)
- **Revocable**: Users can revoke tokens immediately via settings UI
- **Expirable**: 30-day default TTL; expired tokens are rejected

### Token Rotation

To rotate a CLI token:

1. **Create a new token** in Settings → Tokens
2. **Update your CLI configuration** with the new token
3. **Test the new token** with a read-only command (e.g., `markdowntown scan`)
4. **Revoke the old token** once the new token is verified

### Token Revocation

Tokens are revoked (not deleted) to maintain audit history:

- Revoked tokens immediately fail authentication
- `revokedAt` timestamp is set in the database
- Users can see revoked tokens in settings with their revocation date
- Revoked tokens cannot be un-revoked; create a new token instead

### Best Practices

**Do:**
- Use descriptive labels for tokens (e.g., "laptop-2026", "ci-runner")
- Rotate tokens periodically (every 30-90 days)
- Revoke tokens immediately if compromised or no longer needed
- Use minimum required scopes for each use case

**Don't:**
- Share tokens between users or machines
- Commit tokens to source control
- Log tokens in application logs
- Store tokens in unsecured locations

### Emergency Response

If a token is compromised:

1. **Revoke immediately** via Settings → Tokens
2. **Review audit logs** for suspicious activity (if available)
3. **Create a new token** with fresh scopes
4. **Update all affected systems** with the new token

### Technical Details

**Hashing:**
```typescript
// SHA-256 hash of token
const tokenHash = createHash("sha256").update(token).digest("hex");
```

**Verification:**
```typescript
// Constant-time comparison prevents timing attacks
timingSafeEqual(Buffer.from(tokenHash), Buffer.from(storedHash));
```

**Storage:**
```sql
-- Prisma schema
model CliToken {
  tokenHash   String @unique  // SHA-256 hash
  tokenPrefix String          // First 8 chars for display
  revokedAt   DateTime?       // Null if active
  expiresAt   DateTime?       // Optional expiration
}
```

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do not** open a public issue
2. Email security@markdowntown.com (or contact via private channel)
3. Include details: affected component, reproduction steps, potential impact
4. Allow reasonable time for response and remediation

We take security seriously and will respond promptly to verified reports.

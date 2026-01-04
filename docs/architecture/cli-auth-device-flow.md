# CLI auth: device flow and token model

## Summary
Define the CLI authentication flow using OAuth 2.0 device authorization plus app-issued CLI tokens. The device flow is used to prove the user identity in the web app, then the backend issues a scoped CLI token for subsequent snapshot uploads and run requests.

## Goals
- Provide a copy-paste friendly login for CLI users without browser embedding.
- Issue revocable, scoped CLI tokens separate from the OAuth provider access token.
- Store tokens securely with keyring-first behavior and a file fallback.

## Non-goals
- Browser-based OAuth redirect flows in the CLI.
- Long-lived refresh tokens for the CLI (optional future work).

## Device flow overview
1. **Start**: CLI requests a device code.
2. **Verify**: User visits the verification URL and confirms the code.
3. **Poll**: CLI polls until approved or expired.
4. **Issue**: Backend issues a CLI token with scopes and expiry.

### Sequence (high level)
- CLI -> `POST /api/cli/device/start` → returns `device_code`, `user_code`, `verification_uri`, `verification_uri_complete`, `interval`, `expires_in`.
- CLI prints the URL + code and opens the browser if allowed.
- User signs in on the web and confirms the device code.
- CLI polls `POST /api/cli/device/poll` with `device_code` at the provided interval.
- Backend returns one of: `authorization_pending`, `slow_down`, `access_denied`, `expired_token`, or `token` payload.
- On success, backend returns CLI token metadata and a scoped access token.

## Token model
### Token types
- **Device code**: short-lived, single-use proof that the CLI initiated a login.
- **CLI access token**: opaque, app-issued token used to authenticate API requests.

### Token format + lifetime
- **Format**: opaque reference token (server stores a SHA-256 hash, never the raw token).
- **TTL**: 30 days by default (configurable). No refresh token in v1; CLI re-runs device flow on expiry.

### Scopes (initial proposal)
- `cli:read` — list snapshots, runs, patches.
- `cli:upload` — create snapshots and upload blobs.
- `cli:run` — trigger audit/suggest runs.
- `cli:patch` — pull/apply patches.

### Revocation + expiry
- Tokens are stored server-side with `expiresAt` and `revokedAt` timestamps plus a SHA-256 hash of the raw token.
- CLI receives `401` or `403` with a clear error when a token is expired or revoked.
- A token revoke endpoint is provided in the web app for manual revocation.

## Storage expectations
- Primary: OS keyring (Keychain/Windows Credential Manager/libsecret).
- Fallback: local file with `0600` permissions under XDG config:
  - `${XDG_CONFIG_HOME:-$HOME/.config}/markdowntown/auth.json`.
- Token file includes: access token, scopes, expiry, and associated user/org identifiers.
- CLI warns when falling back to file storage and may support `--keyring-required` to disable fallback.

## API endpoints (proposed)
- `POST /api/cli/device/start`
  - Request: `{ clientId, cliVersion, deviceName, scopes }`
  - Response: `{ device_code, user_code, verification_uri, verification_uri_complete, interval, expires_in }`
- `POST /api/cli/device/poll`
  - Request: `{ device_code }`
  - Response (success): `{ access_token, scopes, expires_in, token_type }`
- `POST /api/cli/device/confirm`
  - Web-only endpoint that binds a user to the device code.
- `POST /api/cli/tokens/revoke`
  - Request: `{ tokenId }` or `{ tokenHash }`

## Rate limits
- Device start: per user/IP (e.g., 5/minute).
- Device poll: enforce the provided `interval`, return `slow_down` when exceeded and require exponential backoff.
- Confirmation attempts: throttled to prevent brute force of `user_code`.

## UX guidelines
- CLI prints the verification URL and a short code, e.g.:
  - "Open https://markdowntown.app/device and enter code ABCD-EFGH"
- CLI shows a status line while polling (pending / approved / expired).
- If the code expires, CLI prompts the user to restart login.
- Verification UI displays requested scopes, device name, and approximate IP/location before approval.

## Security considerations
- Device codes are short-lived (5-10 minutes) and single-use.
- User codes use a human-friendly base20 alphabet with at least 20 bits of entropy (e.g., 8 chars) and limited attempt counts.
- Tokens are stored hashed server-side; raw tokens only shown at issuance.
- Polling is rate-limited and returns `slow_down` for aggressive clients.
- Audit log entries for start, confirm, token issue, and revoke actions.

## Related docs
- `docs/architecture/sync-protocol.md`

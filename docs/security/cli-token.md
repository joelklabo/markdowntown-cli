# CLI Token Security

This document outlines the security considerations for the CLI token used in the `markdowntown` CLI.

## Token Revocation and Expiry

- **Revocation:** Users can revoke CLI tokens from the web UI. Revoked tokens are immediately invalidated and cannot be used for any API calls.
- **Expiry:** CLI tokens are long-lived but can be expired by the system. The current expiry policy is TBD.

## Security Tests

The security of the token revocation and expiry is tested in `apps/web/__tests__/api/cli-token-security.test.ts`. These tests ensure that:

- Revoked tokens cannot be used to access protected endpoints.
- Expired tokens are rejected by the API.

# Security Guardrails (Sketch Magic)

## Do Not Log
- API keys or auth headers
- Raw image bytes (base64 or binary)
- Full prompts or user-identifying details
- Uploaded filenames if they may contain PII

## Allowed Logging
- Error codes (e.g., `missing_api_key`, `provider_error`)
- Provider name + model id
- Timing metadata (duration, timeout)
- Payload size (bytes) without content

## Proof Video Hygiene
- Use stubbed responses or sample files.
- Ensure no secrets appear in the terminal or UI.
- Blur or crop if a secret appears accidentally.

## Safe Debug Checklist
- [ ] Telemetry disabled by default.
- [ ] Logs show codes, not content.
- [ ] Console screenshots contain no secrets.
- [ ] API key only in `.env.local` (never commit).

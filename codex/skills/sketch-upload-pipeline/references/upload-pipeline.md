# Upload Pipeline Notes (Sketch Magic)

## Accepted file types
- PNG (`image/png`)
- JPEG (`image/jpeg`)
- HEIC/HEIF (`image/heic`, `image/heif`)
- WebP (`image/webp`)

## Size limits
- Default max upload: **10 MB** (`DEFAULT_MAX_UPLOAD_BYTES`).
- Server config may also enforce limits (`MAX_UPLOAD_MB`, host request body limits).

## HEIC conversion
- Client attempts conversion with `heic2any` to `image/jpeg` (quality 0.92).
- Converted file is renamed to `<original>.jpg`.
- If conversion fails, the original HEIC is used, which may not preview on some browsers.

## Preview rendering
- Preview uses object URLs; ensure URLs are created/revoked safely.
- If preview fails, show fallback message and allow re-upload.

## Common failure modes
- File too large → user-facing “try a smaller image.”
- Unsupported type → user-facing “PNG, JPG, HEIC, or WebP.”
- HEIC preview blank → conversion failed or browser limitation.

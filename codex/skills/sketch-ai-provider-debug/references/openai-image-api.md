# OpenAI Image API Notes (for debugging)

## Supported models (Image API)
- **gpt-image-1**: OpenAI’s latest image model; supports **generations** and **edits**.
- **dall-e-2**: supports generations, edits, and **variations** (variations only on DALL·E 2).
- **dall-e-3**: generations only (no edits/variations).

## Endpoint coverage
- **Generations**: text → image
- **Edits**: image + prompt → image
- **Variations**: image → image (DALL·E 2 only)

## Input fidelity (gpt-image-1)
- `input_fidelity` can be `low` (default) or `high`.
- Use `high` to preserve more details from input images (faces, logos).

## Masks
- Mask-based edits require PNG with an alpha channel and the same dimensions as the input image.
- Masks are required for inpainting and must remain small enough to meet API size constraints.

## Common debug points
- Missing or invalid API key → 401/403 errors.
- Unsupported model or endpoint mismatch → 400/404 errors.
- Org verification may be required for gpt-image-1 access.

## Sources
- OpenAI Image API guide: https://platform.openai.com/docs/guides/images/image-generation
- OpenAI Image API reference: https://platform.openai.com/docs/api-reference/images
- GPT Image 1 model page: https://platform.openai.com/docs/models/gpt-image-1

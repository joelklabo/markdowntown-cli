# Gemini / Imagen Image API Notes (for debugging)

## Gemini API image models
- **gemini-3-pro-image-preview**: image generation + editing model with high-res output and multi-image references.
- **gemini-2.5-flash-image**: image generation model (image + text inputs, image + text outputs).

## Imagen 3 (Vertex AI)
- **imagen-3.0-generate-002** supports image **generation only**.
- Not supported: mask-based edits, inpainting, outpainting, or style transfer.
- Use Imagen 3 when you only need text → image generation.

## Debugging guidance
- If you see model-not-supported errors, confirm you are using the correct API for the model (Gemini Developer API vs Vertex AI).
- If the model only supports generation, do not send input images for editing.
- Check quota, allowlist requirements, and regional availability.

## Sources
- Gemini API image generation docs: https://ai.google.dev/gemini-api/docs/image-generation
- Gemini models list: https://ai.google.dev/models/gemini
- Imagen 3 (Vertex AI) model docs: https://cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/3-0-generate

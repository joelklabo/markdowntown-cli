---
applyTo: "**/*.{ts,tsx}"
---

# Example: scoped instructions (applyTo)

These instructions apply only to TypeScript files.

- Prefer `type` imports for types (`import type { ... }`).
- Avoid `any` unless you justify it.
- Keep components server-first; add `"use client"` only when needed.
- Add tests for new behavior when practical.

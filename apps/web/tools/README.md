# Tooling workspace

Run common project tooling from here (pnpm workspace).

Examples:
- `pnpm lint` – ESLint from repo root
- `pnpm type-check` – TypeScript no-emit
- `pnpm unit` – Vitest suite
- `pnpm coverage` – Coverage run
- `pnpm e2e` – Playwright tests against production
- `pnpm lighthouse` – Local Lighthouse baseline run
- `pnpm bundle` – Bundle size budget check
- `pnpm analyze` – Next.js bundle analyzer

All scripts delegate to the root project via `pnpm -C ..`, keeping tooling separated under `tools/`.

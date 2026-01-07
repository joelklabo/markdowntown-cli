# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/web/prisma apps/web/prisma
COPY packages/engine-js/package.json packages/engine-js/package.json
RUN pnpm install --frozen-lockfile --filter ./apps/web...

FROM deps AS builder
COPY apps/web ./apps/web
COPY packages/engine-js ./packages/engine-js
RUN pnpm --filter ./apps/web... exec prisma generate
RUN pnpm --filter ./apps/web... build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma

# Install prisma CLI for migrations (standalone doesn't include dev deps)
RUN npm install -g prisma@6.8.2

COPY scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x ./scripts/entrypoint.sh

EXPOSE 3000
CMD ["/bin/sh", "-c", "./scripts/entrypoint.sh"]

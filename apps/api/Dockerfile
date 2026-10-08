# Build from repo root: docker build -f apps/api/Dockerfile .
FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @spova/api... --prod=false

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @spova/shared build \
 && pnpm --filter @spova/api exec prisma generate \
 && pnpm --filter @spova/api build \
 && pnpm --filter @spova/api deploy --prod /out

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /out ./
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
EXPOSE 4000
# migrate on boot, then start
# migrate on boot, seed reference data when SEED_ON_BOOT=true (hosted previews), then start
CMD ["sh", "-c", "npx --yes prisma@6.19.3 migrate deploy && { [ \"$SEED_ON_BOOT\" = true ] && node dist/seed/cli.js || true; } && node dist/main.js"]

# Build from repo root: docker build -f apps/worker/Dockerfile .
FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker/package.json apps/worker/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @spova/worker... --prod=false

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api/prisma apps/api/prisma
COPY apps/worker apps/worker
RUN pnpm --filter @spova/shared build \
 && pnpm --filter @spova/worker prisma:generate \
 && pnpm --filter @spova/worker build \
 && pnpm --filter @spova/worker deploy --prod /out

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /out ./
COPY --from=build /repo/apps/worker/dist ./dist
RUN chown -R node:node /app
USER node
CMD ["node", "dist/main.js"]

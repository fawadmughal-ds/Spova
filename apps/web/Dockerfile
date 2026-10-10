# Build from repo root: docker build -f apps/web/Dockerfile .
FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @spova/web... --prod=false

FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_BRAND_NAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME
ENV NEXT_TELEMETRY_DISABLED=1
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @spova/shared build && pnpm --filter @spova/web build

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# syntax=docker/dockerfile:1
# Multi-stage build for @azimute/web (Next.js) in a pnpm monorepo (Turborepo).
# Requires `output: 'standalone'` in next.config.ts.

# ── Stage 1: prune ──────────────────────────────────────────────────────────
FROM node:22-alpine AS pruner
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g turbo@latest
WORKDIR /app
COPY . .
RUN turbo prune @azimute/web --docker

# ── Stage 2: install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS installer
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ── Stage 3: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Build-time env vars injected via docker-compose args
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=installer /app/node_modules              ./node_modules
COPY --from=installer /app/apps/web/node_modules     ./apps/web/node_modules
COPY --from=pruner    /app/out/full/                 .

RUN pnpm --filter @azimute/shared build
RUN pnpm --filter @azimute/web build

# ── Stage 4: production runner ───────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone output bundles everything needed into .next/standalone.
# The static assets are copied separately.
COPY --from=builder /app/apps/web/public                               ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone  ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static   ./apps/web/.next/static

USER nextjs
EXPOSE 3000

# standalone output generates a minimal server.js at the app root inside the standalone dir
CMD ["node", "--max-old-space-size=512", "apps/web/server.js"]

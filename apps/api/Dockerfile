# syntax=docker/dockerfile:1
# Multi-stage build for @azimute/api in a pnpm monorepo (Turborepo).
# Stage 1 uses `turbo prune` to isolate only the files needed for this app.

# ── Stage 1: prune ──────────────────────────────────────────────────────────
FROM node:22-alpine AS pruner
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g turbo@latest
WORKDIR /app
COPY . .
RUN turbo prune @azimute/api --docker

# ── Stage 2: install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS installer
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy lockfile and pruned package.json manifests first (layer cache)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ── Stage 3: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=pruner /app/out/full/ .

# Generate Prisma client (must run before tsc)
RUN pnpm --filter @azimute/api exec prisma generate

# Build shared package first, then the API
RUN pnpm --filter @azimute/shared build
RUN pnpm --filter @azimute/api build

# ── Stage 4: production runner ───────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 apiuser

# Copy only production artifacts
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/dist           ./apps/api/dist
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/package.json   ./apps/api/package.json
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/prisma         ./apps/api/prisma
COPY --from=builder --chown=apiuser:nodejs /app/packages/shared/dist    ./packages/shared/dist
COPY --from=builder --chown=apiuser:nodejs /app/packages/shared/package.json ./packages/shared/package.json

# Copy node_modules for production (includes @prisma/client + prisma CLI for migrations)
COPY --from=installer --chown=apiuser:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=apiuser:nodejs /app/apps/api/node_modules ./apps/api/node_modules

# Copy workspace manifests (needed for pnpm to resolve packages at runtime)
COPY --from=pruner --chown=apiuser:nodejs /app/out/json/package.json         ./package.json
COPY --from=pruner --chown=apiuser:nodejs /app/out/json/pnpm-workspace.yaml  ./pnpm-workspace.yaml

# Uploads volume mount point
RUN mkdir -p /app/uploads && chown apiuser:nodejs /app/uploads

USER apiuser
EXPOSE 4000

# Run database migrations then start the server
CMD ["sh", "-c", "node node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node --max-old-space-size=512 apps/api/dist/server.js"]

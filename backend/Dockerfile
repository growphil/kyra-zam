# ==============================================================================
# Multi-Stage Production Dockerfile for KYRA ZAM 2.0 Backend (Node/Fastify/Prisma)
# ==============================================================================

# ---- Stage 1: Build & Compile TypeScript ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine compatibility
RUN apk add --no-cache openssl libc6-compat

# Copy package manifests
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src ./src/

# Compile TypeScript to dist/
RUN npm run build

# Prune devDependencies to keep production image lean
RUN npm prune --production

# ---- Stage 2: Minimal Production Runner ----
FROM node:20-alpine AS runner

WORKDIR /app

# OpenSSL & dumb-init for proper signal handling in AWS ECS
RUN apk add --no-cache openssl libc6-compat dumb-init curl

ENV NODE_ENV=production
ENV PORT=8000

# Copy node_modules with generated Prisma client
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY public ./public

# Health check using curl
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Run container with dumb-init to handle SIGINT/SIGTERM gracefully
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]

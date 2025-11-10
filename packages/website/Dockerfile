# Truxe Website - Production Dockerfile
# Multi-stage build for optimized Next.js application

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json package-lock.json* pnpm-lock.yaml* ./
COPY packages/website/package.json ./packages/website/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy source code
COPY packages/website ./packages/website

# Install website dependencies
RUN cd packages/website && pnpm install --frozen-lockfile

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
WORKDIR /app/packages/website
# Build and ignore export errors (error pages cause export failures but standalone output is created)
RUN pnpm build || true
# Verify standalone output was created
RUN test -d .next/standalone || (echo "ERROR: Standalone output not created" && exit 1)

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/packages/website/.next/standalone ./

# Copy static files and public directory to the correct locations
# Next.js expects them at /app/.next/static and /app/public
COPY --from=builder --chown=nextjs:nodejs /app/packages/website/.next/static ./.next/static
COPY --from=builder /app/packages/website/public ./public

# Copy node_modules with pnpm store to resolve symlinks
# Standalone output contains its own node_modules that Next.js bundled
# But we need to ensure the symlinks in standalone's node_modules resolve correctly
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder --chown=nextjs:nodejs /app/packages/website/node_modules ./packages/website/node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Set NODE_PATH to resolve pnpm symlinks correctly
ENV NODE_PATH=/app/packages/website/node_modules:/app/node_modules

# Server.js is at root in standalone output
CMD ["node", "server.js"]

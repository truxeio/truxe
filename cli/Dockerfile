# Truxe CLI - Lightweight container for CLI operations
# Multi-stage build for optimal size and security

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ca-certificates && \
    apk upgrade

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev for build)
RUN npm ci --no-audit --no-fund

# Copy source code
COPY src/ ./src/

# Build the CLI
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 -S truxe && \
    adduser -S truxe -u 1001 -G truxe

# Install runtime dependencies and security updates
RUN apk add --no-cache \
    dumb-init \
    git \
    curl \
    ca-certificates \
    openssh-client && \
    apk upgrade && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Copy built application and production dependencies
COPY --from=builder --chown=truxe:truxe /app/dist ./dist
COPY --from=builder --chown=truxe:truxe /app/node_modules ./node_modules
COPY --chown=truxe:truxe package.json ./

# Make CLI globally available
RUN npm link

# Set environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=256"

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=5s --retries=2 \
    CMD truxe --version || exit 1

# Switch to non-root user
USER truxe

# Set working directory for CLI operations
WORKDIR /workspace

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["truxe", "--help"]

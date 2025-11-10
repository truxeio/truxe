# Truxe API - Production Docker Image
# Multi-stage build for optimal security and size

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install security updates and required packages
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates && \
    apk upgrade

# Copy package files
COPY package*.json ./
RUN npm ci --no-audit --no-fund && \
    npm cache clean --force

# Stage 2: Build (if needed for future TypeScript compilation)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY . .
# Currently no build step needed, but prepared for future TS migration

# Stage 3: Production
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S truxe && \
    adduser -S truxe -u 1001 -G truxe

# Install security updates and runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates && \
    apk upgrade && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps --chown=truxe:truxe /app/node_modules ./node_modules

# Copy application code
COPY --chown=truxe:truxe . .

# Remove development files
RUN rm -rf tests/ scripts/generate-keys.js .env.example

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R truxe:truxe logs

# Set security headers and limits
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3001}/health || exit 1

# Switch to non-root user
USER truxe

# Expose port
EXPOSE 3001

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]

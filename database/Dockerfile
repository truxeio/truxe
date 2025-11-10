# Truxe Database - PostgreSQL with Extensions
# Production-ready PostgreSQL with required extensions and security hardening

FROM postgres:16-alpine

# Install required extensions and security updates
RUN apk add --no-cache \
    curl \
    ca-certificates && \
    apk upgrade && \
    rm -rf /var/cache/apk/*

# Create application user for migrations
RUN addgroup -g 1001 -S truxe && \
    adduser -S truxe -u 1001 -G truxe

# Copy migration files
COPY --chown=truxe:truxe migrations/ /docker-entrypoint-initdb.d/
COPY --chown=truxe:truxe connection.js /usr/local/bin/
COPY --chown=truxe:truxe migrate.js /usr/local/bin/
COPY --chown=truxe:truxe package.json /usr/local/bin/

# Install Node.js for migration scripts
RUN apk add --no-cache nodejs npm && \
    cd /usr/local/bin && \
    npm install --only=production --no-audit --no-fund && \
    npm cache clean --force

# Set up proper permissions
RUN chmod +x /usr/local/bin/migrate.js

# Health check for database readiness
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=5 \
    CMD pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-truxe} || exit 1

# Security: Use non-root user where possible
# Note: PostgreSQL container needs to run as postgres user for database operations

# Environment defaults
ENV POSTGRES_DB=truxe
ENV POSTGRES_USER=truxe
ENV POSTGRES_PASSWORD=change_me_in_production

# Expose PostgreSQL port
EXPOSE 5432

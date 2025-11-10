# OAuth Provider Deployment Guide

**Complete production deployment guide for Truxe OAuth Provider**

> 🚀 **Production-Ready** | 🔐 **Security Hardened** | 📊 **Monitoring Included**

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Security Hardening](#security-hardening)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [OAuth Client Registration](#oauth-client-registration)
7. [Rate Limiting](#rate-limiting)
8. [Monitoring & Logging](#monitoring--logging)
9. [Performance Optimization](#performance-optimization)
10. [Backup & Recovery](#backup--recovery)
11. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Infrastructure Requirements

- [ ] **Database:** PostgreSQL 14+ with connection pooling
- [ ] **Cache:** Redis 6+ for session management and rate limiting
- [ ] **Web Server:** Nginx or similar reverse proxy
- [ ] **SSL/TLS:** Valid SSL certificate (Let's Encrypt or commercial)
- [ ] **Domain:** Registered domain with DNS configured
- [ ] **Email:** SMTP service for magic links (Brevo, SendGrid, etc.)

### Security Requirements

- [ ] **Secrets:** Strong random values for all secrets (32+ characters)
- [ ] **JWT Keys:** RSA 2048-bit keypair generated
- [ ] **HTTPS:** TLS 1.2+ enabled, HTTP redirects to HTTPS
- [ ] **CORS:** Configured for allowed origins only
- [ ] **Rate Limiting:** Enabled on all OAuth endpoints
- [ ] **Firewall:** Database and Redis not publicly accessible

### Compliance Requirements

- [ ] **Privacy Policy:** Published and accessible
- [ ] **Terms of Service:** Published and accessible
- [ ] **GDPR/CCPA:** Data handling procedures in place
- [ ] **Logging:** Audit logs for all authentication events
- [ ] **Backups:** Automated database backups configured

---

## Environment Configuration

### Required Environment Variables

Create a `.env.production` file with these variables:

```bash
# ============================================================================
# Application Configuration
# ============================================================================
NODE_ENV=production
PORT=3001
API_URL=https://auth.yourdomain.com

# ============================================================================
# Database Configuration
# ============================================================================
DATABASE_URL=postgresql://username:password@db-host:5432/truxe_prod
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=true

# ============================================================================
# Redis Configuration
# ============================================================================
REDIS_URL=redis://:password@redis-host:6379
REDIS_TLS=true

# ============================================================================
# JWT Configuration (OAuth Tokens)
# ============================================================================
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_ALGORITHM=RS256
JWT_ISSUER=https://auth.yourdomain.com
JWT_AUDIENCE=https://api.yourdomain.com

# Access Token Settings
ACCESS_TOKEN_EXPIRY=15m
ACCESS_TOKEN_MAX_AGE=900

# Refresh Token Settings
REFRESH_TOKEN_EXPIRY=7d
REFRESH_TOKEN_MAX_AGE=604800

# ============================================================================
# Session Configuration
# ============================================================================
SESSION_SECRET=<generate-strong-32+-char-secret>
SESSION_MAX_AGE=86400000
SESSION_SECURE=true
SESSION_SAME_SITE=lax

# ============================================================================
# OAuth Provider Configuration
# ============================================================================
OAUTH_AUTHORIZATION_CODE_EXPIRY=600
OAUTH_REQUIRE_PKCE=true
OAUTH_ALLOW_REFRESH_TOKEN=true

# ============================================================================
# Email Configuration (for magic links)
# ============================================================================
SMTP_HOST=smtp.brevo.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="Your App Name"

# ============================================================================
# Security Configuration
# ============================================================================
BCRYPT_ROUNDS=12
ALLOWED_ORIGINS=https://app.yourdomain.com,https://yourdomain.com
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# ============================================================================
# Monitoring & Logging
# ============================================================================
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn
DATADOG_API_KEY=your-datadog-key

# ============================================================================
# Optional: Multi-Factor Authentication
# ============================================================================
MFA_ENABLED=true
MFA_ISSUER="Your App Name"
```

### Generating JWT Keys

Generate RSA keypair for JWT signing:

```bash
# Generate private key
openssl genrsa -out private_key.pem 2048

# Extract public key
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Convert to single-line format for .env
cat private_key.pem | tr '\n' '\\n'
cat public_key.pem | tr '\n' '\\n'
```

### Generating Secure Secrets

Generate strong random secrets:

```bash
# Session secret (32+ characters)
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Database Setup

### Production Database Configuration

**Recommended Settings for PostgreSQL:**

```sql
-- Connection pooling settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB
```

### Run Migrations

```bash
# Set production database URL
export DATABASE_URL="postgresql://..."

# Run migrations
npm run migrate:prod

# Verify migrations
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;"
```

### Database Backup

**Automated Daily Backups:**

```bash
#!/bin/bash
# /usr/local/bin/backup-truxe-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/truxe"
DB_NAME="truxe_prod"

# Create backup
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/truxe_$DATE.sql.gz"

# Rotate old backups (keep 30 days)
find $BACKUP_DIR -name "truxe_*.sql.gz" -mtime +30 -delete

echo "Backup completed: truxe_$DATE.sql.gz"
```

**Cron job:**

```cron
0 2 * * * /usr/local/bin/backup-truxe-db.sh
```

---

## Security Hardening

### 1. HTTPS Only

**Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name auth.yourdomain.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name auth.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/auth.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/auth.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Rate Limiting

**Application-Level Rate Limiting:**

Already implemented in Truxe. Configure via environment variables:

```bash
# 100 requests per 15 minutes per IP
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# OAuth-specific limits
OAUTH_RATE_LIMIT_WINDOW=900000
OAUTH_RATE_LIMIT_MAX=50
```

**Nginx Rate Limiting (Additional Layer):**

```nginx
http {
    # Define rate limit zones
    limit_req_zone $binary_remote_addr zone=oauth_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s;

    server {
        # OAuth endpoints - strict limiting
        location /oauth-provider/ {
            limit_req zone=oauth_limit burst=20 nodelay;
            proxy_pass http://localhost:3001;
        }

        # API endpoints - moderate limiting
        location /api/ {
            limit_req zone=api_limit burst=100 nodelay;
            proxy_pass http://localhost:3001;
        }
    }
}
```

### 3. CORS Configuration

**Configure Allowed Origins:**

```javascript
// In your Fastify app (api/src/server.js)
fastify.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://app.yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### 4. Database Security

**Connection Security:**

```bash
# Use SSL for database connections
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true

# Use connection pooling
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

**Database User Permissions:**

```sql
-- Create dedicated app user with limited permissions
CREATE USER truxe_app WITH PASSWORD 'secure_password';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE truxe_prod TO truxe_app;
GRANT USAGE ON SCHEMA public TO truxe_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO truxe_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO truxe_app;

-- Revoke dangerous permissions
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
```

### 5. Secret Management

**Use Secrets Manager:**

Recommended services:
- **AWS Secrets Manager**
- **HashiCorp Vault**
- **Azure Key Vault**
- **Google Cloud Secret Manager**

**Example with AWS Secrets Manager:**

```javascript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function loadSecrets() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: 'truxe/production' })
  );

  const secrets = JSON.parse(response.SecretString);

  process.env.DATABASE_URL = secrets.DATABASE_URL;
  process.env.JWT_PRIVATE_KEY = secrets.JWT_PRIVATE_KEY;
  process.env.SESSION_SECRET = secrets.SESSION_SECRET;
}
```

---

## SSL/TLS Configuration

### Let's Encrypt (Free SSL)

**Install Certbot:**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d auth.yourdomain.com

# Auto-renewal (certbot handles this automatically)
# Test renewal
sudo certbot renew --dry-run
```

### Commercial SSL Certificate

1. Generate CSR (Certificate Signing Request):

```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout yourdomain.key \
  -out yourdomain.csr
```

2. Submit CSR to Certificate Authority (CA)

3. Install certificate in Nginx (see Nginx config above)

---

## OAuth Client Registration

### Production Client Registration

**Via API:**

```bash
curl -X POST https://auth.yourdomain.com/oauth-provider/clients \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Production App",
    "redirect_uris": [
      "https://app.yourdomain.com/auth/callback",
      "https://yourdomain.com/auth/callback"
    ],
    "allowed_scopes": ["openid", "email", "profile"],
    "require_pkce": true,
    "require_consent": false,
    "trusted": true,
    "client_uri": "https://yourdomain.com",
    "logo_uri": "https://yourdomain.com/logo.png",
    "tos_uri": "https://yourdomain.com/terms",
    "policy_uri": "https://yourdomain.com/privacy"
  }'
```

**Response:**

```json
{
  "client_id": "cl_abc123xyz",
  "client_secret": "cs_secret_key_do_not_share",
  "client_name": "Production App",
  "redirect_uris": ["https://app.yourdomain.com/auth/callback"],
  "allowed_scopes": ["openid", "email", "profile"],
  "require_pkce": true,
  "trusted": true
}
```

**⚠️ Security Notes:**

- Store `client_secret` securely (secrets manager, environment variable)
- Never commit `client_secret` to version control
- Use different clients for dev/staging/production
- Rotate secrets regularly (every 90 days)

---

## Rate Limiting

### OAuth Endpoint Limits

**Recommended Limits:**

| Endpoint | Rate Limit | Burst | Reasoning |
|----------|------------|-------|-----------|
| `/oauth-provider/authorize` | 10 req/min | 20 | Prevent auth spam |
| `/oauth-provider/token` | 20 req/min | 40 | Allow token refresh |
| `/oauth-provider/userinfo` | 60 req/min | 100 | Frequent user data access |
| `/oauth-provider/introspect` | 100 req/min | 200 | High-frequency validation |
| `/oauth-provider/revoke` | 10 req/min | 20 | Infrequent operation |

### Monitoring Rate Limits

**Track rate limit hits:**

```javascript
// Log rate limit violations
fastify.addHook('onResponse', async (request, reply) => {
  if (reply.statusCode === 429) {
    fastify.log.warn({
      ip: request.ip,
      path: request.url,
      rateLimitExceeded: true,
    }, 'Rate limit exceeded');
  }
});
```

---

## Monitoring & Logging

### Application Logging

**Log Levels:**

```bash
# Production: info and above
LOG_LEVEL=info

# Staging: debug and above
LOG_LEVEL=debug

# Development: all logs
LOG_LEVEL=trace
```

**Important Events to Log:**

- ✅ OAuth authorization requests
- ✅ Token issuance
- ✅ Token refresh
- ✅ Token revocation
- ✅ Failed authentication attempts
- ✅ Rate limit violations
- ✅ Database connection errors
- ✅ Redis connection errors

### Health Checks

**Liveness Probe:**

```bash
curl -f https://auth.yourdomain.com/health || exit 1
```

**Readiness Probe:**

```bash
curl -f https://auth.yourdomain.com/health/ready || exit 1
```

**Kubernetes Health Checks:**

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 5
```

### Monitoring Tools

**Recommended Stack:**

1. **Application Performance Monitoring (APM):**
   - Sentry (error tracking)
   - Datadog (metrics, traces)
   - New Relic (APM)

2. **Logging:**
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - Papertrail
   - CloudWatch Logs (AWS)

3. **Uptime Monitoring:**
   - UptimeRobot
   - Pingdom
   - StatusCake

### Key Metrics to Monitor

- **Request Rate:** OAuth authorizations/min, token requests/min
- **Response Time:** P50, P95, P99 latencies
- **Error Rate:** 4xx and 5xx responses
- **Database:** Connection pool usage, query times
- **Redis:** Memory usage, connection count
- **Resource Usage:** CPU, memory, disk I/O

---

## Performance Optimization

### Database Optimization

**Connection Pooling:**

```bash
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_IDLE_TIMEOUT=10000
DATABASE_CONNECTION_TIMEOUT=5000
```

**Indexes:**

```sql
-- OAuth clients
CREATE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);
CREATE INDEX idx_oauth_clients_status ON oauth_clients(status);

-- OAuth authorization codes
CREATE INDEX idx_oauth_codes_code ON oauth_authorization_codes(code);
CREATE INDEX idx_oauth_codes_expires_at ON oauth_authorization_codes(expires_at);

-- OAuth tokens
CREATE INDEX idx_oauth_tokens_jti ON oauth_tokens(jti);
CREATE INDEX idx_oauth_tokens_user_id ON oauth_tokens(user_id);
```

### Redis Caching

**Cache OAuth Client Data:**

```javascript
// Cache client lookups (TTL: 15 minutes)
const clientKey = `oauth:client:${clientId}`;
await redis.setex(clientKey, 900, JSON.stringify(client));
```

**Cache Rate Limits:**

```javascript
// Store rate limit counters in Redis
const rateLimitKey = `ratelimit:${ip}:${endpoint}`;
await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, 900); // 15 minutes
```

### CDN Configuration

**Static Assets:**

Use CDN for:
- OAuth consent screen assets
- Client logos
- Error page assets

**CloudFront Example:**

```javascript
// In OAuth consent screen
<img src="https://cdn.yourdomain.com/logos/${client.logo_uri}" />
```

---

## Backup & Recovery

### Database Backups

**Automated Backups:**

```bash
# Daily full backup
0 2 * * * /usr/local/bin/backup-truxe-db.sh

# Hourly incremental backup (if using WAL archiving)
0 * * * * /usr/local/bin/backup-truxe-wal.sh
```

### Restore Procedure

**Full Restore:**

```bash
# Stop application
systemctl stop truxe-api

# Restore database
gunzip < /var/backups/truxe/truxe_20251106.sql.gz | psql $DATABASE_URL

# Start application
systemctl start truxe-api
```

### Disaster Recovery Plan

1. **RTO (Recovery Time Objective):** 1 hour
2. **RPO (Recovery Point Objective):** 1 hour
3. **Backup Retention:** 30 days daily, 12 months monthly

---

## Troubleshooting

### Common Issues

#### 1. "Redirect URI Mismatch"

**Symptom:** OAuth error: `redirect_uri_mismatch`

**Solution:**
```bash
# Verify registered redirect URIs
psql $DATABASE_URL -c "SELECT redirect_uris FROM oauth_clients WHERE client_id = 'your_client_id';"

# Update if needed
curl -X PATCH https://auth.yourdomain.com/oauth-provider/clients/your_client_id \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"redirect_uris": ["https://app.yourdomain.com/callback"]}'
```

#### 2. "Invalid Grant"

**Symptom:** Token exchange fails with `invalid_grant`

**Causes:**
- Authorization code expired (10-minute limit)
- Code already used
- Code verifier mismatch (PKCE)

**Solution:**
```sql
-- Check code status
SELECT * FROM oauth_authorization_codes
WHERE code = 'your_auth_code'
ORDER BY created_at DESC
LIMIT 1;
```

#### 3. High Database Connection Usage

**Symptom:** "Too many connections" error

**Solution:**
```bash
# Increase connection pool
DATABASE_POOL_MAX=20

# Check current connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'truxe_prod';"

# Kill idle connections
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';"
```

#### 4. Redis Connection Failures

**Symptom:** Session errors, rate limiting not working

**Solution:**
```bash
# Check Redis connectivity
redis-cli -h redis-host -p 6379 -a password ping

# Check Redis memory
redis-cli -h redis-host -p 6379 -a password info memory

# Increase maxmemory if needed
redis-cli -h redis-host -p 6379 -a password CONFIG SET maxmemory 2gb
```

---

## Production Checklist

### Pre-Launch

- [ ] Environment variables configured and validated
- [ ] Database migrations applied
- [ ] Redis connection tested
- [ ] SSL certificate installed and tested
- [ ] Rate limiting enabled and tested
- [ ] CORS configured for production origins
- [ ] OAuth clients registered
- [ ] Monitoring and alerts configured
- [ ] Backup system tested
- [ ] Load testing completed
- [ ] Security audit performed

### Post-Launch

- [ ] Monitor error logs for first 24 hours
- [ ] Verify OAuth flows working in production
- [ ] Check database and Redis performance
- [ ] Validate SSL certificate auto-renewal
- [ ] Confirm backups running successfully
- [ ] Review rate limit effectiveness
- [ ] Document any production-specific configurations

---

## Additional Resources

- **[OAuth Provider Guide](./OAUTH_PROVIDER_GUIDE.md)** - Complete OAuth documentation
- **[API Reference](../04-api-reference/oauth-endpoints.md)** - All OAuth endpoints
- **[Examples](./examples/)** - Integration examples for 8 frameworks
- **[Performance Testing](../../tests/performance/)** - Load testing guide
- **[Security Audit Report](./WEEK_3_DAY_1_COMPLETION_REPORT.md)** - Security best practices

---

**Last Updated:** November 6, 2025
**Version:** 1.0.0
**Status:** Production-Ready ✅

---

**Need Help?** Open an issue on GitHub or contact support@yourdomain.com
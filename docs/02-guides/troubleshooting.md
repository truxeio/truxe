# Troubleshooting Guide

Comprehensive troubleshooting guide for common Truxe authentication issues with step-by-step solutions and diagnostic tools.

## 🚨 Quick Diagnostic Commands

Before diving into specific issues, run these diagnostic commands to get an overview of your system status:

```bash
# Check overall system health
truxe status --check-all

# Check specific services
truxe status --check-db --check-email --check-jwt --check-redis

# View recent logs
truxe logs --tail=50 --level=error

# Test API connectivity
curl -f http://localhost:3001/health || echo "API not responding"
```

---

## 🔐 Authentication Issues

### Magic Links Not Working

#### Symptoms
- Users report not receiving magic link emails
- Magic link emails arrive but links don't work
- "Invalid or expired token" errors

#### Diagnostic Steps
```bash
# 1. Check email service health
truxe status --check-email

# 2. View email service logs
truxe logs --service=email --tail=20

# 3. Test email delivery manually
truxe test email --to=your-email@example.com

# 4. Check magic link generation
truxe test magic-link --email=test@example.com --debug
```

#### Common Causes & Solutions

**❌ Email Service Not Configured**
```bash
# Check email configuration
truxe config get email

# Common missing variables
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@yourapp.com
```

**❌ Invalid Email Provider Credentials**
```bash
# Test email provider connection
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"test@yourapp.com","to":"test@example.com","subject":"Test","text":"Test"}'

# Expected response: 200 OK with email ID
```

**❌ Rate Limiting Blocking Requests**
```bash
# Check rate limit status
curl -s http://localhost:3001/admin/rate-limits/check \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"endpoint":"POST:/auth/magic-link","identifiers":{"ip":"1.2.3.4"}}'

# Reset rate limits if needed
curl -X DELETE http://localhost:3001/admin/rate-limits/ip/1.2.3.4 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**❌ Database Connection Issues**
```bash
# Test database connection
truxe status --check-db

# Check database logs
docker logs your-postgres-container --tail=20

# Test manual connection
psql $DATABASE_URL -c "SELECT version();"
```

**❌ Token Expiration Issues**
```bash
# Check token expiration settings
truxe config get auth.magicLink.expiryMinutes

# Should be reasonable (15 minutes recommended)
truxe config set auth.magicLink.expiryMinutes 15
```

#### Advanced Debugging

**Email Content Issues**
```bash
# Check email template rendering
truxe debug email-template --email=test@example.com --token=test-token

# Verify email headers
truxe logs --service=email --format=json | jq '.headers'
```

**Token Generation Issues**
```bash
# Debug token generation
truxe debug token-generation --email=test@example.com --verbose

# Check token hashing
truxe debug token-hash --token=your-test-token
```

---

### JWT Token Issues

#### Symptoms
- "Invalid token" errors in API responses
- Tokens expire immediately
- JWKS endpoint not accessible
- Token verification failures

#### Diagnostic Steps
```bash
# 1. Check JWT service health
truxe status --check-jwt

# 2. Verify JWKS endpoint
curl -s http://localhost:3001/.well-known/jwks.json | jq .

# 3. Test token generation
truxe test jwt --user=test@example.com --debug

# 4. Verify token signature
truxe debug jwt-verify --token="your.jwt.token"
```

#### Common Causes & Solutions

**❌ Missing or Invalid JWT Keys**
```bash
# Check if keys are configured
truxe config get jwt.privateKey jwt.publicKey

# Generate new keys if missing
truxe generate-keys --algorithm=RS256

# Verify key format
echo "$JWT_PRIVATE_KEY" | openssl rsa -check -noout
echo "$JWT_PUBLIC_KEY" | openssl rsa -pubin -text -noout
```

**❌ Algorithm Mismatch**
```bash
# Check algorithm configuration
truxe config get jwt.algorithm

# Ensure consistency
JWT_ALGORITHM=RS256  # Must match key type
```

**❌ Clock Skew Issues**
```bash
# Check system time
date
timedatectl status

# Sync time if needed
sudo ntpdate -s time.nist.gov

# Add clock skew tolerance
truxe config set jwt.clockTolerance 30  # 30 seconds
```

**❌ Issuer/Audience Mismatch**
```bash
# Check JWT claims
truxe debug jwt-decode --token="your.jwt.token"

# Verify issuer matches configuration
truxe config get jwt.issuer

# Should match your domain
JWT_ISSUER=https://auth.yourapp.com
```

#### Token Debugging Tools

**Decode JWT Token**
```bash
# Decode without verification (for debugging)
truxe debug jwt-decode --token="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."

# Verify token signature
truxe debug jwt-verify --token="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."

# Check token expiration
truxe debug jwt-check-exp --token="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."
```

---

## 🗄️ Database Issues

### Connection Problems

#### Symptoms
- "Database connection failed" errors
- Slow query performance
- Connection pool exhaustion

#### Diagnostic Steps
```bash
# 1. Test database connectivity
truxe status --check-db --verbose

# 2. Check connection pool status
curl -s http://localhost:3001/health | jq '.services.database'

# 3. Test manual connection
psql $DATABASE_URL -c "SELECT current_database(), current_user;"

# 4. Check database logs
docker logs postgres-container --tail=50
```

#### Common Solutions

**❌ Invalid Connection String**
```bash
# Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:pass@host:port/dbname

# Test connection components
pg_isready -h hostname -p port -U username
```

**❌ SSL Configuration Issues**
```bash
# For production, ensure SSL is enabled
DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"

# For development, disable SSL if needed
DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=disable"
```

**❌ Connection Pool Issues**
```bash
# Check pool configuration
truxe config get database.pool

# Adjust pool settings
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_POOL_IDLE_TIMEOUT=10000
```

### Migration Issues

#### Symptoms
- "Migration failed" errors
- Schema version mismatches
- Missing tables or columns

#### Diagnostic Steps
```bash
# 1. Check migration status
truxe migrate status

# 2. View migration history
truxe migrate history

# 3. Check database schema
psql $DATABASE_URL -c "\dt"  # List tables
psql $DATABASE_URL -c "\d users"  # Describe users table
```

#### Solutions

**❌ Incomplete Migrations**
```bash
# Run pending migrations
truxe migrate up

# Force specific migration
truxe migrate up --to=002_add_sessions_table

# Rollback if needed
truxe migrate down --steps=1
```

**❌ Migration Lock Issues**
```bash
# Check for migration locks
psql $DATABASE_URL -c "SELECT * FROM schema_migrations WHERE locked = true;"

# Release stuck locks
psql $DATABASE_URL -c "UPDATE schema_migrations SET locked = false WHERE locked = true;"
```

---

## 🚦 Rate Limiting Issues

### Rate Limits Too Restrictive

#### Symptoms
- Users getting "Too Many Requests" errors
- Legitimate traffic being blocked
- High rate limit violation rates

#### Diagnostic Steps
```bash
# 1. Check rate limit statistics
curl -s http://localhost:3001/admin/rate-limits/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.overview'

# 2. Check specific IP/user limits
curl -X POST http://localhost:3001/admin/rate-limits/check \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"endpoint":"POST:/auth/magic-link","identifiers":{"ip":"1.2.3.4"}}'

# 3. View recent violations
truxe logs --grep="rate.limit" --tail=20
```

#### Solutions

**❌ Limits Too Low for Legitimate Use**
```bash
# Increase magic link limits
truxe config set rateLimits.magicLink.perIP.max 10
truxe config set rateLimits.magicLink.perEmail.max 5

# Adjust API limits by plan
truxe config set rateLimits.api.free.requestsPerHour 2000
```

**❌ IP Detection Issues**
```bash
# Check if behind proxy
curl -s http://localhost:3001/health | jq '.request.ip'

# Configure proxy trust
TRUSTED_PROXIES=1
PROXY_HEADER=X-Forwarded-For
```

### Rate Limiting Not Working

#### Symptoms
- No rate limiting being applied
- Abuse not being prevented
- High server load from excessive requests

#### Diagnostic Steps
```bash
# 1. Check rate limiting service
truxe status --check-redis

# 2. Verify rate limiting is enabled
truxe config get rateLimits.enabled

# 3. Test rate limiting manually
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3001/auth/magic-link \
    -d '{"email":"test@example.com"}'
done
```

#### Solutions

**❌ Redis Connection Issues**
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check Redis logs
docker logs redis-container --tail=20

# Verify Redis configuration
truxe config get redis
```

**❌ Rate Limiting Disabled**
```bash
# Enable rate limiting
truxe config set rateLimits.enabled true

# Restart service
truxe restart
```

---

## 📧 Email Service Issues

### Email Delivery Problems

#### Symptoms
- Magic link emails not delivered
- Emails going to spam folder
- Email service errors in logs

#### Diagnostic Steps
```bash
# 1. Test email service
truxe test email --to=your-email@example.com

# 2. Check email provider status
curl -s https://api.resend.com/domains/your-domain.com \
  -H "Authorization: Bearer $RESEND_API_KEY"

# 3. Verify DNS records
dig TXT your-domain.com | grep -E "(spf|dkim|dmarc)"
```

#### Solutions

**❌ SPF/DKIM/DMARC Not Configured**
```bash
# Check DNS records
dig TXT your-domain.com

# Should include:
# SPF: "v=spf1 include:_spf.resend.com ~all"
# DKIM: Provided by email service
# DMARC: "v=DMARC1; p=quarantine;"
```

**❌ Invalid From Address**
```bash
# Verify domain ownership
curl -s https://api.resend.com/domains \
  -H "Authorization: Bearer $RESEND_API_KEY"

# Use verified domain
EMAIL_FROM=noreply@your-verified-domain.com
```

---

## 🔧 Configuration Issues

### Environment Variable Problems

#### Symptoms
- Service failing to start
- Features not working as expected
- Configuration validation errors

#### Diagnostic Steps
```bash
# 1. Validate all configuration
truxe config validate

# 2. Check specific settings
truxe config get --all

# 3. Verify environment loading
truxe debug env --show-sources
```

#### Solutions

**❌ Missing Required Variables**
```bash
# Check required variables
truxe config check-required

# Set missing variables
export DATABASE_URL="postgresql://..."
export JWT_PRIVATE_KEY="$(cat private.pem)"
export EMAIL_API_KEY="your-api-key"
```

**❌ Invalid Variable Formats**
```bash
# Check URL formats
truxe config validate --key=DATABASE_URL
truxe config validate --key=REDIS_URL

# Verify boolean values
ENABLE_SIGNUP=true  # not "yes" or "1"
```

---

## 🚀 Performance Issues

### Slow Response Times

#### Symptoms
- API responses taking >1 second
- Timeout errors
- High server load

#### Diagnostic Steps
```bash
# 1. Check performance metrics
curl -s http://localhost:3001/health | jq '.metrics'

# 2. Monitor response times
truxe monitor --endpoint=/auth/magic-link --duration=60s

# 3. Check database performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

#### Solutions

**❌ Database Query Performance**
```bash
# Enable query logging
psql $DATABASE_URL -c "ALTER SYSTEM SET log_statement = 'all';"

# Check slow queries
psql $DATABASE_URL -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Add missing indexes
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY idx_users_email ON users(email);"
```

**❌ Redis Performance Issues**
```bash
# Check Redis memory usage
redis-cli -u $REDIS_URL info memory

# Monitor Redis commands
redis-cli -u $REDIS_URL monitor

# Clear cache if needed
redis-cli -u $REDIS_URL flushdb
```

---

## 🔍 Monitoring & Logging

### Log Analysis

#### Viewing Logs
```bash
# View all logs
truxe logs --tail=100

# Filter by level
truxe logs --level=error --tail=50

# Filter by service
truxe logs --service=auth --tail=30

# Search logs
truxe logs --grep="magic.link" --tail=20

# JSON format for parsing
truxe logs --format=json | jq '.message'
```

#### Common Log Patterns

**Authentication Errors**
```bash
# Find authentication failures
truxe logs --grep="auth.*failed" --tail=20

# Token verification errors
truxe logs --grep="token.*invalid" --tail=20

# Rate limit violations
truxe logs --grep="rate.limit.*exceeded" --tail=20
```

### Health Check Failures

#### Symptoms
- Health endpoint returning 500 errors
- Services marked as unhealthy
- Monitoring alerts firing

#### Diagnostic Steps
```bash
# 1. Check detailed health status
curl -s http://localhost:3001/health | jq '.services'

# 2. Test individual services
truxe status --check-db --check-redis --check-email

# 3. Check service dependencies
docker ps  # If using Docker
systemctl status postgresql redis  # If using system services
```

---

## 🛠️ Development Issues

### CLI Issues

#### Symptoms
- `truxe` command not found
- CLI commands failing
- Template generation errors

#### Solutions

**❌ CLI Not Installed**
```bash
# Install globally
npm install -g @truxe/cli

# Or use npx
npx @truxe/cli@latest --version

# Check installation
which truxe
truxe --version
```

**❌ Template Issues**
```bash
# Update CLI to latest
npm update -g @truxe/cli

# Clear template cache
truxe cache clear

# Re-initialize with fresh templates
truxe init --force --template=nextjs
```

### Development Server Issues

#### Symptoms
- Development server won't start
- Hot reload not working
- TypeScript compilation errors

#### Solutions

**❌ Port Conflicts**
```bash
# Check port usage
lsof -i :3001
netstat -tulpn | grep :3001

# Use different port
truxe.io --port=3002
```

**❌ File Watching Issues**
```bash
# Increase file watch limit (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Restart development server
truxe.io --reload
```

---

## 🚨 Emergency Procedures

### Service Recovery

#### Complete Service Failure
```bash
# 1. Check all services
truxe status --check-all

# 2. Restart services in order
sudo systemctl restart postgresql
sudo systemctl restart redis
truxe restart

# 3. Verify recovery
curl -f http://localhost:3001/health
```

#### Database Recovery
```bash
# 1. Check database status
sudo systemctl status postgresql

# 2. Check disk space
df -h

# 3. Restore from backup if needed
pg_restore -d $DATABASE_URL backup.sql

# 4. Run migrations
truxe migrate up
```

#### Security Incident Response
```bash
# 1. Revoke all sessions for compromised user
curl -X POST http://localhost:3001/admin/security/revoke-user \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"userId":"user-uuid","reason":"security_incident"}'

# 2. Block suspicious IP
curl -X POST http://localhost:3001/admin/security/block-ip \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"ip":"1.2.3.4","reason":"suspicious_activity"}'

# 3. Enable emergency rate limits
curl -X POST http://localhost:3001/admin/ddos/activate \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 📋 Diagnostic Checklist

### Pre-Deployment Checklist
- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] JWT keys generated and valid
- [ ] Email service tested
- [ ] Redis connection verified
- [ ] Rate limiting configured
- [ ] Health checks passing
- [ ] SSL certificates valid

### Production Monitoring Checklist
- [ ] Health endpoint monitoring
- [ ] Error rate monitoring
- [ ] Response time monitoring
- [ ] Database performance monitoring
- [ ] Email delivery monitoring
- [ ] Rate limit violation monitoring
- [ ] Security event monitoring
- [ ] Resource usage monitoring

### Incident Response Checklist
- [ ] Identify affected services
- [ ] Check recent changes/deployments
- [ ] Review error logs
- [ ] Verify external dependencies
- [ ] Check system resources
- [ ] Test service recovery
- [ ] Document incident
- [ ] Plan prevention measures

---

## 📞 Getting Help

### Self-Service Resources
- **[Health Dashboard](http://localhost:3001/health)** - Real-time service status
- **[API Documentation](http://localhost:3001/docs)** - Interactive API explorer
- **[Configuration Reference](./configuration.md)** - Complete config guide
- **[Security Guide](./security-best-practices.md)** - Security best practices

### Community Support
- **[Discord Community](https://discord.gg/truxe)** - Real-time help from community
- **[GitHub Issues](https://github.com/truxe-auth/truxe/issues)** - Bug reports and feature requests
- **[Documentation](https://docs.truxe.io)** - Comprehensive guides and tutorials

### Professional Support
- **Email**: support@truxe.io
- **Priority Support**: Available for Pro and Enterprise customers
- **Emergency Support**: 24/7 for Enterprise customers

---

**Pro Tip**: When reporting issues, always include:
1. Truxe version (`truxe --version`)
2. Environment (development/production)
3. Error messages and logs
4. Steps to reproduce
5. System information (OS, Node.js version)

This information helps us provide faster, more accurate support.

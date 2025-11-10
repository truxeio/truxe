# Environment Configuration Guide

**Last Updated:** 2025-10-30
**Status:** Production Ready
**Best Practices:** Implemented

---

## 📋 Overview

Truxe uses environment-specific configuration files to manage secrets and settings across different environments. This guide covers setup, best practices, and security guidelines.

---

## 📁 Environment File Structure

```
api/
├── .env                    # Local development (gitignored)
├── .env.example           # Template for all environments (committed)
├── .env.production        # Production secrets (gitignored)
├── .env.staging           # Staging secrets (gitignored, optional)
└── .gitignore             # Ensures secrets are never committed
```

### File Purposes

| File | Purpose | Committed to Git | Contains Secrets |
|------|---------|-----------------|------------------|
| `.env` | Local development configuration | ❌ NO | ✅ YES (local only) |
| `.env.example` | Template with placeholders | ✅ YES | ❌ NO |
| `.env.production` | Production configuration | ❌ NO | ✅ YES |
| `.env.staging` | Staging configuration | ❌ NO | ✅ YES |

---

## 🚀 Quick Start

### First Time Setup (Local Development)

```bash
# 1. Navigate to api directory
cd api

# 2. Copy example to create your local .env
cp .env.example .env

# 3. Generate JWT keys
npm run generate-keys

# 4. Start local services
docker-compose up -d database redis

# 5. Run migrations
npm run migrate

# 6. Start API server
npm run dev
```

### Create GitHub OAuth App (Local)

1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Name:** Truxe Auth (Development)
   - **Homepage URL:** `http://localhost:3001`
   - **Callback URL:** `http://localhost:3001/auth/oauth/callback/github`
4. Copy Client ID and Secret to `.env`:
   ```bash
   GITHUB_OAUTH_CLIENT_ID=your_client_id
   GITHUB_OAUTH_CLIENT_SECRET=your_client_secret
   ```

---

## 🔐 Security Best Practices

### DO ✅

- **Use separate OAuth apps** for each environment
- **Generate unique secrets** for each environment
- **Store production secrets** in secure password manager (1Password, LastPass)
- **Rotate secrets quarterly** (recommended)
- **Use strong passwords** (minimum 32 characters)
- **Keep .env.example updated** when adding new variables
- **Document all environment variables** with comments

### DON'T ❌

- **Never commit .env files** to git
- **Never share production secrets** via Slack/Email
- **Never use development secrets** in production
- **Never hardcode secrets** in source code
- **Never use same secrets** across environments

---

## 🌍 Environment-Specific Configuration

### Local Development

**File:** `.env`
**Purpose:** Local development and testing
**Database:** `localhost:21432` (Docker)
**Redis:** `localhost:21379` (Docker)

**Key Settings:**
```bash
NODE_ENV=development
LOG_LEVEL=debug
LOG_FORMAT=pretty
EMAIL_PROVIDER=smtp  # Uses MailHog
CORS_ORIGIN=http://localhost:3000
```

**OAuth Apps:**
- Create separate local OAuth apps
- Use `http://localhost:3001` callback URLs

---

### Production

**File:** `.env.production`
**Purpose:** Production deployment (VPS, Cloud)
**Database:** Internal Docker network or managed service
**Redis:** Internal Docker network or managed service

**Key Settings:**
```bash
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json
EMAIL_PROVIDER=brevo  # Or production email service
CORS_ORIGIN=https://app.example.com
```

**OAuth Apps:**
- Use production domain OAuth apps
- Use `https://api.example.com` callback URLs

**Deployment:**
```bash
# Copy production config
cp .env.production .env

# Or use platform environment variables (recommended)
# Railway, Vercel, etc. - set vars in dashboard
```

---

### Staging (Optional)

**File:** `.env.staging`
**Purpose:** Pre-production testing
**Database:** Staging database
**Redis:** Staging Redis

**Key Settings:**
```bash
NODE_ENV=staging
LOG_LEVEL=debug
EMAIL_PROVIDER=smtp  # Or test email service
CORS_ORIGIN=https://staging-app.example.com
```

---

## 🔑 Secret Management

### Secret Types

#### 1. Database Credentials
```bash
# Generate strong password
openssl rand -base64 24

# Example
DATABASE_URL=postgresql://truxe:SuperSecurePassword123!@localhost:5432/truxe
```

#### 2. OAuth Secrets
```bash
# Generate 32-byte hex key
openssl rand -hex 32

# Example
OAUTH_STATE_SECRET=a1b2c3d4e5f6...  # 64 characters
OAUTH_TOKEN_ENCRYPTION_KEY=1a2b3c4d5e6f...  # 64 characters
```

#### 3. Cookie/Session Secrets
```bash
# Generate strong secret
openssl rand -hex 32

# Example
COOKIE_SECRET=x9y8z7w6v5u4...  # 64 characters
SESSION_SECRET=m1n2o3p4q5r6...  # 64 characters
```

#### 4. JWT Keys
```bash
# Generate RSA key pair
npm run generate-keys

# Keys are automatically added to jwt-keys.env
# Copy to your .env file
```

### Secret Storage Best Practices

**Local Development:**
- Store in `.env` file (gitignored)
- OK to use simple values for development

**Production:**
- **Option 1:** Deployment platform environment variables (recommended)
  - Railway: Dashboard → Environment Variables
  - Vercel: Dashboard → Settings → Environment Variables
  - Heroku: `heroku config:set VAR=value`

- **Option 2:** `.env.production` + secure storage
  - Store in password manager
  - Never commit to git
  - Encrypted backup in secure location

- **Option 3:** Secrets management service
  - AWS Secrets Manager
  - HashiCorp Vault
  - Azure Key Vault

---

## 📊 Required Environment Variables

### Minimal Configuration

These variables are **required** for the API to start:

```bash
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_PRIVATE_KEY="..."
JWT_PUBLIC_KEY="..."
```

### Full Configuration

See `.env.example` for complete list with descriptions.

---

## 🧪 Testing Environment Configuration

### Verify Current Configuration

```bash
# Check which env file is loaded
echo $NODE_ENV

# Verify database connection
npm run db:test

# Verify Redis connection
npm run redis:test

# Check all environment variables (without values)
npm run env:check
```

### Test OAuth Configuration

```bash
# Start API
npm run dev

# Test GitHub OAuth
curl -X POST http://localhost:3001/auth/oauth/github/start \
  -H "Content-Type: application/json" \
  -d '{"redirect_uri":"http://localhost:3000/callback"}'

# Should return authorization URL
```

---

## 🔄 Secret Rotation Schedule

### Quarterly Rotation (Recommended)

**What to rotate:**
- Database passwords
- Redis passwords
- Cookie/Session secrets
- OAuth secrets (state, encryption)

**How to rotate:**
1. Generate new secrets
2. Update `.env.production`
3. Deploy with new secrets
4. Verify functionality
5. Remove old secrets after grace period (24-48h)

**Next Rotation:** 2026-01-30

### Annual Rotation

**What to rotate:**
- JWT key pairs
- OAuth app credentials (if compromised)
- Third-party API keys

---

## 🚨 Security Incident Response

### If Secrets Are Compromised

**Immediate Actions:**
1. **Revoke compromised credentials** immediately
2. **Generate new secrets** using secure methods
3. **Update all environments** with new secrets
4. **Deploy changes** to production
5. **Monitor logs** for suspicious activity
6. **Document incident** with timeline

**Examples:**
- `.env` committed to git → Rotate all secrets
- Production database password leaked → Change immediately
- OAuth keys exposed → Revoke and regenerate

---

## 📝 Maintenance Checklist

### Weekly
- [ ] Check for failed OAuth flows
- [ ] Monitor error logs for configuration issues
- [ ] Verify backup systems are working

### Monthly
- [ ] Review environment variable usage
- [ ] Update `.env.example` if needed
- [ ] Test disaster recovery procedures

### Quarterly
- [ ] Rotate all secrets
- [ ] Security audit of environment files
- [ ] Update this documentation
- [ ] Review access logs

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Missing environment variable"
```bash
# Error: Missing required environment variables: DATABASE_URL

# Solution: Check your .env file has all required variables
cat .env | grep DATABASE_URL

# Compare with .env.example
diff .env .env.example
```

#### 2. "Database connection failed"
```bash
# Check if database is running
docker ps | grep postgres

# Test connection
psql "$DATABASE_URL"

# Verify credentials in .env
```

#### 3. "JWT verification failed"
```bash
# Ensure JWT keys are properly formatted
# Keys should start with "-----BEGIN" and end with "-----END"

# Regenerate if needed
npm run generate-keys
```

#### 4. "OAuth callback mismatch"
```bash
# Ensure callback URL in .env matches GitHub/Google OAuth app settings

# Local:
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/auth/oauth/callback/github

# Production:
GITHUB_OAUTH_REDIRECT_URI=https://api.example.com/auth/oauth/callback/github
```

---

## 📚 Additional Resources

### Documentation
- [GitHub OAuth Setup](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [PostgreSQL Environment Variables](https://www.postgresql.org/docs/current/libpq-envars.html)
- [Redis Configuration](https://redis.io/topics/config)

### Tools
- **Secret Generation:** `openssl rand -hex 32`
- **Password Manager:** 1Password, LastPass, Bitwarden
- **Environment Testing:** `dotenv-cli`, `env-cmd`

---

## ✅ Verification Checklist

Before deploying to production:

- [ ] All secrets are unique (not copied from development)
- [ ] `.env.production` file exists and contains all required variables
- [ ] Production OAuth apps are created with correct callback URLs
- [ ] Secrets are stored in password manager backup
- [ ] `.gitignore` includes all environment files
- [ ] No secrets are hardcoded in source code
- [ ] Database credentials are strong (32+ characters)
- [ ] JWT keys are generated specifically for production
- [ ] Email service is configured for production
- [ ] CORS origins include production domains
- [ ] Monitoring is enabled (ENABLE_METRICS=true)
- [ ] Logging is set to production format (LOG_FORMAT=json)

---

## 🎯 Summary

### Environment Structure

✅ **Implemented:**
- Separate config files for each environment
- Template file (.env.example) committed to git
- All secrets gitignored
- Best practices documented

✅ **Security:**
- No secrets in git
- Strong password generation
- Quarterly rotation schedule
- Incident response procedures

✅ **Usability:**
- Easy setup for developers
- Clear documentation
- Testing procedures
- Troubleshooting guide

---

**Questions?** Check the troubleshooting section or create an issue.

**Last Review:** 2025-10-30
**Next Review:** 2026-01-30 (Quarterly)

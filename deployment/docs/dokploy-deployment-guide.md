# Truxe API - Dokploy Deployment Guide

## Status: Ready to Deploy ✅

All code-side issues have been resolved. The API is ready to deploy once environment variables are configured in Dokploy.

## Required Environment Variables for Dokploy

Copy and paste these into your Dokploy environment variables configuration:

### 1. Domain Configuration
```bash
DOMAIN=truxe.io
CORS_ORIGIN=https://app.truxe.io,https://truxe.io
```

### 2. Database Configuration
**IMPORTANT**: Your database password contains special characters (`/` and `=`) that must be URL-encoded.

Use this complete DATABASE_URL (password is already URL-encoded):
```bash
DATABASE_URL=postgresql://truxe:vZGgiTXCb8HKv%2FvTI4BcHbE7FbxXIYmuEAQLFyb4yn8%3D@database:5432/truxe?sslmode=disable
```

**Alternative**: If you prefer to use individual variables:
```bash
POSTGRES_DB=truxe
POSTGRES_USER=truxe
DB_PASSWORD=vZGgiTXCb8HKv/vTI4BcHbE7FbxXIYmuEAQLFyb4yn8=
DATABASE_SSL=false
```

### 3. Redis Configuration
**IMPORTANT**: Set REDIS_URL based on your Redis setup:
```bash
# For internal Redis container (recommended):
REDIS_URL=redis://:your_redis_password@redis:6379

# For external Redis:
# REDIS_URL=redis://:your_redis_password@your_redis_host:6379
```

### 4. JWT Configuration (Generate Your Own Keys)
```bash
# Generate keys with: npm run generate-keys
# Or manually with openssl:
# openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
# openssl rsa -pubout -in private.pem -out public.pem
# cat private.pem | base64 -w 0
# cat public.pem | base64 -w 0

JWT_PRIVATE_KEY_BASE64=your-base64-encoded-private-key-here
JWT_PUBLIC_KEY_BASE64=your-base64-encoded-public-key-here
```

### 5. Security Secrets
**Generate these securely** - use a password manager or run:
```bash
openssl rand -base64 32
```

```bash
COOKIE_SECRET=your_generated_32_char_secret_here
SESSION_SECRET=your_generated_32_char_secret_here
```

### 6. Email Configuration (Brevo)
```bash
EMAIL_FROM=noreply@truxe.io
BREVO_API_KEY=your_brevo_api_key_here
```

### 7. Optional Settings (Production Defaults)
```bash
LOG_LEVEL=info
ENABLE_METRICS=true
METRICS_PORT=9090
```

## Deployment Steps

1. **In Dokploy UI**:
   - Go to your Truxe application
   - Navigate to Environment Variables section
   - Copy all variables from sections 1-6 above
   - Paste them into Dokploy environment variables
   - **IMPORTANT**: Generate unique values for COOKIE_SECRET and SESSION_SECRET
   - **IMPORTANT**: Add your real BREVO_API_KEY
   - **IMPORTANT**: Set a secure REDIS_PASSWORD

2. **Redeploy**:
   - Click "Redeploy" in Dokploy
   - Monitor the deployment logs

3. **Verify Deployment**:
   - Check health endpoint: `curl https://api.truxe.io/health`
   - Expected response: `{"status":"ok"}`

## What Was Fixed

All the following issues have been resolved in the codebase:

1. ✅ JWT keys converted to Base64 for Dokploy compatibility
2. ✅ Removed port conflicts with Dokploy's Traefik
3. ✅ Added Traefik labels for automatic SSL and routing
4. ✅ Fixed production validation errors
5. ✅ Fixed WebhookService database initialization
6. ✅ Made port management module optional
7. ✅ Added Brevo email provider support
8. ✅ Enhanced error logging for JWT and database validation
9. ✅ Fixed DATABASE_URL to support special characters in passwords
10. ✅ Added 60-second sleep on validation failure to prevent CPU spikes from crash loops
11. ✅ Changed database SSL mode to 'disable' for internal PostgreSQL
12. ✅ Removed duplicate CORS registration

## Current Status

- **Code**: All issues resolved ✅
- **Configuration**: Waiting for environment variables to be set in Dokploy
- **Next Action**: Set environment variables in Dokploy and redeploy

## Troubleshooting

### If deployment still fails:

1. **Check Dokploy Logs**:
   - Look for specific error messages
   - Validation errors will show exactly what's missing

2. **Common Issues**:
   - Missing environment variable → Check all required variables are set
   - JWT key mismatch → Use the exact Base64 values provided above
   - Database connection → Ensure DATABASE_URL is exactly as shown (with URL-encoded password)
   - CORS errors → Verify CORS_ORIGIN matches your frontend domain

3. **Health Check**:
   ```bash
   # Should return {"status":"ok"}
   curl https://api.truxe.io/health

   # Check if SSL is working
   curl -I https://api.truxe.io/health
   ```

## Architecture Notes

- **Traefik**: Using Dokploy's Traefik instance (not self-hosted)
- **Database**: Internal PostgreSQL container (no SSL)
- **Redis**: Internal Redis container with password auth
- **SSL**: Automatic via Let's Encrypt through Traefik
- **Network**: Internal Docker network for service communication

## Support

If you encounter any issues after setting these environment variables:

1. Check the application logs in Dokploy
2. Verify all environment variables are set correctly
3. Ensure no typos in the Base64-encoded JWT keys
4. Confirm DOMAIN matches your actual domain

---

**Last Updated**: 2025-10-28
**Status**: Ready for Deployment
**Commits**: All fixes committed and pushed to main branch
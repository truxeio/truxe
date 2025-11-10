# Dokploy Environment Variables - Truxe API Production

## CRITICAL ISSUES TO FIX:
1. JWT Keys are NOT matching pair - MUST update both
2. DATABASE_URL has placeholder values
3. REDIS_URL has placeholder values

## Required Environment Variables for Dokploy:

### 1. Application Settings
```
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
API_VERSION=v1
```

### 2. Domain Configuration
```
DOMAIN=example.com
API_URL=https://api.example.com
FRONTEND_URL=https://app.example.com
CORS_ORIGIN=https://app.example.com,https://example.com
CORS_CREDENTIALS=true
```

### 3. Database Configuration (REPLACE WITH REAL VALUES)
```
DATABASE_URL=postgresql://your_db_user:your_db_password@your_db_host:5432/truxe
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=100
DATABASE_POOL_IDLE_TIMEOUT=30000
DATABASE_SSL=true
```

### 4. Redis Configuration (REPLACE WITH REAL VALUES)
```
REDIS_URL=redis://:your_redis_password@your_redis_host:6379
REDIS_KEY_PREFIX=truxe:prod:
REDIS_RETRY_DELAY=1000
REDIS_MAX_RETRIES=3
```

### 5. JWT Configuration - MATCHING KEY PAIR REQUIRED!
```
JWT_ALGORITHM=RS256
JWT_ISSUER=https://api.example.com
JWT_AUDIENCE=truxe-api
JWT_ACCESS_TOKEN_TTL=15m
JWT_REFRESH_TOKEN_TTL=30d
```

**OPTION A: Use Base64 Encoded Keys (Current Format)**
```
JWT_PRIVATE_KEY_BASE64=YOUR_NEW_PRIVATE_KEY_BASE64_HERE
JWT_PUBLIC_KEY_BASE64=YOUR_NEW_PUBLIC_KEY_BASE64_HERE
```

**OPTION B: Use Direct Keys (Alternative)**
```
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nYOUR_PUBLIC_KEY_HERE\n-----END PUBLIC KEY-----
```

### 6. Email Configuration
```
EMAIL_PROVIDER=brevo
EMAIL_FROM=noreply@example.com
EMAIL_FROM_NAME=Truxe Auth
BREVO_API_KEY=your_brevo_api_key_here
```

### 7. Security Configuration
```
BCRYPT_ROUNDS=12
SESSION_SECRET=your_32_character_session_secret_here
ADMIN_TOKEN=your_admin_token_here
```

### 8. Rate Limiting
```
RATE_LIMIT_GLOBAL_MAX=1000
RATE_LIMIT_GLOBAL_WINDOW=1h
RATE_LIMIT_MAGIC_LINK_PER_IP=5
RATE_LIMIT_MAGIC_LINK_WINDOW=1m
```

### 9. Feature Flags
```
ENABLE_SIGNUP=true
ENABLE_MAGIC_LINKS=true
ENABLE_WEBHOOKS=true
ENABLE_AUDIT_LOGS=true
ENABLE_SWAGGER=false
ENABLE_REQUEST_LOGGING=true
ENABLE_METRICS=true
ENABLE_HELMET=true
ENABLE_RATE_LIMITING=true
```

### 10. Monitoring & Alerts
```
SECURITY_MONITORING_METRICS_RETENTION=30
SECURITY_MONITORING_REAL_TIME_ALERTS=true
ALERT_WEBHOOK_URL=your_alert_webhook_url
ALERT_EMAIL=your_alert_email@example.com
```

## IMMEDIATE ACTION REQUIRED:

### 1. Generate New JWT Key Pair
Run this command to generate new matching keys:
```bash
cd /Users/ozanoke/Projects/truxe/api
node scripts/generate-keys.js
```

### 2. Update Database Connection
Replace `DATABASE_URL` with your actual PostgreSQL connection string.

### 3. Update Redis Connection  
Replace `REDIS_URL` with your actual Redis connection string.

### 4. Generate Secure Secrets
- `SESSION_SECRET`: 32 character random string
- `ADMIN_TOKEN`: Strong random token

## Current Problem Analysis:
- Your JWT keys don't match (privateKeyLength: 1708 vs publicKeyLength: 451)
- This causes "invalid signature" errors
- Both keys must be from the same RSA key pair

## Next Steps:
1. Generate new matching JWT key pair
2. Update all placeholder values with real production values
3. Set these in Dokploy environment variables
4. Restart the application

# Configuration Management Guide

This guide covers the comprehensive configuration management system in Truxe, including how to customize settings, migrate from hardcoded values, and maintain configuration consistency across environments.

## Table of Contents

- [Overview](#overview)
- [Configuration Structure](#configuration-structure)
- [Environment Variables](#environment-variables)
- [Configuration Constants](#configuration-constants)
- [Migration Tools](#migration-tools)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Truxe uses a centralized configuration management system that eliminates hardcoded values and makes all settings easily configurable through environment variables. This system provides:

- **Type Safety**: All configuration values are properly typed and validated
- **Environment Isolation**: Different settings for development, staging, and production
- **Migration Support**: Tools to migrate from hardcoded values to environment variables
- **Validation**: Comprehensive validation of configuration values
- **Documentation**: Auto-generated configuration documentation

## Configuration Structure

### Core Files

```
api/src/config/
├── index.js              # Main configuration loader
├── constants.js          # Centralized constants and defaults
└── validation.js         # Configuration validation rules

api/scripts/
├── validate-config.js    # Configuration validation tool
└── migrate-config.js     # Configuration migration tool

api/
├── env.example           # Basic environment template
└── env.comprehensive.example  # Complete environment template
```

### Configuration Categories

1. **Application Settings**: Ports, hosts, logging, API versions
2. **Database Configuration**: Connection strings, pool settings, timeouts
3. **Redis Configuration**: URLs, prefixes, retry settings
4. **JWT Configuration**: Algorithms, TTLs, key management
5. **Email Configuration**: Providers, templates, SMTP settings
6. **Security Settings**: CORS, rate limiting, threat detection
7. **Monitoring**: Metrics, alerts, dashboards
8. **Feature Flags**: Enable/disable features per environment

## Environment Variables

### Basic Configuration

```bash
# Application
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/truxe.io
DATABASE_SSL=false
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=truxe:

# JWT
JWT_ALGORITHM=RS256
JWT_ACCESS_TOKEN_TTL=15m
JWT_REFRESH_TOKEN_TTL=30d
```

### Port Management

```bash
# Development Ports
DEV_API_PORT=21001
DEV_DATABASE_PORT=21432
DEV_REDIS_PORT=21379
DEV_MAILHOG_SMTP_PORT=21025
DEV_MAILHOG_WEB_PORT=21825

# Production Ports
PROD_API_PORT=80
PROD_DATABASE_PORT=5432
PROD_REDIS_PORT=6379
PROD_HTTPS_PORT=443
```

### Security Configuration

```bash
# Basic Security
BCRYPT_ROUNDS=12
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_GLOBAL_MAX=1000
RATE_LIMIT_GLOBAL_WINDOW=1h
RATE_LIMIT_MAGIC_LINK_PER_IP=5
RATE_LIMIT_MAGIC_LINK_WINDOW=1m

# Threat Detection
THREAT_DETECTION_BRUTE_FORCE_ENABLED=true
THREAT_DETECTION_BRUTE_FORCE_MAX_ATTEMPTS=5
THREAT_DETECTION_BRUTE_FORCE_WINDOW_MINUTES=15
```

### Email Configuration

```bash
# Email Provider
EMAIL_PROVIDER=brevo
EMAIL_FROM=noreply@truxe.io
EMAIL_FROM_NAME=Truxe Auth

# Brevo (formerly Sendinblue)
BREVO_API_KEY=your_brevo_api_key_here

# SMTP
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=

# AWS SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

### Monitoring Configuration

```bash
# Metrics
SECURITY_MONITORING_METRICS_RETENTION=30
SECURITY_MONITORING_DASHBOARD_REFRESH=30000
SECURITY_MONITORING_REAL_TIME_ALERTS=true

# Alerts
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_EMAIL=admin@yourdomain.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Thresholds
ALERT_THRESHOLD_RATE_LIMIT_VIOLATIONS=100
ALERT_THRESHOLD_DDOS_ATTACKS=5
ALERT_THRESHOLD_SECURITY_THREATS=50
```

## Configuration Constants

The `constants.js` file provides centralized default values for all configuration options:

```javascript
import { APP_CONSTANTS, PORT_CONSTANTS, DATABASE_CONSTANTS } from './constants.js'

// Application defaults
APP_CONSTANTS.DEFAULT_PORT = 3001
APP_CONSTANTS.DEFAULT_HOST = '0.0.0.0'
APP_CONSTANTS.DEFAULT_LOG_LEVEL = 'info'

// Port defaults
PORT_CONSTANTS.DEV_API_PORT = 21001
PORT_CONSTANTS.DEV_DATABASE_PORT = 21432
PORT_CONSTANTS.PROD_API_PORT = 80
PORT_CONSTANTS.PROD_DATABASE_PORT = 5432

// Database defaults
DATABASE_CONSTANTS.DEFAULT_POOL_MIN = 2
DATABASE_CONSTANTS.DEFAULT_POOL_MAX = 10
DATABASE_CONSTANTS.DEFAULT_CONNECTION_TIMEOUT = '10s'
```

### Available Constant Categories

- `APP_CONSTANTS`: Application settings
- `PORT_CONSTANTS`: Port management
- `DATABASE_CONSTANTS`: Database configuration
- `REDIS_CONSTANTS`: Redis configuration
- `JWT_CONSTANTS`: JWT settings
- `EMAIL_CONSTANTS`: Email configuration
- `MAGIC_LINK_CONSTANTS`: Magic link settings
- `RATE_LIMIT_CONSTANTS`: Rate limiting
- `SECURITY_CONSTANTS`: Security settings
- `UI_CONSTANTS`: UI/UX values
- `PLAN_CONSTANTS`: Plan-based quotas
- `THREAT_DETECTION_CONSTANTS`: Threat detection
- `REFRESH_TOKEN_CONSTANTS`: Refresh token settings
- `MONITORING_CONSTANTS`: Monitoring configuration
- `WEBHOOK_CONSTANTS`: Webhook settings
- `CLIENT_TOKEN_REFRESH_CONSTANTS`: Client token refresh
- `FEATURE_FLAGS_CONSTANTS`: Feature flags
- `ADMIN_CONSTANTS`: Admin settings
- `SECURITY_INCIDENT_RESPONSE_CONSTANTS`: Incident response

## Migration Tools

### Configuration Validator

The configuration validator helps identify hardcoded values and provides migration suggestions:

```bash
# Validate all configuration files
npm run config:validate

# Generate configuration recommendations
npm run config:recommend

# Generate environment template
npm run config:template production
```

### Configuration Migrator

The configuration migrator automatically converts hardcoded values to environment variables:

```bash
# Migrate all configuration files
npm run config:migrate

# Dry run (show changes without applying)
npm run config:migrate-dry

# Migrate without creating backups
npm run config:migrate -- --no-backup
```

### Migration Examples

**Before (Hardcoded):**
```javascript
const config = {
  port: 3001,
  database: {
    poolMin: 2,
    poolMax: 10
  },
  email: {
    from: 'noreply@truxe.io'
  }
}
```

**After (Configurable):**
```javascript
const config = {
  port: parseInteger(process.env.PORT, APP_CONSTANTS.DEFAULT_PORT),
  database: {
    poolMin: parseInteger(process.env.DATABASE_POOL_MIN, DATABASE_CONSTANTS.DEFAULT_POOL_MIN),
    poolMax: parseInteger(process.env.DATABASE_POOL_MAX, DATABASE_CONSTANTS.DEFAULT_POOL_MAX)
  },
  email: {
    from: process.env.EMAIL_FROM || EMAIL_CONSTANTS.DEFAULT_FROM
  }
}
```

## Best Practices

### 1. Environment-Specific Configuration

Create separate environment files for different stages:

```bash
# Development
cp env.comprehensive.example .env.development

# Staging
cp env.comprehensive.example .env.staging

# Production
cp env.comprehensive.example .env.production
```

### 2. Use Configuration Constants

Always use constants instead of hardcoded values:

```javascript
// ❌ Bad
const timeout = 5000

// ✅ Good
const timeout = parseInteger(process.env.TIMEOUT, TIMEOUT_CONSTANTS.DEFAULT)
```

### 3. Validate Configuration

Always validate configuration values:

```javascript
// ❌ Bad
const port = process.env.PORT

// ✅ Good
const port = parseInteger(process.env.PORT, APP_CONSTANTS.DEFAULT_PORT)
```

### 4. Environment Isolation

Use different values for different environments:

```bash
# Development
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000

# Production
NODE_ENV=production
PORT=80
LOG_LEVEL=info
CORS_ORIGIN=https://yourdomain.com
```

### 5. Secure Sensitive Values

Never commit sensitive values to version control:

```bash
# ❌ Bad - in .env file
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# ✅ Good - use secrets management
JWT_PRIVATE_KEY_FILE=/run/secrets/jwt_private_key
```

### 6. Document Configuration

Document all configuration options:

```javascript
/**
 * Database Configuration
 * 
 * @param {string} url - Database connection URL
 * @param {boolean} ssl - Enable SSL connection
 * @param {number} poolMin - Minimum connection pool size
 * @param {number} poolMax - Maximum connection pool size
 */
database: {
  url: process.env.DATABASE_URL,
  ssl: parseBoolean(process.env.DATABASE_SSL, DATABASE_CONSTANTS.DEFAULT_SSL),
  poolMin: parseInteger(process.env.DATABASE_POOL_MIN, DATABASE_CONSTANTS.DEFAULT_POOL_MIN),
  poolMax: parseInteger(process.env.DATABASE_POOL_MAX, DATABASE_CONSTANTS.DEFAULT_POOL_MAX)
}
```

## Troubleshooting

### Common Issues

#### 1. Configuration Not Loading

**Problem**: Environment variables not being loaded
**Solution**: Check file path and ensure `.env` file exists

```bash
# Check if .env file exists
ls -la .env

# Verify environment variables
node -e "console.log(process.env.NODE_ENV)"
```

#### 2. Port Conflicts

**Problem**: Port already in use
**Solution**: Use port management system

```bash
# Check port usage
npm run config:validate

# Use different port
TRUXE_API_PORT=21002 npm start
```

#### 3. Database Connection Issues

**Problem**: Database connection failing
**Solution**: Check database configuration

```bash
# Verify database URL
echo $DATABASE_URL

# Test database connection
npm run health:check
```

#### 4. Email Not Sending

**Problem**: Email service not working
**Solution**: Check email provider configuration

```bash
# Check email provider
echo $EMAIL_PROVIDER

# Test email service
curl http://localhost:3001/health/email
```

### Debugging Configuration

#### 1. Enable Debug Logging

```bash
LOG_LEVEL=debug npm start
```

#### 2. Validate Configuration

```bash
npm run config:validate
```

#### 3. Check Environment Variables

```bash
# List all environment variables
env | grep TRUXE

# Check specific variable
echo $TRUXE_API_PORT
```

#### 4. Test Configuration Loading

```bash
# Test configuration loading
node -e "
import config from './src/config/index.js';
console.log(JSON.stringify(config, null, 2));
"
```

### Getting Help

1. **Check Documentation**: Review this guide and API documentation
2. **Run Validation**: Use `npm run config:validate` to identify issues
3. **Check Logs**: Review application logs for error messages
4. **Community Support**: Ask questions in the Truxe community
5. **Issue Tracker**: Report bugs and feature requests

## Advanced Configuration

### Custom Configuration Loaders

Create custom configuration loaders for specific needs:

```javascript
// custom-config.js
import { loadConfig } from './config/index.js'

export function loadCustomConfig() {
  const baseConfig = loadConfig()
  
  return {
    ...baseConfig,
    custom: {
      feature: process.env.CUSTOM_FEATURE || 'default',
      setting: parseInteger(process.env.CUSTOM_SETTING, 100)
    }
  }
}
```

### Configuration Validation Rules

Add custom validation rules:

```javascript
// validation-rules.js
export const customValidationRules = {
  customFeature: (value) => {
    const validValues = ['enabled', 'disabled', 'auto']
    return validValues.includes(value)
  },
  customSetting: (value) => {
    return value >= 0 && value <= 1000
  }
}
```

### Environment-Specific Overrides

Use environment-specific overrides:

```javascript
// config/index.js
const environmentOverrides = {
  development: {
    logLevel: 'debug',
    enableSwagger: true
  },
  production: {
    logLevel: 'info',
    enableSwagger: false
  }
}

const config = {
  ...baseConfig,
  ...environmentOverrides[process.env.NODE_ENV]
}
```

This configuration management system provides a robust, scalable, and maintainable way to manage all aspects of the Truxe application across different environments.

/**
 * Truxe API Configuration
 * 
 * Centralized configuration management with validation and type safety.
 * Supports environment-specific settings and secure secret management.
 * Integrated with centralized port management system.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  APP_CONSTANTS,
  PORT_CONSTANTS,
  DATABASE_CONSTANTS,
  REDIS_CONSTANTS,
  JWT_CONSTANTS,
  EMAIL_CONSTANTS,
  EMAIL_VERIFICATION_CONSTANTS,
  MAGIC_LINK_CONSTANTS,
  OAUTH_CONSTANTS,
  RATE_LIMIT_CONSTANTS,
  SECURITY_CONSTANTS,
  HEALTH_CHECK_CONSTANTS,
  UI_CONSTANTS,
  PLAN_CONSTANTS,
  THREAT_DETECTION_CONSTANTS,
  REFRESH_TOKEN_CONSTANTS,
  MONITORING_CONSTANTS,
  ALERT_NOTIFICATION_CONSTANTS,
  WEBHOOK_CONSTANTS,
  CLIENT_TOKEN_REFRESH_CONSTANTS,
  FEATURE_FLAGS_CONSTANTS,
  ADMIN_CONSTANTS,
  SECURITY_INCIDENT_RESPONSE_CONSTANTS
} from './constants.js'

/**
 * Parse time duration string to milliseconds
 * Supports: 1s, 30s, 5m, 1h, 1d
 */
function parseDuration(duration) {
  if (typeof duration === 'number') return duration
  
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match) throw new Error(`Invalid duration format: ${duration}`)
  
  const [, value, unit] = match
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
  
  return parseInt(value) * multipliers[unit]
}

/**
 * Parse boolean from environment variable
 */
function parseBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue
  return value.toLowerCase() === 'true'
}

/**
 * Parse integer from environment variable
 */
function parseInteger(value, defaultValue = 0) {
  if (value === undefined) return defaultValue
  const parsed = parseInt(value)
  if (isNaN(parsed)) throw new Error(`Invalid integer: ${value}`)
  return parsed
}

/**
 * Parse comma-separated list into array
 */
function parseList(value, defaultValue = []) {
  if (value === undefined || value === null) return Array.isArray(defaultValue) ? defaultValue : []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

/**
 * Load and format RSA key from environment or file
 */
function loadRSAKey(keyData, keyType = 'private') {
  // Check if we should load from file instead
  const keyFileEnv = keyType === 'private' ? 'JWT_PRIVATE_KEY_FILE' : 'JWT_PUBLIC_KEY_FILE'
  const keyFile = process.env[keyFileEnv]
  
  if (keyFile) {
    try {
      return readFileSync(keyFile, 'utf8')
    } catch (error) {
      throw new Error(`Failed to read ${keyType} key from file ${keyFile}: ${error.message}`)
    }
  }
  
  if (!keyData) {
    throw new Error(`${keyType.toUpperCase()} key is required`)
  }
  
  // Handle base64 encoded keys
  if (!keyData.includes('-----BEGIN')) {
    try {
      keyData = Buffer.from(keyData, 'base64').toString('utf8')
    } catch (error) {
      throw new Error(`Invalid ${keyType} key format`)
    }
  }
  
  // Ensure proper formatting
  return keyData.replace(/\\n/g, '\n')
}

/**
 * Validate required environment variables
 */
function validateRequired(config) {
  const required = [
    'DATABASE_URL',
    'JWT_ISSUER',
    'OAUTH_STATE_SECRET',
    'OAUTH_TOKEN_ENCRYPTION_KEY',
  ]
  
  // Check JWT configuration - either environment variables OR file paths must be provided
  const hasJWTEnvVars = process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY
  const hasJWTBase64Vars = process.env.JWT_PRIVATE_KEY_BASE64 && process.env.JWT_PUBLIC_KEY_BASE64
  const hasJWTFiles = process.env.JWT_PRIVATE_KEY_FILE && process.env.JWT_PUBLIC_KEY_FILE

  if (!hasJWTEnvVars && !hasJWTBase64Vars && !hasJWTFiles) {
    throw new Error('JWT configuration missing: Either JWT_PRIVATE_KEY/JWT_PUBLIC_KEY or JWT_PRIVATE_KEY_BASE64/JWT_PUBLIC_KEY_BASE64 environment variables OR JWT_PRIVATE_KEY_FILE/JWT_PUBLIC_KEY_FILE file paths must be provided')
  }
  
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

/**
 * Load configuration from environment variables
 */
function loadConfig() {
  // Validate required variables
  validateRequired()

  const jwtIssuer = process.env.JWT_ISSUER
  
  const config = {
    // Application Settings
    app: {
      name: APP_CONSTANTS.NAME,
      version: APP_CONSTANTS.VERSION,
      environment: process.env.NODE_ENV || APP_CONSTANTS.DEFAULT_ENVIRONMENT,
      port: parseInteger(process.env.PORT, APP_CONSTANTS.DEFAULT_PORT),
      host: process.env.HOST || APP_CONSTANTS.DEFAULT_HOST,
      logLevel: process.env.LOG_LEVEL || APP_CONSTANTS.DEFAULT_LOG_LEVEL,
      apiVersion: process.env.API_VERSION || APP_CONSTANTS.DEFAULT_API_VERSION,
    },
    
    // Port Management Configuration
    portManagement: {
      enabled: parseBoolean(process.env.TRUXE_PORT_VALIDATION, true),
      environment: process.env.TRUXE_ENV || process.env.NODE_ENV || APP_CONSTANTS.DEFAULT_ENVIRONMENT,
      conflictCheck: parseBoolean(process.env.TRUXE_PORT_CONFLICT_CHECK, true),
      rangeStart: parseInteger(process.env.TRUXE_PORT_RANGE_START, PORT_CONSTANTS.DEVELOPMENT_RANGE_START),
      rangeEnd: parseInteger(process.env.TRUXE_PORT_RANGE_END, PORT_CONSTANTS.DEVELOPMENT_RANGE_END),
      servicePorts: {
        api: parseInteger(process.env.TRUXE_API_PORT, PORT_CONSTANTS.DEV_API_PORT),
        database: parseInteger(process.env.TRUXE_DATABASE_PORT, PORT_CONSTANTS.DEV_DATABASE_PORT),
        redis: parseInteger(process.env.TRUXE_REDIS_PORT, PORT_CONSTANTS.DEV_REDIS_PORT),
        mailhog_smtp: parseInteger(process.env.TRUXE_MAILHOG_SMTP_PORT, PORT_CONSTANTS.DEV_MAILHOG_SMTP_PORT),
        mailhog_web: parseInteger(process.env.TRUXE_MAILHOG_WEB_PORT, PORT_CONSTANTS.DEV_MAILHOG_WEB_PORT),
        docs: parseInteger(process.env.TRUXE_DOCS_PORT, PORT_CONSTANTS.DEV_DOCS_PORT),
        monitoring: parseInteger(process.env.TRUXE_MONITORING_PORT, PORT_CONSTANTS.DEV_MONITORING_PORT),
        grafana: parseInteger(process.env.TRUXE_GRAFANA_PORT, PORT_CONSTANTS.DEV_GRAFANA_PORT),
        prometheus: parseInteger(process.env.TRUXE_PROMETHEUS_PORT, PORT_CONSTANTS.DEV_PROMETHEUS_PORT),
      },
      fallback: {
        enabled: parseBoolean(process.env.TRUXE_PORT_FALLBACK_ENABLED, true),
        maxAttempts: parseInteger(process.env.TRUXE_PORT_FALLBACK_MAX_ATTEMPTS, 10),
        increment: parseInteger(process.env.TRUXE_PORT_FALLBACK_INCREMENT, 1),
      },
    },
    
    // Database Configuration
    database: {
      url: process.env.DATABASE_URL,
      ssl: parseBoolean(process.env.DATABASE_SSL, DATABASE_CONSTANTS.DEFAULT_SSL),
      poolMin: parseInteger(process.env.DATABASE_POOL_MIN, DATABASE_CONSTANTS.DEFAULT_POOL_MIN),
      poolMax: parseInteger(process.env.DATABASE_POOL_MAX, DATABASE_CONSTANTS.DEFAULT_POOL_MAX),
      connectionTimeout: parseDuration(process.env.DATABASE_CONNECTION_TIMEOUT || DATABASE_CONSTANTS.DEFAULT_CONNECTION_TIMEOUT),
      statementTimeout: parseDuration(process.env.DATABASE_STATEMENT_TIMEOUT || DATABASE_CONSTANTS.DEFAULT_STATEMENT_TIMEOUT),
    },
    
    // Redis Configuration
    redis: {
      url: process.env.REDIS_URL || REDIS_CONSTANTS.DEFAULT_URL,
      keyPrefix: process.env.REDIS_KEY_PREFIX || REDIS_CONSTANTS.DEFAULT_KEY_PREFIX,
      retryDelayOnFailover: parseInteger(process.env.REDIS_RETRY_DELAY, REDIS_CONSTANTS.DEFAULT_RETRY_DELAY),
      maxRetriesPerRequest: parseInteger(process.env.REDIS_MAX_RETRIES, REDIS_CONSTANTS.DEFAULT_MAX_RETRIES),
    },
    
    // JWT Configuration
    jwt: {
      algorithm: process.env.JWT_ALGORITHM || JWT_CONSTANTS.DEFAULT_ALGORITHM,
      issuer: jwtIssuer,
      audience: process.env.JWT_AUDIENCE || JWT_CONSTANTS.DEFAULT_AUDIENCE,
      privateKey: loadRSAKey(process.env.JWT_PRIVATE_KEY_BASE64 || process.env.JWT_PRIVATE_KEY, 'private'),
      publicKey: loadRSAKey(process.env.JWT_PUBLIC_KEY_BASE64 || process.env.JWT_PUBLIC_KEY, 'public'),
      accessTokenTTL: parseDuration(process.env.JWT_ACCESS_TOKEN_TTL || JWT_CONSTANTS.DEFAULT_ACCESS_TOKEN_TTL),
      refreshTokenTTL: parseDuration(process.env.JWT_REFRESH_TOKEN_TTL || JWT_CONSTANTS.DEFAULT_REFRESH_TOKEN_TTL),
      keyId: process.env.JWT_KEY_ID || JWT_CONSTANTS.DEFAULT_KEY_ID,
    },
    
    // Email Configuration
    email: {
      provider: process.env.EMAIL_PROVIDER || EMAIL_CONSTANTS.DEFAULT_PROVIDER,
      from: process.env.EMAIL_FROM || EMAIL_CONSTANTS.DEFAULT_FROM,
      fromName: process.env.EMAIL_FROM_NAME || EMAIL_CONSTANTS.DEFAULT_FROM_NAME,
      
      // Resend
      resend: {
        apiKey: process.env.RESEND_API_KEY,
      },
      
      // AWS SES
      ses: {
        region: process.env.AWS_REGION || EMAIL_CONSTANTS.DEFAULT_AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      
      // SMTP
      smtp: {
        host: process.env.SMTP_HOST,
        port: parseInteger(process.env.SMTP_PORT, EMAIL_CONSTANTS.DEFAULT_SMTP_PORT),
        secure: parseBoolean(process.env.SMTP_SECURE, EMAIL_CONSTANTS.DEFAULT_SMTP_SECURE),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      
      // Brevo (formerly Sendinblue)
      brevo: {
        apiKey: process.env.BREVO_API_KEY,
      },
    },
    
    // Magic Link Configuration
    magicLink: {
      ttl: parseDuration(process.env.MAGIC_LINK_TTL || MAGIC_LINK_CONSTANTS.DEFAULT_TTL),
      baseUrl: process.env.MAGIC_LINK_BASE_URL || MAGIC_LINK_CONSTANTS.DEFAULT_BASE_URL,
      tokenLength: parseInteger(process.env.MAGIC_LINK_TOKEN_LENGTH, MAGIC_LINK_CONSTANTS.DEFAULT_TOKEN_LENGTH),
      expiresInText: process.env.MAGIC_LINK_EXPIRES_IN_TEXT || MAGIC_LINK_CONSTANTS.DEFAULT_EXPIRES_IN_TEXT,
    },

    // Email Verification Configuration
    emailVerification: {
      baseUrl: process.env.EMAIL_VERIFICATION_BASE_URL ||
        EMAIL_VERIFICATION_CONSTANTS.DEFAULT_BASE_URL ||
        jwtIssuer,
      verificationUrlBase: process.env.EMAIL_VERIFICATION_URL_BASE ||
        process.env.EMAIL_VERIFICATION_BASE_URL ||
        EMAIL_VERIFICATION_CONSTANTS.DEFAULT_BASE_URL ||
        jwtIssuer,
      verificationPath: process.env.EMAIL_VERIFICATION_PATH || EMAIL_VERIFICATION_CONSTANTS.DEFAULT_PATH,
      confirmationRedirectUrl: process.env.EMAIL_VERIFICATION_CONFIRMATION_REDIRECT_URL || null,
    },

    // OAuth Configuration
    oauth: {
      enabled: parseBoolean(process.env.ENABLE_OAUTH, FEATURE_FLAGS_CONSTANTS.DEFAULT_OAUTH),
      state: {
        secret: process.env.OAUTH_STATE_SECRET,
        ttl: parseInteger(process.env.OAUTH_STATE_TTL, OAUTH_CONSTANTS.DEFAULT_STATE_TTL),
        length: parseInteger(process.env.OAUTH_STATE_LENGTH, OAUTH_CONSTANTS.DEFAULT_STATE_LENGTH),
        keyPrefix: process.env.OAUTH_STATE_REDIS_KEY_PREFIX || OAUTH_CONSTANTS.DEFAULT_STATE_KEY_PREFIX,
      },
      callbackBaseUrl: process.env.OAUTH_CALLBACK_BASE_URL || OAUTH_CONSTANTS.DEFAULT_CALLBACK_BASE_URL,
      tenantParameter: process.env.OAUTH_TENANT_PARAMETER || OAUTH_CONSTANTS.DEFAULT_TENANT_PARAMETER,
      allowedRedirectHosts: process.env.OAUTH_ALLOWED_REDIRECT_HOSTS
        ? process.env.OAUTH_ALLOWED_REDIRECT_HOSTS.split(',').map(host => host.trim()).filter(Boolean)
        : OAUTH_CONSTANTS.DEFAULT_ALLOWED_REDIRECT_HOSTS,
      tokenEncryption: {
        key: process.env.OAUTH_TOKEN_ENCRYPTION_KEY,
        algorithm: process.env.OAUTH_TOKEN_ENCRYPTION_ALGORITHM || OAUTH_CONSTANTS.DEFAULT_TOKEN_ENCRYPTION_ALGORITHM,
      },
      providers: {
        google: {
          enabled: parseBoolean(process.env.GOOGLE_OAUTH_ENABLED, true),
          clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
          callbackPath: process.env.GOOGLE_OAUTH_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL || '/auth/callback/google',
          scopes: (process.env.GOOGLE_OAUTH_SCOPES || 'openid,email,profile')
            .split(',')
            .map(scope => scope.trim())
            .filter(Boolean),
          authorizationUrl: process.env.GOOGLE_OAUTH_AUTHORIZATION_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenUrl: process.env.GOOGLE_OAUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token',
          userInfoUrl: process.env.GOOGLE_OAUTH_USERINFO_URL || 'https://openidconnect.googleapis.com/v1/userinfo',
        },
        github: {
          enabled: parseBoolean(process.env.GITHUB_OAUTH_ENABLED, true),
          clientId: process.env.GITHUB_OAUTH_CLIENT_ID || process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET,
          callbackPath: process.env.GITHUB_OAUTH_REDIRECT_URI || process.env.GITHUB_CALLBACK_URL || '/auth/oauth/callback/github',
          scopes: (process.env.GITHUB_OAUTH_SCOPES || 'read:user,user:email')
            .split(',')
            .map(scope => scope.trim())
            .filter(Boolean),
          authorizationUrl: process.env.GITHUB_OAUTH_AUTHORIZATION_URL || 'https://github.com/login/oauth/authorize',
          tokenUrl: process.env.GITHUB_OAUTH_TOKEN_URL || 'https://github.com/login/oauth/access_token',
          userInfoUrl: process.env.GITHUB_OAUTH_USERINFO_URL || 'https://api.github.com/user',
          apiVersion: process.env.GITHUB_API_VERSION || '2022-11-28',
          userAgent: process.env.GITHUB_USER_AGENT || 'Truxe-Auth',
          enterpriseUrl: process.env.GITHUB_ENTERPRISE_URL || null,
        },
        apple: {
          enabled: parseBoolean(process.env.APPLE_OAUTH_ENABLED, false),
          clientId: process.env.APPLE_OAUTH_CLIENT_ID || process.env.APPLE_CLIENT_ID,
          teamId: process.env.APPLE_OAUTH_TEAM_ID || process.env.APPLE_TEAM_ID,
          keyId: process.env.APPLE_OAUTH_KEY_ID || process.env.APPLE_KEY_ID,
          privateKey: process.env.APPLE_OAUTH_PRIVATE_KEY || process.env.APPLE_PRIVATE_KEY,
          callbackPath: process.env.APPLE_OAUTH_CALLBACK_URL || process.env.APPLE_CALLBACK_URL || '/auth/oauth/callback/apple',
          scopes: (process.env.APPLE_OAUTH_SCOPES || 'openid,email,name')
            .split(',')
            .map(scope => scope.trim())
            .filter(Boolean),
          authorizationUrl: process.env.APPLE_OAUTH_AUTHORIZATION_URL || 'https://appleid.apple.com/auth/authorize',
          tokenUrl: process.env.APPLE_OAUTH_TOKEN_URL || 'https://appleid.apple.com/auth/token',
          revokeUrl: process.env.APPLE_OAUTH_REVOKE_URL || 'https://appleid.apple.com/auth/revoke',
        },
        microsoft: {
          enabled: parseBoolean(process.env.MICROSOFT_OAUTH_ENABLED, false),
          clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET,
          tenant: process.env.MICROSOFT_OAUTH_TENANT || 'common',
          callbackPath: process.env.MICROSOFT_OAUTH_CALLBACK_URL || process.env.MICROSOFT_CALLBACK_URL || '/auth/oauth/callback/microsoft',
          scopes: (process.env.MICROSOFT_OAUTH_SCOPES || 'openid,email,profile,User.Read')
            .split(',')
            .map(scope => scope.trim())
            .filter(Boolean),
        },
      },
    },
    
    // Rate Limiting Configuration
    rateLimit: {
      magicLink: {
        perIP: parseInteger(process.env.RATE_LIMIT_MAGIC_LINK_PER_IP, RATE_LIMIT_CONSTANTS.MAGIC_LINK_PER_IP),
        windowIP: parseDuration(process.env.RATE_LIMIT_MAGIC_LINK_WINDOW || RATE_LIMIT_CONSTANTS.MAGIC_LINK_WINDOW_IP),
        perEmail: parseInteger(process.env.RATE_LIMIT_MAGIC_LINK_PER_EMAIL, RATE_LIMIT_CONSTANTS.MAGIC_LINK_PER_EMAIL),
        windowEmail: parseDuration(process.env.RATE_LIMIT_MAGIC_LINK_EMAIL_WINDOW || RATE_LIMIT_CONSTANTS.MAGIC_LINK_WINDOW_EMAIL),
      },
      verify: {
        perIP: parseInteger(process.env.RATE_LIMIT_VERIFY_PER_IP, RATE_LIMIT_CONSTANTS.VERIFY_PER_IP),
        windowIP: parseDuration(process.env.RATE_LIMIT_VERIFY_WINDOW || RATE_LIMIT_CONSTANTS.VERIFY_WINDOW_IP),
        perToken: parseInteger(process.env.RATE_LIMIT_VERIFY_PER_TOKEN, RATE_LIMIT_CONSTANTS.VERIFY_PER_TOKEN),
      },
      refresh: {
        perUser: parseInteger(process.env.RATE_LIMIT_REFRESH_PER_USER, RATE_LIMIT_CONSTANTS.REFRESH_PER_USER),
        window: parseDuration(process.env.RATE_LIMIT_REFRESH_WINDOW || RATE_LIMIT_CONSTANTS.REFRESH_WINDOW),
      },
      global: {
        max: parseInteger(process.env.RATE_LIMIT_GLOBAL_MAX, RATE_LIMIT_CONSTANTS.GLOBAL_MAX),
        window: parseDuration(process.env.RATE_LIMIT_GLOBAL_WINDOW || RATE_LIMIT_CONSTANTS.GLOBAL_WINDOW),
      },
      // DDoS Protection Settings
      ddos: {
        suspiciousIPThreshold: parseInteger(process.env.DDOS_SUSPICIOUS_IP_THRESHOLD, RATE_LIMIT_CONSTANTS.DDOS_SUSPICIOUS_IP_THRESHOLD),
        globalSpikeThreshold: parseInteger(process.env.DDOS_GLOBAL_SPIKE_THRESHOLD, RATE_LIMIT_CONSTANTS.DDOS_GLOBAL_SPIKE_THRESHOLD),
        failedAuthThreshold: parseInteger(process.env.DDOS_FAILED_AUTH_THRESHOLD, RATE_LIMIT_CONSTANTS.DDOS_FAILED_AUTH_THRESHOLD),
        circuitBreakerThreshold: parseInteger(process.env.DDOS_CIRCUIT_BREAKER_THRESHOLD, RATE_LIMIT_CONSTANTS.DDOS_CIRCUIT_BREAKER_THRESHOLD),
        circuitBreakerTimeout: parseDuration(process.env.DDOS_CIRCUIT_BREAKER_TIMEOUT || RATE_LIMIT_CONSTANTS.DDOS_CIRCUIT_BREAKER_TIMEOUT),
      },
    },
    
    // Plan-based Quotas Configuration
    plans: {
      free: {
        emailsPerMonth: parseInteger(process.env.PLAN_FREE_EMAILS_PER_MONTH, PLAN_CONSTANTS.FREE_EMAILS_PER_MONTH),
        emailsPerUserPerDay: parseInteger(process.env.PLAN_FREE_EMAILS_PER_USER_PER_DAY, PLAN_CONSTANTS.FREE_EMAILS_PER_USER_PER_DAY),
        apiRequestsPerHour: parseInteger(process.env.PLAN_FREE_API_REQUESTS_PER_HOUR, PLAN_CONSTANTS.FREE_API_REQUESTS_PER_HOUR),
        magicLinksPerHour: parseInteger(process.env.PLAN_FREE_MAGIC_LINKS_PER_HOUR, PLAN_CONSTANTS.FREE_MAGIC_LINKS_PER_HOUR),
        refreshTokensPerHour: parseInteger(process.env.PLAN_FREE_REFRESH_TOKENS_PER_HOUR, PLAN_CONSTANTS.FREE_REFRESH_TOKENS_PER_HOUR),
        concurrentSessions: parseInteger(process.env.PLAN_FREE_CONCURRENT_SESSIONS, PLAN_CONSTANTS.FREE_CONCURRENT_SESSIONS),
      },
      starter: {
        emailsPerMonth: parseInteger(process.env.PLAN_STARTER_EMAILS_PER_MONTH, PLAN_CONSTANTS.STARTER_EMAILS_PER_MONTH),
        emailsPerUserPerDay: parseInteger(process.env.PLAN_STARTER_EMAILS_PER_USER_PER_DAY, PLAN_CONSTANTS.STARTER_EMAILS_PER_USER_PER_DAY),
        apiRequestsPerHour: parseInteger(process.env.PLAN_STARTER_API_REQUESTS_PER_HOUR, PLAN_CONSTANTS.STARTER_API_REQUESTS_PER_HOUR),
        magicLinksPerHour: parseInteger(process.env.PLAN_STARTER_MAGIC_LINKS_PER_HOUR, PLAN_CONSTANTS.STARTER_MAGIC_LINKS_PER_HOUR),
        refreshTokensPerHour: parseInteger(process.env.PLAN_STARTER_REFRESH_TOKENS_PER_HOUR, PLAN_CONSTANTS.STARTER_REFRESH_TOKENS_PER_HOUR),
        concurrentSessions: parseInteger(process.env.PLAN_STARTER_CONCURRENT_SESSIONS, PLAN_CONSTANTS.STARTER_CONCURRENT_SESSIONS),
      },
      pro: {
        emailsPerMonth: parseInteger(process.env.PLAN_PRO_EMAILS_PER_MONTH, PLAN_CONSTANTS.PRO_EMAILS_PER_MONTH),
        emailsPerUserPerDay: parseInteger(process.env.PLAN_PRO_EMAILS_PER_USER_PER_DAY, PLAN_CONSTANTS.PRO_EMAILS_PER_USER_PER_DAY),
        apiRequestsPerHour: parseInteger(process.env.PLAN_PRO_API_REQUESTS_PER_HOUR, PLAN_CONSTANTS.PRO_API_REQUESTS_PER_HOUR),
        magicLinksPerHour: parseInteger(process.env.PLAN_PRO_MAGIC_LINKS_PER_HOUR, PLAN_CONSTANTS.PRO_MAGIC_LINKS_PER_HOUR),
        refreshTokensPerHour: parseInteger(process.env.PLAN_PRO_REFRESH_TOKENS_PER_HOUR, PLAN_CONSTANTS.PRO_REFRESH_TOKENS_PER_HOUR),
        concurrentSessions: parseInteger(process.env.PLAN_PRO_CONCURRENT_SESSIONS, PLAN_CONSTANTS.PRO_CONCURRENT_SESSIONS),
      },
      enterprise: {
        emailsPerMonth: -1, // Unlimited
        emailsPerUserPerDay: -1,
        apiRequestsPerHour: -1,
        magicLinksPerHour: -1,
        refreshTokensPerHour: -1,
        concurrentSessions: -1,
      },
    },
    
    // Security Configuration
    security: {
      bcryptRounds: parseInteger(process.env.BCRYPT_ROUNDS, SECURITY_CONSTANTS.DEFAULT_BCRYPT_ROUNDS),
      corsOrigin: parseList(process.env.CORS_ORIGIN, [SECURITY_CONSTANTS.DEFAULT_CORS_ORIGIN]),
      corsCredentials: parseBoolean(process.env.CORS_CREDENTIALS, SECURITY_CONSTANTS.DEFAULT_CORS_CREDENTIALS),
      cookieSecret: process.env.COOKIE_SECRET || 'truxe-cookie-secret-change-in-production',
      sessionSecret: process.env.SESSION_SECRET || 'truxe-session-secret-change-in-production',
    },

    // Password Policy Configuration
    password: {
      passwordMinLength: parseInteger(process.env.PASSWORD_MIN_LENGTH, 8),
      passwordMaxLength: parseInteger(process.env.PASSWORD_MAX_LENGTH, 128),
      passwordRequireUppercase: parseBoolean(process.env.PASSWORD_REQUIRE_UPPERCASE, true),
      passwordRequireLowercase: parseBoolean(process.env.PASSWORD_REQUIRE_LOWERCASE, true),
      passwordRequireNumber: parseBoolean(process.env.PASSWORD_REQUIRE_NUMBER, true),
      passwordRequireSpecial: parseBoolean(process.env.PASSWORD_REQUIRE_SPECIAL, true),
      passwordHistoryLimit: parseInteger(process.env.PASSWORD_HISTORY_LIMIT, 5),
    },
    
    // Session Configuration
    session: {
      maxConcurrent: parseInteger(process.env.MAX_CONCURRENT_SESSIONS, SECURITY_CONSTANTS.DEFAULT_MAX_CONCURRENT_SESSIONS),
      cleanupInterval: parseDuration(process.env.SESSION_CLEANUP_INTERVAL || SECURITY_CONSTANTS.DEFAULT_SESSION_CLEANUP_INTERVAL),
      extendOnUse: parseBoolean(process.env.SESSION_EXTEND_ON_USE, SECURITY_CONSTANTS.DEFAULT_SESSION_EXTEND_ON_USE),
      deviceTracking: parseBoolean(process.env.ENABLE_DEVICE_TRACKING, true),
      
      // Advanced Security Features
      anomalyDetection: parseBoolean(process.env.ENABLE_ANOMALY_DETECTION, true),
      impossibleTravelThreshold: parseInteger(process.env.IMPOSSIBLE_TRAVEL_THRESHOLD_KMH, SECURITY_CONSTANTS.DEFAULT_IMPOSSIBLE_TRAVEL_THRESHOLD),
      newDeviceNotification: parseBoolean(process.env.ENABLE_NEW_DEVICE_NOTIFICATION, SECURITY_CONSTANTS.DEFAULT_NEW_DEVICE_NOTIFICATION),
      jtiBlacklistTTL: parseDuration(process.env.JTI_BLACKLIST_TTL || SECURITY_CONSTANTS.DEFAULT_JTI_BLACKLIST_TTL),
      
      // Session Scoring (for priority-based eviction)
      scoringWeights: {
        age: parseInteger(process.env.SESSION_SCORING_AGE_WEIGHT, SECURITY_CONSTANTS.SESSION_SCORING_AGE_WEIGHT),
        inactivity: parseInteger(process.env.SESSION_SCORING_INACTIVITY_WEIGHT, SECURITY_CONSTANTS.SESSION_SCORING_INACTIVITY_WEIGHT),
        sameDevice: parseInteger(process.env.SESSION_SCORING_SAME_DEVICE_BONUS, SECURITY_CONSTANTS.SESSION_SCORING_SAME_DEVICE_BONUS),
        sameBrowser: parseInteger(process.env.SESSION_SCORING_SAME_BROWSER_BONUS, SECURITY_CONSTANTS.SESSION_SCORING_SAME_BROWSER_BONUS),
        sameOS: parseInteger(process.env.SESSION_SCORING_SAME_OS_BONUS, SECURITY_CONSTANTS.SESSION_SCORING_SAME_OS_BONUS),
        sameIP: parseInteger(process.env.SESSION_SCORING_SAME_IP_BONUS, SECURITY_CONSTANTS.SESSION_SCORING_SAME_IP_BONUS),
      },
    },
    
    // Refresh Token Rotation Configuration
    refreshToken: {
      rotationEnabled: parseBoolean(process.env.REFRESH_TOKEN_ROTATION_ENABLED, REFRESH_TOKEN_CONSTANTS.DEFAULT_ROTATION_ENABLED),
      concurrentProtection: parseBoolean(process.env.REFRESH_TOKEN_CONCURRENT_PROTECTION, REFRESH_TOKEN_CONSTANTS.DEFAULT_CONCURRENT_PROTECTION),
      familyTracking: parseBoolean(process.env.REFRESH_TOKEN_FAMILY_TRACKING, REFRESH_TOKEN_CONSTANTS.DEFAULT_FAMILY_TRACKING),
      gracePeriod: parseInteger(process.env.REFRESH_TOKEN_GRACE_PERIOD, REFRESH_TOKEN_CONSTANTS.DEFAULT_GRACE_PERIOD), // 5 minutes
      maxConcurrentRefreshes: parseInteger(process.env.REFRESH_TOKEN_MAX_CONCURRENT, REFRESH_TOKEN_CONSTANTS.DEFAULT_MAX_CONCURRENT),
      familySizeLimit: parseInteger(process.env.REFRESH_TOKEN_FAMILY_SIZE_LIMIT, REFRESH_TOKEN_CONSTANTS.DEFAULT_FAMILY_SIZE_LIMIT),
      rotationWindow: parseInteger(process.env.REFRESH_TOKEN_ROTATION_WINDOW, REFRESH_TOKEN_CONSTANTS.DEFAULT_ROTATION_WINDOW), // 1 second
    },
    
    // Threat Detection Configuration
    threatDetection: {
      bruteForce: {
        enabled: parseBoolean(process.env.THREAT_DETECTION_BRUTE_FORCE_ENABLED, true),
        maxAttempts: parseInteger(process.env.THREAT_DETECTION_BRUTE_FORCE_MAX_ATTEMPTS, THREAT_DETECTION_CONSTANTS.BRUTE_FORCE_MAX_ATTEMPTS),
        windowMinutes: parseInteger(process.env.THREAT_DETECTION_BRUTE_FORCE_WINDOW_MINUTES, THREAT_DETECTION_CONSTANTS.BRUTE_FORCE_WINDOW_MINUTES),
        lockoutDuration: parseInteger(process.env.THREAT_DETECTION_BRUTE_FORCE_LOCKOUT_DURATION, THREAT_DETECTION_CONSTANTS.BRUTE_FORCE_LOCKOUT_DURATION), // 15 minutes
        progressiveDelay: parseBoolean(process.env.THREAT_DETECTION_BRUTE_FORCE_PROGRESSIVE_DELAY, THREAT_DETECTION_CONSTANTS.BRUTE_FORCE_PROGRESSIVE_DELAY),
      },
      accountTakeover: {
        enabled: parseBoolean(process.env.THREAT_DETECTION_ACCOUNT_TAKEOVER_ENABLED, true),
        suspiciousLoginThreshold: parseInteger(process.env.THREAT_DETECTION_ACCOUNT_TAKEOVER_THRESHOLD, THREAT_DETECTION_CONSTANTS.ACCOUNT_TAKEOVER_THRESHOLD),
        timeWindowHours: parseInteger(process.env.THREAT_DETECTION_ACCOUNT_TAKEOVER_TIME_WINDOW, THREAT_DETECTION_CONSTANTS.ACCOUNT_TAKEOVER_TIME_WINDOW),
        geoDistanceThreshold: parseInteger(process.env.THREAT_DETECTION_ACCOUNT_TAKEOVER_GEO_DISTANCE, THREAT_DETECTION_CONSTANTS.ACCOUNT_TAKEOVER_GEO_DISTANCE), // km
        deviceChangeThreshold: parseInteger(process.env.THREAT_DETECTION_ACCOUNT_TAKEOVER_DEVICE_CHANGE, THREAT_DETECTION_CONSTANTS.ACCOUNT_TAKEOVER_DEVICE_CHANGE),
      },
      impossibleTravel: {
        enabled: parseBoolean(process.env.THREAT_DETECTION_IMPOSSIBLE_TRAVEL_ENABLED, true),
        maxSpeedKmh: parseInteger(process.env.THREAT_DETECTION_IMPOSSIBLE_TRAVEL_MAX_SPEED, THREAT_DETECTION_CONSTANTS.IMPOSSIBLE_TRAVEL_MAX_SPEED),
        minTimeBetweenLogins: parseInteger(process.env.THREAT_DETECTION_IMPOSSIBLE_TRAVEL_MIN_TIME, THREAT_DETECTION_CONSTANTS.IMPOSSIBLE_TRAVEL_MIN_TIME), // hours
      },
      suspiciousActivity: {
        enabled: parseBoolean(process.env.THREAT_DETECTION_SUSPICIOUS_ACTIVITY_ENABLED, true),
        rapidSessionCreation: parseInteger(process.env.THREAT_DETECTION_SUSPICIOUS_ACTIVITY_RAPID_SESSIONS, THREAT_DETECTION_CONSTANTS.SUSPICIOUS_ACTIVITY_RAPID_SESSIONS),
        timeWindowMinutes: parseInteger(process.env.THREAT_DETECTION_SUSPICIOUS_ACTIVITY_TIME_WINDOW, THREAT_DETECTION_CONSTANTS.SUSPICIOUS_ACTIVITY_TIME_WINDOW),
        unusualIPPatterns: parseBoolean(process.env.THREAT_DETECTION_SUSPICIOUS_ACTIVITY_UNUSUAL_IP, THREAT_DETECTION_CONSTANTS.SUSPICIOUS_ACTIVITY_UNUSUAL_IP),
        deviceFingerprintChanges: parseBoolean(process.env.THREAT_DETECTION_SUSPICIOUS_ACTIVITY_DEVICE_CHANGES, THREAT_DETECTION_CONSTANTS.SUSPICIOUS_ACTIVITY_DEVICE_CHANGES),
      },
      automatedResponse: {
        enabled: parseBoolean(process.env.THREAT_DETECTION_AUTOMATED_RESPONSE_ENABLED, true),
        autoBlockIPs: parseBoolean(process.env.THREAT_DETECTION_AUTOMATED_RESPONSE_AUTO_BLOCK_IPS, false),
        autoSuspendUsers: parseBoolean(process.env.THREAT_DETECTION_AUTOMATED_RESPONSE_AUTO_SUSPEND_USERS, false),
        notificationChannels: process.env.THREAT_DETECTION_AUTOMATED_RESPONSE_NOTIFICATION_CHANNELS 
          ? process.env.THREAT_DETECTION_AUTOMATED_RESPONSE_NOTIFICATION_CHANNELS.split(',')
          : ['log'],
        escalationThreshold: parseInteger(process.env.THREAT_DETECTION_AUTOMATED_RESPONSE_ESCALATION_THRESHOLD, 3),
      },
    },
    
    // Security Incident Response Configuration
    securityIncidentResponse: {
      enabled: parseBoolean(process.env.SECURITY_INCIDENT_RESPONSE_ENABLED, SECURITY_INCIDENT_RESPONSE_CONSTANTS.DEFAULT_ENABLED),
      autoClassification: parseBoolean(process.env.SECURITY_INCIDENT_RESPONSE_AUTO_CLASSIFICATION, SECURITY_INCIDENT_RESPONSE_CONSTANTS.DEFAULT_AUTO_CLASSIFICATION),
      notificationChannels: process.env.SECURITY_INCIDENT_RESPONSE_NOTIFICATION_CHANNELS 
        ? process.env.SECURITY_INCIDENT_RESPONSE_NOTIFICATION_CHANNELS.split(',')
        : SECURITY_INCIDENT_RESPONSE_CONSTANTS.DEFAULT_NOTIFICATION_CHANNELS,
      escalationLevels: [
        { level: 1, threshold: 3, response: 'log' },
        { level: 2, threshold: 5, response: 'notify' },
        { level: 3, threshold: 8, response: 'escalate' },
        { level: 4, threshold: 10, response: 'emergency' },
      ],
      responseTimeouts: {
        level1: parseInteger(process.env.SECURITY_INCIDENT_RESPONSE_TIMEOUT_LEVEL1, SECURITY_INCIDENT_RESPONSE_CONSTANTS.TIMEOUT_LEVEL1), // 5 minutes
        level2: parseInteger(process.env.SECURITY_INCIDENT_RESPONSE_TIMEOUT_LEVEL2, SECURITY_INCIDENT_RESPONSE_CONSTANTS.TIMEOUT_LEVEL2), // 10 minutes
        level3: parseInteger(process.env.SECURITY_INCIDENT_RESPONSE_TIMEOUT_LEVEL3, SECURITY_INCIDENT_RESPONSE_CONSTANTS.TIMEOUT_LEVEL3), // 30 minutes
        level4: parseInteger(process.env.SECURITY_INCIDENT_RESPONSE_TIMEOUT_LEVEL4, SECURITY_INCIDENT_RESPONSE_CONSTANTS.TIMEOUT_LEVEL4), // 1 hour
      },
      playbooks: {
        // Playbooks can be configured via environment variables
        // Format: SECURITY_INCIDENT_RESPONSE_PLAYBOOK_<TYPE>=<JSON>
      },
    },
    
    // Client Token Refresh Configuration
    clientTokenRefresh: {
      refreshThreshold: parseInteger(process.env.CLIENT_TOKEN_REFRESH_THRESHOLD, CLIENT_TOKEN_REFRESH_CONSTANTS.DEFAULT_REFRESH_THRESHOLD), // 5 minutes
      maxRetries: parseInteger(process.env.CLIENT_TOKEN_REFRESH_MAX_RETRIES, CLIENT_TOKEN_REFRESH_CONSTANTS.DEFAULT_MAX_RETRIES),
      retryDelay: parseInteger(process.env.CLIENT_TOKEN_REFRESH_RETRY_DELAY, CLIENT_TOKEN_REFRESH_CONSTANTS.DEFAULT_RETRY_DELAY), // 1 second
      maxRetryDelay: parseInteger(process.env.CLIENT_TOKEN_REFRESH_MAX_RETRY_DELAY, CLIENT_TOKEN_REFRESH_CONSTANTS.DEFAULT_MAX_RETRY_DELAY), // 30 seconds
      concurrentProtection: parseBoolean(process.env.CLIENT_TOKEN_REFRESH_CONCURRENT_PROTECTION, CLIENT_TOKEN_REFRESH_CONSTANTS.DEFAULT_CONCURRENT_PROTECTION),
      exponentialBackoff: parseBoolean(process.env.CLIENT_TOKEN_REFRESH_EXPONENTIAL_BACKOFF, CLIENT_TOKEN_REFRESH_CONSTANTS.DEFAULT_EXPONENTIAL_BACKOFF),
    },
    
    // Security Monitoring Configuration
    securityMonitoring: {
      metricsRetention: parseInteger(process.env.SECURITY_MONITORING_METRICS_RETENTION, MONITORING_CONSTANTS.DEFAULT_METRICS_RETENTION), // days
      alertThresholds: {
        highRiskIncidents: parseInteger(process.env.SECURITY_MONITORING_ALERT_HIGH_RISK_INCIDENTS, MONITORING_CONSTANTS.ALERT_HIGH_RISK_INCIDENTS),
        failedLogins: parseInteger(process.env.SECURITY_MONITORING_ALERT_FAILED_LOGINS, MONITORING_CONSTANTS.ALERT_FAILED_LOGINS),
        suspiciousActivities: parseInteger(process.env.SECURITY_MONITORING_ALERT_SUSPICIOUS_ACTIVITIES, MONITORING_CONSTANTS.ALERT_SUSPICIOUS_ACTIVITIES),
        tokenCompromises: parseInteger(process.env.SECURITY_MONITORING_ALERT_TOKEN_COMPROMISES, MONITORING_CONSTANTS.ALERT_TOKEN_COMPROMISES),
      },
      dashboardRefresh: parseInteger(process.env.SECURITY_MONITORING_DASHBOARD_REFRESH, MONITORING_CONSTANTS.DEFAULT_DASHBOARD_REFRESH), // 30 seconds
      realTimeAlerts: parseBoolean(process.env.SECURITY_MONITORING_REAL_TIME_ALERTS, MONITORING_CONSTANTS.DEFAULT_REAL_TIME_ALERTS),
    },
    
    // Feature Flags
    features: {
      signup: parseBoolean(process.env.ENABLE_SIGNUP, FEATURE_FLAGS_CONSTANTS.DEFAULT_SIGNUP),
      magicLinks: parseBoolean(process.env.ENABLE_MAGIC_LINKS, FEATURE_FLAGS_CONSTANTS.DEFAULT_MAGIC_LINKS),
      webhooks: parseBoolean(process.env.ENABLE_WEBHOOKS, FEATURE_FLAGS_CONSTANTS.DEFAULT_WEBHOOKS),
      auditLogs: parseBoolean(process.env.ENABLE_AUDIT_LOGS, FEATURE_FLAGS_CONSTANTS.DEFAULT_AUDIT_LOGS),
      swagger: parseBoolean(process.env.ENABLE_SWAGGER, process.env.NODE_ENV !== 'production' ? FEATURE_FLAGS_CONSTANTS.DEFAULT_SWAGGER : false),
      requestLogging: parseBoolean(process.env.ENABLE_REQUEST_LOGGING, FEATURE_FLAGS_CONSTANTS.DEFAULT_REQUEST_LOGGING),
      metrics: parseBoolean(process.env.ENABLE_METRICS, FEATURE_FLAGS_CONSTANTS.DEFAULT_METRICS),
      helmet: parseBoolean(process.env.ENABLE_HELMET, FEATURE_FLAGS_CONSTANTS.DEFAULT_HELMET),
      rateLimiting: parseBoolean(process.env.ENABLE_RATE_LIMITING, FEATURE_FLAGS_CONSTANTS.DEFAULT_RATE_LIMITING),
      oauth: parseBoolean(process.env.ENABLE_OAUTH, FEATURE_FLAGS_CONSTANTS.DEFAULT_OAUTH),
      // Background Jobs - BullMQ queue system (default: false for safe rollout)
      useBullMQQueues: parseBoolean(process.env.USE_BULLMQ_QUEUES, false),
    },
    
    // Webhook Configuration
    webhooks: {
      secret: process.env.WEBHOOK_SECRET,
      timeout: parseDuration(process.env.WEBHOOK_TIMEOUT || WEBHOOK_CONSTANTS.DEFAULT_TIMEOUT),
      retryAttempts: parseInteger(process.env.WEBHOOK_RETRY_ATTEMPTS, WEBHOOK_CONSTANTS.DEFAULT_RETRY_ATTEMPTS),
      retryDelay: parseDuration(process.env.WEBHOOK_RETRY_DELAY || WEBHOOK_CONSTANTS.DEFAULT_RETRY_DELAY),
    },
    
    // Monitoring and Alerting Configuration
    monitoring: {
      alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
      alertEmail: process.env.ALERT_EMAIL,
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      
      // Alert thresholds
      thresholds: {
        rateLimitViolationsPerMinute: parseInteger(process.env.ALERT_THRESHOLD_RATE_LIMIT_VIOLATIONS, 100),
        ddosAttacksPerHour: parseInteger(process.env.ALERT_THRESHOLD_DDOS_ATTACKS, 5),
        securityThreatsPerMinute: parseInteger(process.env.ALERT_THRESHOLD_SECURITY_THREATS, 50),
        errorRatePercent: parseInteger(process.env.ALERT_THRESHOLD_ERROR_RATE, 5),
        averageResponseTimeMs: parseInteger(process.env.ALERT_THRESHOLD_RESPONSE_TIME, 1000),
        blockedRequestsPerMinute: parseInteger(process.env.ALERT_THRESHOLD_BLOCKED_REQUESTS, 200),
      },
      
      // Metrics retention
      retention: {
        minuteData: parseDuration(process.env.METRICS_RETENTION_MINUTE || MONITORING_CONSTANTS.RETENTION_MINUTE),
        hourData: parseDuration(process.env.METRICS_RETENTION_HOUR || MONITORING_CONSTANTS.RETENTION_HOUR),
        dayData: parseDuration(process.env.METRICS_RETENTION_DAY || MONITORING_CONSTANTS.RETENTION_DAY),
      },
    },

    // Alert Notification Channels
    alertNotifications: {
      enabled: parseBoolean(process.env.ALERT_NOTIFICATIONS_ENABLED, ALERT_NOTIFICATION_CONSTANTS.DEFAULT_ENABLED),
      deduplicationWindowMs: parseDuration(process.env.ALERT_NOTIFICATIONS_DEDUP_WINDOW || ALERT_NOTIFICATION_CONSTANTS.DEFAULT_DEDUP_WINDOW),
      maxRetries: parseInteger(process.env.ALERT_NOTIFICATIONS_MAX_RETRIES, ALERT_NOTIFICATION_CONSTANTS.DEFAULT_MAX_RETRIES),
      retryDelayMs: parseDuration(process.env.ALERT_NOTIFICATIONS_RETRY_DELAY || ALERT_NOTIFICATION_CONSTANTS.DEFAULT_RETRY_DELAY),
      retryBackoffMs: parseDuration(process.env.ALERT_NOTIFICATIONS_RETRY_BACKOFF || ALERT_NOTIFICATION_CONSTANTS.DEFAULT_RETRY_BACKOFF),
      channels: {
        email: {
          enabled: parseBoolean(process.env.ALERT_EMAIL_ENABLED, ALERT_NOTIFICATION_CONSTANTS.DEFAULT_EMAIL_ENABLED),
          recipients: (() => {
            const configured = parseList(process.env.ALERT_EMAIL_RECIPIENTS)
            if (configured.length > 0) return configured
            return parseList(ALERT_NOTIFICATION_CONSTANTS.DEFAULT_EMAIL_RECIPIENTS)
          })(),
        },
        slack: {
          enabled: parseBoolean(process.env.ALERT_SLACK_ENABLED, ALERT_NOTIFICATION_CONSTANTS.DEFAULT_SLACK_ENABLED),
          webhookUrl: process.env.ALERT_SLACK_WEBHOOK_URL || null,
          channel: process.env.ALERT_SLACK_CHANNEL || ALERT_NOTIFICATION_CONSTANTS.DEFAULT_SLACK_CHANNEL,
        },
        pagerDuty: {
          enabled: parseBoolean(process.env.ALERT_PAGERDUTY_ENABLED, ALERT_NOTIFICATION_CONSTANTS.DEFAULT_PAGERDUTY_ENABLED),
          integrationKey: process.env.ALERT_PAGERDUTY_INTEGRATION_KEY || null,
          source: process.env.ALERT_PAGERDUTY_SOURCE || APP_CONSTANTS.NAME || 'Truxe API',
          service: process.env.ALERT_PAGERDUTY_SERVICE || 'alert-notifications',
        },
      },
    },
    
    // Admin Configuration
    admin: {
      token: process.env.ADMIN_TOKEN,
      allowedIPs: process.env.ADMIN_ALLOWED_IPS ? process.env.ADMIN_ALLOWED_IPS.split(',') : ADMIN_CONSTANTS.DEFAULT_ALLOWED_IPS,
      rateLimitBypass: parseBoolean(process.env.ADMIN_RATE_LIMIT_BYPASS, ADMIN_CONSTANTS.DEFAULT_RATE_LIMIT_BYPASS),
    },
  }
  
  return config
}

/**
 * Get environment-specific configuration
 */
function getEnvironmentConfig(environment) {
  const configs = {
    development: {
      database: {
        poolMin: 2,
        poolMax: 10,
      },
      features: {
        swagger: true,
        requestLogging: true,
        metrics: true,
        oauth: true,
      },
    },
    test: {
      app: {
        logLevel: 'silent',
      },
      database: {
        poolMin: 1,
        poolMax: 5,
      },
      features: {
        swagger: false,
        requestLogging: false,
        metrics: false,
        rateLimiting: false,
        oauth: true,
      },
    },
    production: {
      database: {
        poolMin: 10,
        poolMax: 100,
        ssl: true,
      },
      features: {
        swagger: false,
        requestLogging: true,
        metrics: true,
        helmet: true,
        rateLimiting: true,
        oauth: true,
      },
    },
  }
  
  return configs[environment] || {}
}

/**
 * Deep merge configuration objects
 */
function mergeConfig(base, override) {
  const result = { ...base }
  
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeConfig(result[key] || {}, value)
    } else {
      result[key] = value
    }
  }
  
  return result
}

// Load and export configuration
const baseConfig = loadConfig()
const environmentConfig = getEnvironmentConfig(baseConfig.app.environment)
const config = mergeConfig(baseConfig, environmentConfig)

// Validate final configuration
if (config.app.environment === 'production') {
  const productionChecks = [
    { name: 'COOKIE_SECRET', check: () => config.security.cookieSecret !== 'truxe-cookie-secret-change-in-production', required: true },
    { name: 'SESSION_SECRET', check: () => config.security.sessionSecret !== 'truxe-session-secret-change-in-production', required: true },
    { name: 'DATABASE_SSL', check: () => config.database.ssl === true, required: false }, // Optional for internal databases
    { name: 'HELMET', check: () => config.features.helmet === true, required: true },
    { name: 'RATE_LIMITING', check: () => config.features.rateLimiting === true, required: true },
    { name: 'ADMIN_TOKEN', check: () => !!config.admin.token, required: false }, // Optional for deployments without admin API
  ]

  const failedChecks = productionChecks.filter(item => item.required && !item.check())
  if (failedChecks.length > 0) {
    const failedNames = failedChecks.map(item => item.name).join(', ')
    console.error('Production configuration validation failed for:', failedNames)
    console.error('Details:')
    failedChecks.forEach(item => {
      console.error(`  - ${item.name}: Missing or invalid`)
    })
    throw new Error(`Production configuration validation failed. Missing required settings: ${failedNames}`)
  }

  // Warn about optional but recommended settings
  const warnings = productionChecks.filter(item => !item.required && !item.check())
  if (warnings.length > 0) {
    warnings.forEach(item => {
      console.warn(`WARNING: ${item.name} is not set. This is optional but recommended for production.`)
    })
  }

  // Warn about missing monitoring configuration
  if (!config.monitoring.alertWebhookUrl && !config.monitoring.slackWebhookUrl) {
    console.warn('WARNING: No alert webhooks configured. Monitoring alerts will only be logged.')
  }
}

export default config
export { parseDuration, parseBoolean, parseInteger, loadRSAKey }

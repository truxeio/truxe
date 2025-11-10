# Security Best Practices Guide

Comprehensive security guidelines for implementing and maintaining Truxe authentication in production environments.

## 🛡️ Overview

Truxe is built with security-first principles, but proper implementation and configuration are crucial for maintaining a secure authentication system. This guide covers essential security practices, configuration recommendations, and monitoring strategies.

---

## 🔐 Authentication Security

### 1. Magic Link Security

#### Token Generation
- **Entropy**: Use 256-bit cryptographically secure random tokens
- **Hashing**: Store tokens using Argon2id with high memory cost
- **Expiration**: Set short expiration times (15 minutes maximum)
- **Single Use**: Ensure tokens can only be used once

```javascript
// Secure token generation example
const crypto = require('crypto');
const argon2 = require('argon2');

// Generate token with 256-bit entropy
const token = crypto.randomBytes(32).toString('base64url');

// Hash for storage with Argon2id
const tokenHash = await argon2.hash(token, {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MB
  timeCost: 3,
  parallelism: 1,
});
```

#### Email Security
- **TLS Encryption**: Always use TLS for email transmission
- **Domain Verification**: Implement SPF, DKIM, and DMARC records
- **Rate Limiting**: Limit magic link requests (5 per minute per IP)
- **Content Security**: Avoid sensitive information in email content

### 2. JWT Token Security

#### Token Configuration
```bash
# Use strong algorithms
JWT_ALGORITHM=RS256  # Recommended over HS256

# Short-lived access tokens
JWT_ACCESS_TOKEN_TTL=15m

# Longer refresh tokens with rotation
JWT_REFRESH_TOKEN_TTL=30d
JWT_REFRESH_ROTATION=true
```

#### Key Management
```bash
# Generate strong RSA keys
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Store securely in environment variables
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
```

#### Token Claims
```typescript
// Secure token payload structure
interface TokenPayload {
  iss: string;           // Issuer (your domain)
  sub: string;           // Subject (user ID)
  aud: string;           // Audience (your application)
  exp: number;           // Expiration (15 minutes)
  iat: number;           // Issued at
  jti: string;           // JWT ID for revocation
  
  // Minimal user claims
  email: string;
  email_verified: boolean;
  org_id?: string;       // Current organization
  role?: string;         // Role in current org
  
  // Avoid sensitive data in tokens
  // permissions?: string[];  // Use database lookup instead
}
```

### 3. Session Management

#### Concurrent Session Limits
```bash
# Configure session limits by plan
MAX_CONCURRENT_SESSIONS_FREE=3
MAX_CONCURRENT_SESSIONS_STARTER=5
MAX_CONCURRENT_SESSIONS_PRO=10
MAX_CONCURRENT_SESSIONS_ENTERPRISE=-1  # Unlimited
```

#### Session Security
```typescript
// Secure session configuration
const sessionConfig = {
  // JTI-based revocation
  jtiBlacklist: {
    enabled: true,
    ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
    storage: 'redis'
  },
  
  // Device fingerprinting
  deviceTracking: {
    enabled: true,
    trackBrowser: true,
    trackOS: true,
    trackIP: true,
    privacyMode: 'partial' // Mask IP addresses
  },
  
  // Anomaly detection
  anomalyDetection: {
    impossibleTravel: {
      enabled: true,
      threshold: 500, // km/h
      alertThreshold: 300 // km/h
    },
    newDeviceAlert: true,
    suspiciousPatterns: true
  }
};
```

---

## 🚦 Rate Limiting & DDoS Protection

### 1. Multi-Layer Rate Limiting

#### Configuration
```bash
# Layer 1: IP-based protection
RATE_LIMIT_IP_GLOBAL=1000/1h
RATE_LIMIT_IP_BURST=100/1m

# Layer 2: Endpoint-specific limits
RATE_LIMIT_MAGIC_LINK_PER_IP=5/1m
RATE_LIMIT_MAGIC_LINK_PER_EMAIL=3/1h
RATE_LIMIT_VERIFY_PER_IP=10/1m

# Layer 3: User-based quotas
RATE_LIMIT_API_FREE=1000/1h
RATE_LIMIT_API_STARTER=10000/1h
RATE_LIMIT_API_PRO=100000/1h

# Layer 4: DDoS protection
RATE_LIMIT_DDOS_THRESHOLD=10000/1m
RATE_LIMIT_EMERGENCY_REDUCTION=0.5
```

#### Advanced Protection
```typescript
// DDoS protection configuration
const ddosProtection = {
  // Circuit breaker
  circuitBreaker: {
    failureThreshold: 5,
    timeout: 60000, // 1 minute
    halfOpenMaxRequests: 10
  },
  
  // Attack detection
  attackDetection: {
    suspiciousIPThreshold: 1000, // requests/minute
    globalSpikeThreshold: 10000, // requests/minute
    uniqueIPsThreshold: 500, // unique IPs/minute
    failedAuthThreshold: 50 // failed attempts/hour/IP
  },
  
  // Automated response
  autoResponse: {
    ipBlocking: true,
    emergencyLimits: true,
    alerting: true,
    circuitBreakerActivation: true
  }
};
```

### 2. IP Blocking & Allowlisting

```bash
# Trusted proxy configuration
TRUSTED_PROXIES=1  # Number of trusted proxies
PROXY_HEADER=X-Forwarded-For

# IP allowlist for admin endpoints
ADMIN_IP_ALLOWLIST=192.168.1.0/24,10.0.0.0/8

# Automatic IP blocking
AUTO_IP_BLOCKING=true
IP_BLOCK_DURATION=3600  # 1 hour
IP_BLOCK_THRESHOLD=100  # violations
```

---

## 🗄️ Database Security

### 1. Row Level Security (RLS)

#### Enable RLS on All Tables
```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policy
CREATE POLICY tenant_isolation ON organizations
FOR ALL TO authenticated
USING (
  id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
  )
);
```

#### Connection Security
```bash
# Use SSL connections in production
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# Connection pooling
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_POOL_IDLE_TIMEOUT=10000

# Query timeout
DATABASE_QUERY_TIMEOUT=30000
```

### 2. Data Encryption

#### At Rest
```bash
# Database encryption
POSTGRES_ENCRYPTION=on
POSTGRES_SSL_CERT=/path/to/cert.pem
POSTGRES_SSL_KEY=/path/to/key.pem

# Backup encryption
BACKUP_ENCRYPTION_KEY=your-32-byte-key
BACKUP_COMPRESSION=true
```

#### In Transit
```bash
# Force HTTPS
FORCE_HTTPS=true
HSTS_MAX_AGE=31536000
HSTS_INCLUDE_SUBDOMAINS=true

# TLS configuration
TLS_MIN_VERSION=1.2
TLS_CIPHERS=ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384
```

---

## 🔍 Security Monitoring

### 1. Audit Logging

#### Comprehensive Event Tracking
```typescript
// Security events to log
const securityEvents = [
  // Authentication events
  'user.login.success',
  'user.login.failed',
  'user.logout',
  'token.refresh',
  'token.revoked',
  
  // Session events
  'session.created',
  'session.expired',
  'session.revoked',
  'session.limit_exceeded',
  
  // Security violations
  'security.impossible_travel',
  'security.new_device',
  'security.suspicious_activity',
  'security.rate_limit_exceeded',
  'security.ddos_detected',
  
  // Administrative events
  'admin.session_revoked',
  'admin.ip_blocked',
  'admin.config_changed'
];
```

#### Structured Logging Format
```typescript
// Security event structure
interface SecurityEvent {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  category: 'auth' | 'session' | 'security' | 'admin';
  action: string;
  
  // Context
  userId?: string;
  orgId?: string;
  sessionId?: string;
  requestId: string;
  
  // Network info
  ip: string;
  userAgent: string;
  
  // Event details
  details: Record<string, any>;
  
  // Risk assessment
  riskScore?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

### 2. Real-Time Monitoring

#### Key Security Metrics
```typescript
// Metrics to monitor
const securityMetrics = {
  // Authentication metrics
  authSuccessRate: 'percentage',
  authFailureRate: 'percentage',
  magicLinkClickRate: 'percentage',
  
  // Session metrics
  activeSessionCount: 'gauge',
  sessionCreationRate: 'counter',
  sessionRevocationRate: 'counter',
  
  // Security metrics
  impossibleTravelDetections: 'counter',
  newDeviceLogins: 'counter',
  suspiciousActivityCount: 'counter',
  
  // Rate limiting metrics
  rateLimitViolations: 'counter',
  blockedRequests: 'counter',
  ddosAttacks: 'counter',
  
  // Performance metrics
  responseTime: 'histogram',
  errorRate: 'percentage',
  throughput: 'gauge'
};
```

#### Alerting Configuration
```bash
# Alert thresholds
ALERT_AUTH_FAILURE_RATE=10  # percent
ALERT_IMPOSSIBLE_TRAVEL=1   # count
ALERT_DDOS_THRESHOLD=5      # attacks/hour
ALERT_ERROR_RATE=5          # percent
ALERT_RESPONSE_TIME=1000    # milliseconds

# Alert channels
ALERT_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_EMAIL=security@yourcompany.com
ALERT_PAGERDUTY_KEY=your-pagerduty-key
```

---

## 🌐 Network Security

### 1. HTTPS Configuration

#### SSL/TLS Setup
```bash
# Certificate configuration
SSL_CERT_PATH=/etc/ssl/certs/yourapp.crt
SSL_KEY_PATH=/etc/ssl/private/yourapp.key
SSL_CA_PATH=/etc/ssl/certs/ca-bundle.crt

# Security headers
HSTS_ENABLED=true
HSTS_MAX_AGE=31536000
HSTS_INCLUDE_SUBDOMAINS=true
HSTS_PRELOAD=true
```

#### Security Headers
```typescript
// Security headers configuration
const securityHeaders = {
  // HTTPS enforcement
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // XSS protection
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.truxe.io",
    "font-src 'self' https://fonts.googleapis.com",
    "frame-ancestors 'none'",
    "base-uri 'self'"
  ].join('; '),
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy
  'Permissions-Policy': [
    'geolocation=()',
    'microphone=()',
    'camera=()'
  ].join(', ')
};
```

### 2. CORS Configuration

```bash
# CORS settings
CORS_ORIGIN=https://yourapp.com,https://admin.yourapp.com
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_HEADERS=Authorization,Content-Type,X-Requested-With
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400  # 24 hours
```

---

## 🚀 Deployment Security

### 1. Environment Security

#### Secrets Management
```bash
# Use environment variables for secrets
export JWT_PRIVATE_KEY="$(cat /secure/path/jwt-private.pem)"
export DATABASE_PASSWORD="$(vault kv get -field=password secret/db)"
export EMAIL_API_KEY="$(aws ssm get-parameter --name /truxe/email-key --with-decryption --query Parameter.Value --output text)"

# Avoid hardcoded secrets
# ❌ Wrong
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII..."

# ✅ Correct
JWT_PRIVATE_KEY_PATH="/secure/path/jwt-private.pem"
```

#### Container Security
```dockerfile
# Use non-root user
FROM node:20-alpine
RUN addgroup -g 1001 -S nodejs
RUN adduser -S truxe -u 1001
USER truxe

# Minimal attack surface
RUN apk del --purge curl wget
RUN rm -rf /var/cache/apk/*

# Read-only filesystem
COPY --chown=truxe:nodejs . .
USER truxe
```

### 2. Infrastructure Security

#### Kubernetes Security
```yaml
# Security context
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 2000
      containers:
      - name: truxe
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
```

#### Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: truxe-network-policy
spec:
  podSelector:
    matchLabels:
      app: truxe
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx-ingress
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432
```

---

## 🔧 Configuration Hardening

### 1. Production Configuration

```bash
# Core security settings
NODE_ENV=production
LOG_LEVEL=warn
DEBUG=false

# Session security
SESSION_SECURE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=strict
SESSION_MAX_AGE=900000  # 15 minutes

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false
RATE_LIMIT_SKIP_FAILED_REQUESTS=false

# Security features
ENABLE_CSRF_PROTECTION=true
ENABLE_HELMET=true
ENABLE_COMPRESSION=true
TRUST_PROXY=true
```

### 2. Security Checklist

#### Pre-Deployment
- [ ] JWT keys generated with sufficient entropy
- [ ] Database RLS policies enabled and tested
- [ ] Rate limiting configured and tested
- [ ] HTTPS enforced with valid certificates
- [ ] Security headers configured
- [ ] CORS properly restricted
- [ ] Secrets stored securely (not in code)
- [ ] Container runs as non-root user
- [ ] Network policies implemented
- [ ] Monitoring and alerting configured

#### Post-Deployment
- [ ] Security scan completed
- [ ] Penetration testing performed
- [ ] Vulnerability assessment conducted
- [ ] Backup and recovery tested
- [ ] Incident response plan documented
- [ ] Security monitoring validated
- [ ] Compliance requirements verified
- [ ] Team security training completed

---

## 🚨 Incident Response

### 1. Security Incident Types

#### Critical Incidents
- **Data Breach**: Unauthorized access to user data
- **Account Takeover**: Compromised user accounts
- **System Compromise**: Server or infrastructure breach
- **DDoS Attack**: Service disruption attacks

#### Response Procedures
```typescript
// Incident response workflow
const incidentResponse = {
  detection: {
    automated: ['monitoring', 'alerting', 'anomaly_detection'],
    manual: ['user_reports', 'security_audit', 'log_analysis']
  },
  
  response: {
    immediate: [
      'isolate_affected_systems',
      'revoke_compromised_sessions',
      'block_malicious_ips',
      'notify_security_team'
    ],
    investigation: [
      'collect_evidence',
      'analyze_logs',
      'identify_root_cause',
      'assess_impact'
    ],
    remediation: [
      'patch_vulnerabilities',
      'update_security_policies',
      'restore_services',
      'notify_affected_users'
    ]
  },
  
  recovery: {
    validation: ['security_testing', 'monitoring_enhancement'],
    documentation: ['incident_report', 'lessons_learned'],
    improvement: ['policy_updates', 'training_updates']
  }
};
```

### 2. Emergency Procedures

#### Session Revocation
```bash
# Revoke all sessions for a user
curl -X POST https://auth.yourapp.com/admin/security/revoke-user \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"userId": "user-uuid", "reason": "security_incident"}'

# Revoke sessions by IP
curl -X POST https://auth.yourapp.com/admin/security/revoke-ip \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"ip": "1.2.3.4", "reason": "suspicious_activity"}'
```

#### Emergency Rate Limiting
```bash
# Activate emergency rate limits
curl -X POST https://auth.yourapp.com/admin/ddos/activate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reductionFactor": 0.1, "duration": 3600}'

# Block IP address
curl -X POST https://auth.yourapp.com/admin/security/block-ip \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"ip": "1.2.3.4", "duration": 3600, "reason": "attack"}'
```

---

## 📋 Compliance & Auditing

### 1. Regulatory Compliance

#### GDPR Compliance
```typescript
// GDPR-compliant data handling
const gdprCompliance = {
  dataMinimization: {
    collectOnlyNecessary: true,
    retentionPolicies: {
      auditLogs: '7 years',
      sessionData: '30 days',
      userMetadata: 'until account deletion'
    }
  },
  
  userRights: {
    dataAccess: '/api/user/data-export',
    dataPortability: '/api/user/data-download',
    dataDeletion: '/api/user/delete-account',
    dataRectification: '/api/user/update-profile'
  },
  
  consent: {
    explicit: true,
    withdrawable: true,
    granular: true,
    documented: true
  }
};
```

#### SOC 2 Compliance
- **Security**: Access controls, encryption, monitoring
- **Availability**: Uptime monitoring, disaster recovery
- **Processing Integrity**: Data validation, error handling
- **Confidentiality**: Data classification, access restrictions
- **Privacy**: Data handling, user consent, retention

### 2. Audit Trail Requirements

```typescript
// Audit log structure
interface AuditLog {
  id: string;
  timestamp: string;
  actor: {
    type: 'user' | 'system' | 'admin';
    id: string;
    ip: string;
    userAgent: string;
  };
  action: string;
  target: {
    type: string;
    id: string;
  };
  result: 'success' | 'failure';
  details: Record<string, any>;
  
  // Compliance fields
  retentionDate: string;
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  integrity: {
    hash: string;
    signature: string;
  };
}
```

---

## 🎯 Security Testing

### 1. Automated Security Testing

```bash
# Security scanning
npm audit --audit-level=moderate
snyk test
docker scan truxe:latest

# SAST (Static Application Security Testing)
semgrep --config=auto src/
sonarqube-scanner

# DAST (Dynamic Application Security Testing)
zap-baseline.py -t http://localhost:3001
```

### 2. Manual Security Testing

#### Authentication Testing
- [ ] Test magic link expiration
- [ ] Verify token revocation
- [ ] Test session limits
- [ ] Validate rate limiting
- [ ] Test impossible travel detection

#### Authorization Testing
- [ ] Test role-based access
- [ ] Verify tenant isolation
- [ ] Test privilege escalation
- [ ] Validate permission checks

#### Input Validation Testing
- [ ] SQL injection attempts
- [ ] XSS payload testing
- [ ] Command injection testing
- [ ] Path traversal testing

---

## 📚 Additional Resources

### Security Tools
- **[OWASP ZAP](https://owasp.org/www-project-zap/)** - Web application security scanner
- **[Burp Suite](https://portswigger.net/burp)** - Web vulnerability scanner
- **[Snyk](https://snyk.io/)** - Dependency vulnerability scanning
- **[SonarQube](https://sonarqube.org/)** - Code quality and security analysis

### Security Standards
- **[OWASP Top 10](https://owasp.org/www-project-top-ten/)** - Most critical web application risks
- **[NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)** - Cybersecurity best practices
- **[ISO 27001](https://www.iso.org/isoiec-27001-information-security.html)** - Information security management
- **[CIS Controls](https://www.cisecurity.org/controls/)** - Cybersecurity best practices

### Documentation
- **[Security Design](../02-technical/security-design.md)** - Technical security architecture
- **[Troubleshooting](./troubleshooting.md)** - Security issue resolution
- **[API Reference](./api-reference.md)** - Secure API usage examples

---

**Remember**: Security is an ongoing process, not a one-time setup. Regularly review and update your security practices based on emerging threats and best practices.

**Questions?** Join our [Discord security channel](https://discord.gg/truxe) or contact our security team at security@truxe.io.

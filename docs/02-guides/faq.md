# Frequently Asked Questions (FAQ)

Comprehensive answers to common questions about Truxe authentication platform, covering setup, security, troubleshooting, and best practices.

## 🚀 Getting Started

### What is Truxe?

Truxe is an open-source, developer-first authentication platform that provides passwordless authentication, multi-tenant support, and enterprise-grade security features. It's designed to be as easy as Clerk, as open as Supabase, and as powerful as Auth0.

### How is Truxe different from other auth providers?

| Feature | Truxe | Clerk | Auth0 | Supabase Auth |
|---------|----------|--------|--------|---------------|
| **Open Source** | ✅ MIT License | ❌ Proprietary | ❌ Proprietary | ✅ Apache 2.0 |
| **Self-Hostable** | ✅ Full control | ❌ SaaS only | ❌ SaaS only | ✅ Limited |
| **Passwordless First** | ✅ Magic links | ✅ Yes | ⚠️ Add-on | ⚠️ Basic |
| **Multi-tenancy** | ✅ Built-in | ✅ Organizations | ✅ Yes | ❌ Manual |
| **Rate Limiting** | ✅ Advanced | ⚠️ Basic | ✅ Yes | ❌ None |
| **Session Security** | ✅ JTI revocation | ⚠️ Basic | ✅ Yes | ⚠️ Basic |
| **Developer CLI** | ✅ Full-featured | ⚠️ Limited | ❌ None | ⚠️ Basic |
| **Pricing** | ✅ Free forever | 💰 $25/month | 💰 $23/month | ✅ Free tier |

### Can I migrate from Clerk/Auth0?

Yes! Truxe provides automated migration tools:

```bash
# Migrate from Clerk
truxe migrate --from=clerk --data=./clerk-export.json

# Migrate from Auth0
truxe migrate --from=auth0 --config=./auth0-config.json
```

See our [migration guides](./migration-from-clerk.md) for detailed instructions.

### What frameworks does Truxe support?

- ✅ **Next.js** (App Router & Pages Router)
- ✅ **Nuxt 3** (SSR & SPA)
- ✅ **SvelteKit** (Full-stack)
- ✅ **Express.js** (API protection)
- ✅ **Fastify** (High performance)
- 🔄 **React Native** (Coming soon)
- 🔄 **Flutter** (Planned)

---

## 🔐 Authentication & Security

### How secure is passwordless authentication?

Passwordless authentication with magic links is more secure than traditional passwords because:

- **No password breaches**: Nothing to steal from databases
- **Cryptographically secure tokens**: 256-bit entropy (2²⁵⁶ possible combinations)
- **Short expiration**: 15-minute default expiration
- **Single use**: Tokens can only be used once
- **Email security**: Relies on email provider security (often 2FA protected)

### How does token revocation work?

Truxe uses JTI (JWT ID) based revocation:

```typescript
// Immediate token revocation
await truxe.revokeSession(sessionId, 'user_logout');

// Check if token is revoked
const isRevoked = await truxe.isTokenRevoked(jti);
```

Revoked tokens are immediately invalid across all services, unlike traditional JWT where tokens remain valid until expiration.

### What happens if someone gets access to my email?

If an attacker gains email access:

1. **Magic links expire quickly** (15 minutes)
2. **Device fingerprinting** detects new devices
3. **Impossible travel detection** flags suspicious locations
4. **Session limits** prevent unlimited access
5. **Audit logging** tracks all access attempts

Additional protection:
- Enable email 2FA
- Use email providers with security monitoring
- Monitor Truxe's security dashboard

### How does multi-tenancy work?

Truxe implements true multi-tenancy with:

- **Row Level Security (RLS)** for database isolation
- **Organization-scoped sessions** 
- **Role-based access control (RBAC)**
- **Tenant-specific rate limiting**

```typescript
// Switch organization context
await truxe.switchOrganization('acme-corp');

// Check user's role in current org
const role = await truxe.getCurrentRole(); // 'admin', 'member', etc.
```

### What's the difference between access and refresh tokens?

| Token Type | Duration | Purpose | Storage |
|------------|----------|---------|---------|
| **Access Token** | 15 minutes | API requests | Memory/localStorage |
| **Refresh Token** | 30 days | Token renewal | HTTP-only cookie |

Access tokens are short-lived for security, while refresh tokens enable seamless user experience.

---

## 🛠️ Technical Questions

### What database does Truxe use?

Truxe uses **PostgreSQL 15+** with:
- **Row Level Security (RLS)** for multi-tenant isolation
- **UUID primary keys** for security
- **JSONB columns** for flexible metadata
- **Comprehensive indexes** for performance

For development, SQLite is supported but not recommended for production.

### Can I use my existing database?

Yes, but with considerations:
- Truxe needs specific tables and RLS policies
- Migration tools help integrate with existing schemas
- Custom user metadata can be synced

```bash
# Migrate existing users
truxe migrate users --from=existing_table --mapping=email:user_email
```

### How does rate limiting work?

Truxe implements **multi-layer rate limiting**:

1. **IP-based limits** (global protection)
2. **User-based quotas** (plan enforcement) 
3. **Endpoint-specific limits** (targeted protection)
4. **DDoS protection** (emergency limits)

```bash
# Current rate limits
POST /auth/magic-link: 5/minute per IP, 3/hour per email
GET /auth/verify: 10/minute per IP
POST /auth/refresh: 60/hour per user
```

### Can I customize the email templates?

Yes, email templates are fully customizable:

```typescript
// Custom email template
const emailConfig = {
  template: 'custom-magic-link',
  variables: {
    companyName: 'Your Company',
    logoUrl: 'https://yourapp.com/logo.png',
    brandColor: '#007bff'
  }
};

await truxe.sendMagicLink(email, emailConfig);
```

### How do I handle CORS in production?

Configure CORS for your domains:

```bash
# Environment variables
CORS_ORIGIN=https://yourapp.com,https://admin.yourapp.com
CORS_CREDENTIALS=true
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
```

For multiple subdomains:
```bash
CORS_ORIGIN=https://*.yourapp.com
```

---

## 🚀 Deployment & Operations

### What are the hosting requirements?

**Minimum requirements:**
- **CPU**: 1 vCPU
- **RAM**: 512MB
- **Storage**: 10GB SSD
- **Network**: 100 Mbps

**Recommended production:**
- **CPU**: 2+ vCPU
- **RAM**: 2GB+
- **Storage**: 50GB+ SSD
- **Database**: Managed PostgreSQL
- **Cache**: Managed Redis
- **Load balancer**: For high availability

### Which cloud providers are supported?

Truxe runs on any cloud provider:

- ✅ **AWS** (EC2, ECS, Lambda)
- ✅ **Google Cloud** (GCE, Cloud Run, GKE)
- ✅ **Azure** (VM, Container Instances, AKS)
- ✅ **DigitalOcean** (Droplets, App Platform)
- ✅ **Railway** (One-click deploy)
- ✅ **Fly.io** (Edge deployment)
- ✅ **Vercel** (Serverless functions)

### How do I monitor Truxe in production?

Built-in monitoring endpoints:

```bash
# Health check
curl https://auth.yourapp.com/health

# Metrics
curl https://auth.yourapp.com/metrics

# Security dashboard
curl https://auth.yourapp.com/security/dashboard
```

Integration with monitoring tools:
- **Prometheus** metrics
- **Grafana** dashboards
- **DataDog** integration
- **New Relic** APM
- **Sentry** error tracking

### How do I backup and restore?

**Database backup:**
```bash
# Automated daily backups
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup-20240115.sql
```

**Configuration backup:**
```bash
# Export configuration
truxe config export > truxe-config.json

# Import configuration
truxe config import truxe-config.json
```

### What's the disaster recovery process?

1. **Database recovery** from latest backup
2. **Redis cache warming** (automatic)
3. **JWT key restoration** from secure storage
4. **Configuration reload** from backup
5. **Health check validation**

Recovery time objective (RTO): < 15 minutes
Recovery point objective (RPO): < 1 hour

---

## 💰 Pricing & Licensing

### Is Truxe really free?

Yes! The core features are **MIT licensed** and free forever:
- ✅ Unlimited users (self-hosted)
- ✅ Magic link authentication
- ✅ Basic multi-tenancy
- ✅ JWT token management
- ✅ Rate limiting
- ✅ Community support

### What's included in paid plans?

| Feature | Open Source | Cloud Pro | Enterprise |
|---------|-------------|-----------|------------|
| **Core Auth** | ✅ Free | ✅ Included | ✅ Included |
| **Multi-tenancy** | ✅ Basic | ✅ Advanced | ✅ Full |
| **Rate Limiting** | ✅ Basic | ✅ Advanced | ✅ Custom |
| **Webhooks** | ❌ | ✅ Yes | ✅ Yes |
| **Analytics** | ❌ | ✅ Yes | ✅ Advanced |
| **White-label** | ❌ | ✅ Yes | ✅ Yes |
| **SSO/SAML** | ❌ | ❌ | ✅ Yes |
| **Support** | Community | Email | 24/7 |
| **SLA** | None | 99.9% | 99.99% |

### Can I use Truxe commercially?

Yes! The MIT license allows commercial use:
- ✅ Use in commercial applications
- ✅ Modify the source code
- ✅ Distribute modified versions
- ✅ Sell applications using Truxe
- ✅ No attribution required (but appreciated)

### How does self-hosted licensing work?

- **Open source features**: Always free
- **Pro features**: Require license key
- **Enterprise features**: Custom licensing

```bash
# Activate pro license
truxe license activate your-license-key

# Check license status
truxe license status
```

---

## 🔧 Development & Integration

### How long does integration take?

**Typical integration times:**
- **New project**: 5-10 minutes
- **Existing Next.js**: 15-30 minutes  
- **Existing complex app**: 1-4 hours
- **Migration from Clerk**: 2-8 hours
- **Enterprise integration**: 1-5 days

### Do you provide SDKs?

Yes, official SDKs for:
- ✅ **JavaScript/TypeScript** (`@truxe/sdk`)
- ✅ **React** (`@truxe/react`)
- ✅ **Next.js** (`@truxe/nextjs`)
- ✅ **Vue** (`@truxe/vue`)
- ✅ **Nuxt** (`@truxe/nuxt`)
- ✅ **Svelte** (`@truxe/svelte`)
- ✅ **Node.js** (`@truxe/node`)

### Can I customize the authentication flow?

Absolutely! Truxe is highly customizable:

```typescript
// Custom authentication flow
const customFlow = {
  // Custom magic link generation
  generateToken: async (email) => {
    return await customTokenGenerator(email);
  },
  
  // Custom email sending
  sendEmail: async (email, token) => {
    return await customEmailService.send(email, token);
  },
  
  // Custom verification
  verifyToken: async (token) => {
    return await customVerification(token);
  }
};

truxe.configure({ customFlow });
```

### How do I test authentication flows?

Built-in testing utilities:

```typescript
import { createTestUser, mockMagicLink } from '@truxe/testing';

describe('Auth Flow', () => {
  it('should authenticate user', async () => {
    const user = await createTestUser({ email: 'test@example.com' });
    const token = await mockMagicLink(user.email);
    
    const result = await verifyMagicLink(token);
    expect(result.user.email).toBe('test@example.com');
  });
});
```

### Can I extend Truxe with plugins?

Yes, plugin system supports:

```typescript
// Custom plugin
const customPlugin = {
  name: 'custom-auth',
  hooks: {
    beforeLogin: async (email) => {
      // Custom logic before login
    },
    afterLogin: async (user) => {
      // Custom logic after login
    }
  }
};

truxe.use(customPlugin);
```

---

## 🌐 Scaling & Performance

### How many users can Truxe handle?

**Performance benchmarks:**
- **Magic link requests**: 1,000/minute
- **Token verifications**: 10,000/minute
- **Concurrent users**: 100,000+
- **Database operations**: 50,000/minute

**Scaling strategies:**
- **Horizontal scaling**: Multiple API instances
- **Database scaling**: Read replicas, connection pooling
- **Redis clustering**: For high-throughput rate limiting
- **CDN integration**: For static assets and JWKS

### What's the recommended architecture for high-traffic?

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Load Balancer│    │    CDN      │    │  Monitoring │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
│ Truxe API│    │ Truxe API│    │   Grafana   │
│ (Instance 1)│    │ (Instance 2)│    │  Dashboard  │
└──────┬──────┘    └──────┬──────┘    └─────────────┘
       │                  │
       └─────────┬────────┘
                 │
┌────────────────▼────────────────┐
│         PostgreSQL              │
│    (Primary + Read Replicas)    │
└─────────────────────────────────┘
```

### How do I optimize performance?

**Database optimization:**
```sql
-- Essential indexes
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_sessions_user_id ON sessions(user_id);
CREATE INDEX CONCURRENTLY idx_sessions_expires_at ON sessions(expires_at);
```

**Redis optimization:**
```bash
# Memory optimization
REDIS_MAXMEMORY=256mb
REDIS_MAXMEMORY_POLICY=allkeys-lru

# Connection pooling
REDIS_POOL_SIZE=10
REDIS_POOL_MAX=20
```

**Application optimization:**
```bash
# Node.js optimization
NODE_ENV=production
UV_THREADPOOL_SIZE=16

# Connection pooling
DATABASE_POOL_SIZE=20
DATABASE_POOL_MAX=50
```

---

## 🆘 Support & Troubleshooting

### Where can I get help?

**Community Support:**
- 💬 **[Discord](https://discord.gg/truxe)** - Real-time help
- 🐛 **[GitHub Issues](https://github.com/truxe-auth/truxe/issues)** - Bug reports
- 📚 **[Documentation](https://docs.truxe.io)** - Comprehensive guides
- 💡 **[Discussions](https://github.com/truxe-auth/truxe/discussions)** - Q&A

**Professional Support:**
- 📧 **Email**: support@truxe.io
- 🎯 **Priority Support**: Pro/Enterprise customers
- 🚨 **Emergency Support**: 24/7 for Enterprise

### What information should I include in bug reports?

**Essential information:**
```bash
# System information
truxe --version
node --version
npm --version

# Configuration (sanitized)
truxe config get --safe

# Logs
truxe logs --level=error --tail=50

# Health status
truxe status --check-all
```

**For authentication issues:**
- Steps to reproduce
- Error messages
- Browser/device information
- Network configuration

### How do I enable debug logging?

```bash
# Enable debug mode
DEBUG=truxe:* npm start

# Specific modules
DEBUG=truxe:auth,truxe:session npm start

# In production (use sparingly)
LOG_LEVEL=debug
```

### Common issues and solutions

**Magic links not working:**
1. Check email service configuration
2. Verify DNS records (SPF, DKIM)
3. Test rate limiting status
4. Check token expiration settings

**JWT verification failures:**
1. Verify JWT keys are properly configured
2. Check algorithm consistency (RS256)
3. Validate issuer/audience claims
4. Ensure system time is synchronized

**Database connection issues:**
1. Test connection string format
2. Check SSL configuration
3. Verify firewall rules
4. Monitor connection pool status

---

## 🔮 Roadmap & Future Features

### What's coming next?

**Q2 2024:**
- 🔐 **TOTP/MFA support**
- 🌐 **OAuth providers** (Google, GitHub, Microsoft)
- 📱 **React Native SDK**
- 🔗 **Webhook enhancements**

**Q3 2024:**
- 🎯 **WebAuthn/Passkeys**
- 📊 **Advanced analytics**
- 🏢 **SAML/SCIM support**
- 🤖 **AI-powered fraud detection**

**Q4 2024:**
- 📱 **Mobile SDKs** (iOS, Android)
- 🔄 **Real-time sync**
- 🌍 **Global edge deployment**
- 🎨 **No-code dashboard**

### How can I influence the roadmap?

- 🗳️ **Vote on features** in GitHub Discussions
- 💡 **Submit feature requests** with use cases
- 🤝 **Join beta programs** for early access
- 💰 **Enterprise customers** get priority input

### Can I contribute to Truxe?

Absolutely! We welcome contributions:

- 🐛 **Bug fixes** and improvements
- ✨ **New features** and enhancements
- 📚 **Documentation** updates
- 🧪 **Tests** and quality improvements
- 🌐 **Translations** and localization

See our [Contributing Guide](https://github.com/truxe-auth/truxe/blob/main/CONTRIBUTING.md) for details.

---

## 📞 Still Have Questions?

### Quick Links
- **[Getting Started](./quickstart.md)** - 5-minute setup guide
- **[API Reference](./api-reference.md)** - Complete API documentation
- **[Security Guide](./security-best-practices.md)** - Security best practices
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

### Community
- **[Discord Community](https://discord.gg/truxe)** - Join 1,000+ developers
- **[GitHub Repository](https://github.com/truxe-auth/truxe)** - Source code and issues
- **[Twitter](https://twitter.com/truxe_auth)** - Updates and announcements
- **[Newsletter](https://truxe.io/newsletter)** - Monthly updates

### Professional Support
- **Email**: support@truxe.io
- **Sales**: sales@truxe.io
- **Enterprise**: enterprise@truxe.io

---

**Can't find your answer?** Ask in our [Discord community](https://discord.gg/truxe) or [create a GitHub discussion](https://github.com/truxe-auth/truxe/discussions/new) - we're here to help! 🚀

<div align="center">

# Truxe

**Open-source authentication that just works**

[![License: BSL](https://img.shields.io/badge/license-BSL%201.1-blue.svg)](LICENSE-BSL)
[![GitHub Stars](https://img.shields.io/github/stars/truxeio/truxe?style=social)](https://github.com/truxeio/truxe)

[**Get Started**](#quick-start) • [**Documentation**](docs/) • [**Examples**](docs/03-integration-guides/examples/)

</div>

---

## What is Truxe?

Truxe is an **open-source authentication platform** that gives you complete control. Add login, OAuth, MFA, and RBAC to any app in minutes—self-hosted or fully managed.

### Why Truxe?

- **Production-ready in 5 minutes** - Drop-in React components + RESTful APIs
- **Everything you need, nothing you don't** - OAuth 2.0, OIDC, MFA, magic links, RBAC, webhooks
- **Self-host or use our cloud** - You own your data, or we handle it for you
- **Fair licensing** - BSL 1.1 → MIT after 2 years. No bait-and-switch.

---

## Quick Start

### Using the CLI (Recommended)

The fastest way to get started with Truxe:

```bash
# Install CLI globally
npm install -g @truxe/cli

# Create a new project
truxe init my-app --template=nextjs

# Navigate to project
cd my-app

# Generate JWT keys
truxe keys generate

# Start development server
truxe dev
```

Your authentication server will be running at `http://localhost:3001` and your app at `http://localhost:3000`.

**[→ Full CLI Documentation](cli/README.md)** • **[→ Quick Start Guide](docs/02-guides/quickstart.md)**

### Self-Hosted (Docker)

```bash
# Clone the repo
git clone https://github.com/truxeio/truxe.git
cd truxe

# Copy environment variables
cp deployment/.env.production.example deployment/.env.production

# Generate JWT keys
npm run generate-keys

# Start services
docker-compose -f deployment/docker-compose.production.yml up -d
```

Your auth server is now running at `http://localhost:87001`

### React Integration

```bash
npm install @truxe/react
```

```tsx
import { TruxeProvider, useAuth, LoginButton } from '@truxe/react';

function App() {
  return (
    <TruxeProvider apiUrl="http://localhost:87001">
      <Dashboard />
    </TruxeProvider>
  );
}

function Dashboard() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginButton />;
  }

  return (
    <div>
      <h1>Welcome, {user.email}!</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

**[→ Full React Guide](docs/)** • **[→ More Examples](examples/)**

---

## Features

### Authentication Methods
- 🔐 **Email + Password** - Secure password auth with bcrypt
- ✨ **Magic Links** - Passwordless login via email
- 📱 **TOTP MFA** - Two-factor authentication with backup codes
- 🔑 **OAuth 2.0** - GitHub, Google, Apple, Microsoft (+ custom providers)
- 🌐 **OpenID Connect** - Full OIDC support for enterprise SSO

### Authorization & Security
- 👥 **Multi-Tenant RBAC** - Organizations, roles, permissions
- 🔒 **Session Management** - Secure JWTs with refresh token rotation
- 🎣 **Webhooks** - Real-time events with HMAC signatures
- 🛡️ **Threat Detection** - Automated security monitoring and incident response

### Developer Experience
- ⚡ **React Components** - 16 UI components, fully customizable
- 📚 **RESTful API** - Simple, well-documented endpoints
- 🧪 **Testing Suite** - 199+ tests with K6 load testing
- 📊 **Admin Dashboard** - Manage users, roles, and settings
- 🛠️ **CLI Tool** - Set up authentication in 5 minutes with `@truxe/cli`

### Self-Hosting & Cloud
- 🏠 **Self-Host** - Docker, Kubernetes, VPS—your infrastructure
- ☁️ **Managed Cloud** - $79/month, 10k MAU included (coming Q1 2025)
- 🌍 **Production-Ready** - PostgreSQL, Redis, horizontal scaling
- 📈 **Monitoring** - Prometheus + Grafana dashboards included

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Application                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ React (Web)  │  │ React Native │  │  Backend API │     │
│  │              │  │              │  │              │     │
│  │  @truxe/     │  │  @truxe/     │  │  Direct API  │     │
│  │    react     │  │    react     │  │     calls    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │             │
│         └─────────────────┴─────────────────┘             │
│                           │                               │
└───────────────────────────┼───────────────────────────────┘
                            │
                   RESTful API / JWT
                            │
┌───────────────────────────▼───────────────────────────────┐
│                      Truxe Server                         │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Auth API  │  │  OAuth 2.0  │  │  Webhooks   │      │
│  │             │  │   Provider  │  │   System    │      │
│  │  Login/MFA  │  │             │  │             │      │
│  │  Sessions   │  │  GitHub     │  │  Delivery   │      │
│  │  Users      │  │  Google     │  │  Retries    │      │
│  │             │  │  Custom     │  │  Security   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ PostgreSQL  │  │    Redis    │  │   BullMQ    │      │
│  │             │  │             │  │             │      │
│  │ Users       │  │  Sessions   │  │  Background │      │
│  │ Orgs        │  │  Rate Limit │  │    Jobs     │      │
│  │ Roles       │  │  Cache      │  │  Scheduled  │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└───────────────────────────────────────────────────────────┘
```

---

## Documentation

### Getting Started
- [Quick Start Guide](docs/)
- [React Integration](docs/)
- [Self-Hosting Guide](docs/)
- [Environment Variables](deployment/.env.production.example)

### Core Concepts
- [Authentication Methods](docs/)
- [OAuth 2.0 & OIDC](docs/)
- [Multi-Tenant RBAC](docs/)
- [Webhooks](docs/)

### Examples
- [React + Router v6](examples/react-router-v6)
- [Next.js App Router](examples/nextjs-app-router)
- [Python FastAPI](examples/python-fastapi)
- [More examples →](examples/)

---

## Licensing

Truxe uses the **Business Source License 1.1 (BSL)** with a change date of **2 years**.

**What this means:**
- ✅ **Free forever** - Use Truxe in production, no limits
- ✅ **Self-host unlimited** - Deploy on your infrastructure
- ✅ **Modify freely** - Fork, customize, contribute back
- ❌ **Can't resell** - Don't offer Truxe as a hosted service (for 2 years)

After 2 years, **all versions automatically become MIT licensed**.

**[→ Read Full License](LICENSE-BSL)**

### Commercial License

Need to offer Truxe as a hosted service? Contact us via [GitHub Issues](https://github.com/truxeio/truxe/issues) for a commercial license.

---

## Roadmap

### ✅ Completed Releases

**v0.4.1 - React SDK** (Published)
- ✅ 16 production-ready React components
- ✅ OAuth 2.0 integration (GitHub, Google, custom providers)
- ✅ MFA support (TOTP, backup codes)
- ✅ Session management hooks
- ✅ [Published: @truxe/react@0.4.1](https://www.npmjs.com/package/@truxe/react)

**v0.1.0 - CLI Tool** (Published - Nov 2025)
- ✅ Project initialization (`truxe init`)
- ✅ JWT key management (`truxe keys generate/verify`)
- ✅ Health checks (`truxe health`)
- ✅ Development server (`truxe dev`)
- ✅ [Published: @truxe/cli@0.1.0](https://www.npmjs.com/package/@truxe/cli)

### ✅ Recently Completed: v0.5.x - Developer Experience (Nov 2025)

**v0.5.2 - CI/CD Pipeline Fixes** (Published - Nov 15, 2025)
- ✅ Fixed package-lock.json sync issues in Docker builds
- ✅ Fixed TruffleHog secret scanning workflow configuration
- ✅ Added GitGuardian configuration to suppress false positives
- ✅ All CI/CD pipelines passing
- ✅ Docker images publishing successfully to GHCR

**v0.5.1 - Production Build Fixes** (Published - Nov 15, 2025)
- ✅ Excluded test applications from production workspace
- ✅ Fixed Docker build path configuration
- ✅ Improved CI/CD reliability

**v0.5.0 - Interactive API Playground** (Published - Nov 15, 2025)
- ✅ **Phase 1-4 Complete** - [@truxe/playground@0.5.0](packages/playground)
  - Three-panel responsive UI (Navigator | Builder | Viewer)
  - Monaco Editor integration with syntax highlighting
  - Code generation in 8 languages
  - Request collections with folders (14,595 LOC)
  - Variables & environment management
  - 7 pre-built authentication workflows
  - Import/Export (Truxe, Postman, OpenAPI, cURL, Insomnia)
  - TypeScript excellence: 284 → 0 errors
  - Production build: 116KB gzipped
  - 30/30 tests passing
  - Grade: A+ (99/100)

### 🚀 Next Up: Enhanced Developer Experience

**Planned for v0.5.x patches:**
- [ ] Enhanced CLI features (templates, migrations)
- [ ] Comprehensive API documentation site
- [ ] Video tutorials and quickstart guides
- [ ] Improved error messages and debugging tools

### 📅 Upcoming Releases

**v0.6 - Cloud Launch (Q1 2026)**
- [ ] Managed cloud offering ($79/month, 10k MAU included)
- [ ] Usage-based billing system
- [ ] Web dashboard for cloud customers
- [ ] One-click deployment from dashboard
- [ ] Multi-region support
- [ ] Automated backups and monitoring

**v1.0 - Enterprise Ready (Q2 2026)**
- [ ] SAML 2.0 support
- [ ] SCIM 2.0 user provisioning
- [ ] Advanced audit log streaming
- [ ] Role-based access control (RBAC) v2
- [ ] SOC 2 Type II compliance
- [ ] 99.99% SLA guarantee

---

## Community

- **GitHub Issues** - [Report bugs or request features](https://github.com/truxeio/truxe/issues)
- **GitHub Discussions** - [Ask questions and share ideas](https://github.com/truxeio/truxe/discussions)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Quick contribution checklist:**
- Read [Code of Conduct](CODE_OF_CONDUCT.md)
- Check existing [issues](https://github.com/truxeio/truxe/issues) and [PRs](https://github.com/truxeio/truxe/pulls)
- Fork the repo and create a feature branch
- Write tests for new features
- Submit a PR with a clear description

---

## Security

Found a security issue? Please **do not** open a public issue.

Report security vulnerabilities via GitHub Security Advisories or contact the maintainer directly through GitHub.

See [SECURITY.md](SECURITY.md) for our security policy and responsible disclosure process.

---

<div align="center">

**[Documentation](docs/)** • **[Examples](docs/03-integration-guides/examples/)** • **[Contributing](CONTRIBUTING.md)**

⭐ Star us on GitHub — it helps!

</div>

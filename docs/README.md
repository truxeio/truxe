# Truxe Documentation

Welcome to the comprehensive documentation for Truxe, the open-source authentication platform that's as easy as Clerk, as open as Supabase, and as powerful as Auth0.

## 🚀 Quick Navigation

### 🎯 Getting Started
- **[5-Minute Quickstart](./05-guides/quickstart.md)** - Get authentication running in 5 minutes
- **[Installation Guide](./05-guides/installation.md)** - Detailed installation instructions
- **[Framework Integration](./05-guides/integration-examples.md)** - Next.js, Nuxt, SvelteKit examples

### 📚 Core Documentation
- **[API Reference](./05-guides/api-reference.md)** - Complete API documentation
- **[Security Guide](./05-guides/security-best-practices.md)** - Security best practices
- **[Error Handling Guide](./05-guides/error-handling-guide.md)** - Advanced error handling and troubleshooting
- **[Troubleshooting](./05-guides/troubleshooting.md)** - Common issues and solutions
- **[FAQ](./05-guides/faq.md)** - Frequently asked questions

### 🏗️ Technical Architecture
- **[Architecture Overview](./02-technical/architecture-overview.md)** - System design and components
- **[Database Schema](./02-technical/database-schema.md)** - Database structure and RLS
- **[Security Design](./02-technical/security-design.md)** - Advanced security features
- **[OAuth Architecture](./02-technical/oauth-architecture.md)** - Universal OAuth framework design

### 📖 Guides & Tutorials
- **[Migration from Clerk](./05-guides/migration-from-clerk.md)** - Step-by-step migration guide
- **[OAuth Testing Guide](./05-guides/oauth-testing.md)** - Comprehensive OAuth provider testing
- **[MFA Setup Guide](./05-guides/mfa-setup.md)** - Multi-factor authentication configuration
- **[Manual Setup Guide](./05-guides/manual-setup.md)** - Manual installation steps
- **[Brevo Email Integration](./05-guides/brevo-email-integration.md)** - Transactional email setup
- **[Video Tutorials](./05-guides/video-tutorial-scripts.md)** - Video tutorial scripts

### 🏢 Multi-Tenancy & RBAC (NEW in v0.4.0)
- **[Tenant Service Quickstart](../TENANT-SERVICE-QUICKSTART.md)** ⭐ Start here for hierarchical tenants
- **[Nested Tenancy Implementation](../README-nested-tenancy.md)** - Complete implementation summary
- **[Database Schema Documentation](../database/docs/nested-tenancy-schema.md)** - Technical deep-dive
- **[Tenant Service Integration Examples](../api/examples/tenant-service-integration.js)** - Working code examples

### 🏢 Product & Strategy
- **[Product Vision](./01-product/vision-and-strategy.md)** - Product roadmap and vision
- **[Pricing Strategy](./01-product/pricing-and-monetization.md)** - Pricing and business model

### 📋 Implementation & Deployment
- **[MVP Roadmap](./03-implementation/mvp-roadmap.md)** - Development roadmap
- **[Project Plan](./03-implementation/detailed-project-plan.md)** - Detailed implementation plan
- **[Deployment Guide](./03-implementation/deployment-guide.md)** - Production deployment
- **[Background Jobs Deployment](./03-implementation/background-jobs-deployment.md)** - BullMQ queue system deployment
- **[Archived Documentation](./archive/)** - Historical implementation summaries and completed work

### 🤔 Architecture Decisions
- **[Stack Selection](./04-adrs/001-stack-selection.md)** - Technology choices
- **[Authentication Strategy](./04-adrs/002-authentication-strategy.md)** - Auth approach
- **[Multi-tenancy Design](./04-adrs/003-multi-tenancy-design.md)** - Multi-tenant architecture

---

## 📖 Documentation Structure

This documentation is organized into five main sections:

### 1. **Product Documentation** (`01-product/`)
High-level product information, vision, strategy, and business considerations.

### 2. **Technical Documentation** (`02-technical/`)
Deep technical documentation covering architecture, database design, and security.

### 3. **Implementation Guides** (`03-implementation/`)
Implementation roadmaps, project plans, and development guides.

### 4. **Architecture Decision Records** (`04-adrs/`)
Documented decisions about architecture, technology choices, and design patterns.

### 5. **User Guides & Tutorials** (`05-guides/`)
User-facing documentation, tutorials, API references, and practical guides.

### 6. **Archived Documentation** (`archive/`)
Historical documentation, completed work, and legacy implementation summaries preserved for reference. This includes v0.1-v0.2 documentation, v0.3 completed work, and parallel development reports.

---

## 🎯 Choose Your Path

### 👨‍💻 **I'm a Developer**
Start with the **[5-Minute Quickstart](./05-guides/quickstart.md)** to get authentication running in your app immediately.

### 🏢 **I'm Evaluating Solutions**
Read our **[Product Vision](./01-product/vision-and-strategy.md)** and **[FAQ](./05-guides/faq.md)** to understand Truxe's value proposition.

### 🔧 **I'm Migrating from Another Provider**
Check out our **[Migration from Clerk](./05-guides/migration-from-clerk.md)** guide for step-by-step instructions.

### 🛡️ **I Care About Security**
Dive into our **[Security Best Practices](./05-guides/security-best-practices.md)** and **[Security Design](./02-technical/security-design.md)** documentation.

### 🏗️ **I Want to Understand the Architecture**
Start with **[Architecture Overview](./02-technical/architecture-overview.md)** and explore our **[ADRs](./04-adrs/)**. For multi-tenancy architecture, see **[Nested Tenancy Schema](../database/docs/nested-tenancy-schema.md)**.

### 🏢 **I Need Multi-Tenancy**
Jump to **[Tenant Service Quickstart](../TENANT-SERVICE-QUICKSTART.md)** to start using hierarchical tenants (workspace → team → project) immediately.

### 🚨 **I Need Help**
Visit our **[Troubleshooting Guide](./05-guides/troubleshooting.md)** or join our **[Discord Community](https://discord.gg/truxe)**.

---

## 📦 Version Documentation

### Current Version: v0.4.0 - Nested Multi-Tenancy
- **Database**: Hierarchical tenants with materialized path pattern (2-5 levels)
- **Service Layer**: Complete tenant management with 3,290 lines of production code
- **OAuth**: Universal framework supporting 4 providers (Google, GitHub, Apple, Microsoft)
- **MFA**: TOTP + backup codes with full E2E testing
- **Performance**: Sub-millisecond queries (<1ms), 50x faster than targets

### Previous Versions
- **[v0.3.x Documentation](./v0.3/)** - Background jobs, service accounts, webhooks
- **[v0.2.x Documentation](./legacy/old-versions/v0.2/)** - GitHub integration (5 phases)
- **[v0.1.x Documentation](./legacy/)** - Alpha release, core authentication

---

## 🔍 Search & Navigation

### Quick Search
Use `Ctrl+F` (or `Cmd+F` on Mac) to search within any document. For global search across all documentation, use our **[documentation website](https://docs.truxe.io)**.

### Navigation Tips
- **Breadcrumbs**: Follow the breadcrumb navigation at the top of each page
- **Table of Contents**: Use the TOC in each document for quick navigation
- **Cross-references**: Click on linked sections to jump between related topics
- **Back to Top**: Use the "↑" links to return to the top of long documents

### Mobile-Friendly
All documentation is optimized for mobile reading with responsive design and touch-friendly navigation.

---

## 📊 Documentation Status

### ✅ Complete Documentation
- [x] **Quickstart Guide** - Production ready
- [x] **API Reference** - Complete with examples
- [x] **Security Best Practices** - Comprehensive security guide
- [x] **Error Handling Guide** - Advanced troubleshooting and automated resolution
- [x] **Troubleshooting** - Common issues covered
- [x] **Integration Examples** - Next.js, Nuxt, SvelteKit
- [x] **Migration Guides** - Clerk migration automated
- [x] **FAQ** - 50+ questions answered
- [x] **Architecture Overview** - Technical deep-dive
- [x] **Security Design** - Advanced security features
- [x] **Implementation Summaries** - Completed feature documentation

### ✅ Recent Additions (v0.4.0)
- [x] **Nested Multi-Tenancy** - Hierarchical tenant system (2-5 levels)
- [x] **Tenant Service Layer** - Production-ready service with 3,290 lines
- [x] **Universal OAuth Framework** - Google, GitHub, Apple, Microsoft providers
- [x] **MFA Implementation** - TOTP + Backup codes with E2E testing
- [x] **Email Integration** - Brevo transactional email service

### 🔄 In Progress
- [ ] **Video Tutorials** - Scripts ready, recording in progress
- [ ] **RBAC + ABAC Engine** - Advanced permission system (next phase)
- [ ] **REST API Routes** - Fastify conversion for tenant management
- [ ] **SDK Documentation** - Language-specific guides
- [ ] **Deployment Guides** - Cloud platform specific

### 📅 Planned
- [ ] **Interactive Examples** - Live code playground
- [ ] **Community Cookbook** - Community-contributed examples
- [ ] **Enterprise Guides** - SAML, SCIM, compliance
- [ ] **Mobile SDKs** - React Native, Flutter

---

## 🤝 Contributing to Documentation

We welcome contributions to improve our documentation!

### How to Contribute
1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** all code examples
5. **Submit** a pull request

### Documentation Standards
- **Clear and concise** writing
- **Working code examples** (tested)
- **Consistent formatting** (Markdown)
- **Mobile-friendly** design
- **SEO optimized** content

### What We Need
- **More examples** for different use cases
- **Translations** into other languages
- **Video content** and tutorials
- **Community guides** and best practices
- **Error corrections** and improvements

See our **[Contributing Guide](../CONTRIBUTING.md)** for detailed instructions.

---

## 📞 Support & Community

### 💬 Community Support
- **[Discord Community](https://discord.gg/truxe)** - Join 1,000+ developers
- **[GitHub Discussions](https://github.com/truxe-auth/truxe/discussions)** - Technical Q&A
- **[Stack Overflow](https://stackoverflow.com/questions/tagged/truxe-auth)** - Tag your questions with `truxe-auth`

### 📧 Direct Support
- **General Questions**: support@truxe.io
- **Security Issues**: security@truxe.io
- **Business Inquiries**: sales@truxe.io
- **Partnership**: partnerships@truxe.io

### 🐛 Bug Reports
- **[GitHub Issues](https://github.com/truxe-auth/truxe/issues)** - Report bugs and request features
- **[Security Vulnerabilities](https://github.com/truxe-auth/truxe/security)** - Responsible disclosure

---

## 🔄 Documentation Updates

This documentation is continuously updated. Key information:

- **Last Updated**: November 3, 2025
- **Version**: v0.4.0 - Nested Multi-Tenancy
- **Update Frequency**: Weekly
- **Changelog**: See **[CHANGELOG.md](../CHANGELOG.md)**

### Stay Updated
- **[Newsletter](https://truxe.io/newsletter)** - Monthly documentation updates
- **[RSS Feed](https://docs.truxe.io/feed.xml)** - Documentation changes
- **[Twitter](https://twitter.com/truxe_auth)** - Real-time updates

---

## 🎯 Feedback

Help us improve this documentation:

- **[Documentation Feedback Form](https://forms.gle/truxe-docs-feedback)**
- **[Rate this Documentation](https://docs.truxe.io/feedback)** - Quick 1-5 star rating
- **[Suggest Improvements](https://github.com/truxe-auth/truxe/issues/new?template=documentation.md)** - GitHub issue template

Your feedback helps us create better documentation for everyone!

---

**Ready to get started?** Jump into our **[5-Minute Quickstart](./05-guides/quickstart.md)** and have authentication running in minutes! 🚀

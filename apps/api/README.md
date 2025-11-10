# Truxe Authentication API

🛡️ **Secure, scalable authentication service with passwordless magic links and JWT tokens**

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ Features

- 🔐 **Passwordless Authentication** - Magic links with 256-bit entropy
- 🛡️ **JWT Security** - RS256 signing with JWKS endpoint
- 📱 **Session Management** - JTI-based revocation with device tracking
- 🚦 **Rate Limiting** - Multi-layer protection against abuse
- 📧 **Multi-Provider Email** - Resend, AWS SES, SMTP support
- 📊 **OpenAPI Documentation** - Interactive Swagger UI
- 🔍 **Health Monitoring** - Comprehensive metrics and diagnostics

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Email provider (Resend recommended)

### Installation

```bash
# Clone repository
git clone https://github.com/truxe/truxe.git
cd truxe/api

# Install dependencies
npm install

# Copy environment template
cp env.example .env

# Generate JWT keys
npm run generate-keys

# Configure environment variables
nano .env
```

### Database Setup

```bash
# Set up database
cd ../database
npm install
npm run migrate:up
```

### Start Development Server

```bash
cd ../api
npm run dev
```

🎉 **API is now running at:**
- API: http://localhost:3001
- Docs: http://localhost:3001/docs
- Health: http://localhost:3001/health

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/magic-link` | Request magic link |
| `GET` | `/auth/verify` | Verify magic link token |
| `POST` | `/auth/refresh` | Refresh JWT tokens |
| `POST` | `/auth/revoke` | Revoke session |
| `GET` | `/auth/me` | Get current user |

### JWKS & Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/.well-known/jwks.json` | JSON Web Key Set |
| `GET` | `/.well-known/openid-configuration` | OpenID Connect Discovery |

### Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/metrics` | Performance metrics |

## 🔧 Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/truxe

# Redis
REDIS_URL=redis://localhost:6379

# JWT (generate with npm run generate-keys)
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
JWT_ISSUER=https://auth.yourapp.com

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_key_here

# Security
CORS_ORIGIN=https://yourapp.com
```

## 🔐 Security Features

### Magic Link Security
- **256-bit entropy** tokens
- **Argon2id hashing** for storage
- **15-minute expiration**
- **Single-use validation**
- **Rate limiting** (5/min per IP)

### JWT Security
- **RS256 algorithm** with RSA keys
- **JTI-based revocation**
- **15-minute access tokens**
- **30-day refresh tokens**
- **Automatic rotation**

### Session Security
- **Device fingerprinting**
- **Concurrent session limits** (5 max)
- **Automatic cleanup**
- **Comprehensive audit logs**

## 📊 Performance

- **Magic link request:** <100ms (95th percentile)
- **Token verification:** <50ms (95th percentile)
- **JWKS endpoint:** <25ms (cached)
- **Throughput:** 10,000+ requests/minute

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run security tests
npm run test:security

# Watch mode
npm run test:watch
```

## 📚 Documentation

- **[API Documentation](http://localhost:3001/docs)** - Interactive Swagger UI
- **[Implementation Handover](./HANDOVER.md)** - Complete setup and troubleshooting guide
- **[Architecture Overview](../docs/02-technical/architecture-overview.md)** - Technical architecture details

## 🛠️ Development

### Project Structure

```
api/
├── src/
│   ├── config/           # Configuration management
│   ├── services/         # Core business logic
│   ├── routes/          # API endpoints
│   ├── middleware/      # Request middleware
│   └── server.js        # Main server
├── tests/               # Test suites
├── scripts/             # Utility scripts
└── HANDOVER.md          # Complete handover guide
```

### Available Scripts

```bash
npm run dev           # Start development server
npm run start         # Start production server
npm test              # Run tests
npm run lint          # Run ESLint
npm run generate-keys # Generate JWT keys
```

## 🚀 Deployment

### Production Checklist

- [ ] Environment variables configured
- [ ] JWT keys generated and secured
- [ ] Database migrations applied
- [ ] Email provider tested
- [ ] Redis connection verified
- [ ] Rate limiting configured
- [ ] SSL/TLS certificates installed
- [ ] Monitoring set up

### Docker Deployment

```bash
# Build image
docker build -t truxe-api .

# Run container
docker run -p 3001:3001 \
  -e DATABASE_URL="..." \
  -e REDIS_URL="..." \
  -e JWT_PRIVATE_KEY="..." \
  truxe-api
```

## 🔍 Monitoring

### Health Checks

```bash
# Overall health
curl http://localhost:3001/health

# JWKS health
curl http://localhost:3001/.well-known/health

# Metrics
curl http://localhost:3001/metrics
```

### Key Metrics

- Authentication success rate (>95%)
- Token verification latency (<50ms)
- Rate limit violations
- Session creation rate
- Database connection pool

## 🆘 Troubleshooting

### Common Issues

1. **JWT initialization failed** → Check private/public keys
2. **Database connection error** → Verify DATABASE_URL
3. **Redis connection failed** → Check Redis service
4. **Email sending failed** → Verify provider credentials
5. **Rate limit exceeded** → Check request frequency

See [HANDOVER.md](./HANDOVER.md) for detailed troubleshooting guide.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Fastify** - High-performance web framework
- **PostgreSQL** - Robust database with RLS
- **Redis** - Fast in-memory data store
- **Argon2** - Secure password hashing
- **Node.js** - JavaScript runtime

---

**Built with ❤️ by the Truxe Team**

For support, please check the [troubleshooting guide](./HANDOVER.md) or open an issue.

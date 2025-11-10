# Truxe CLI

The official command-line interface for Truxe authentication. Set up secure authentication in your applications in under 5 minutes.

## Quick Start

```bash
# Install globally
npm install -g @truxe/cli

# Create a new project
truxe init my-app --template=nextjs

# Start development
cd my-app
npm run dev    # Start your app (port 3000)
npm run truxe  # Start Truxe (port 3001)
```

## Features

- 🚀 **5-minute setup** - Get authentication running instantly
- 🎨 **Framework templates** - Next.js, Nuxt, SvelteKit support
- 🛡️ **Secure by default** - Industry-standard security practices
- 🏢 **Multi-tenant ready** - Organizations, roles, permissions
- 🔧 **Developer-friendly** - Comprehensive CLI tools and utilities
- 📊 **Health monitoring** - Built-in status checks and diagnostics
- 🔌 **Port management** - Advanced port conflict detection and resolution
- 📈 **Real-time monitoring** - Live port usage tracking and alerts

## Commands

### Project Management

```bash
# Initialize new project
truxe init [project-name] --template=nextjs|nuxt|sveltekit

# Start development server
truxe dev --port=3001

# Check system health
truxe status --check-all
```

### Port Management

```bash
# Check port availability
truxe ports check

# Show current port status
truxe ports status --detailed

# Kill processes using specific ports
truxe ports kill 3000 8080

# Suggest alternative ports
truxe ports suggest 3000 --service api

# Scan for available port ranges
truxe ports scan --count 5

# Monitor ports in real-time
truxe ports monitor --duration 300 --alerts

# Resolve conflicts interactively
truxe ports resolve

# Reset to default configuration
truxe ports reset --backup
```

### Database Management

```bash
# Run migrations
truxe migrate up --env=production

# Create new migration
truxe migrate create add_user_preferences

# Check migration status
truxe migrate status
```

### Configuration

```bash
# Set configuration values
truxe config set database.url "postgresql://..."
truxe config set multiTenant.enabled true

# Get configuration values
truxe config get database.url
truxe config get --all

# Validate configuration
truxe config validate
```

## Templates

### Next.js
Production-ready React application with:
- Complete authentication integration with magic links
- Protected routes with role-based access control
- Automatic token refresh and session management
- CSRF protection and comprehensive security headers
- Responsive UI with accessibility compliance (WCAG 2.1 AA)
- Modern UX patterns with loading states and error handling
- User profile management and session controls
- TypeScript throughout with complete type definitions
- Custom Tailwind CSS design system

### Nuxt
Vue.js application with:
- Universal rendering
- Server-side authentication
- Protected pages middleware
- TypeScript support
- Auto-imports

### SvelteKit
Svelte application with:
- Full-stack capabilities
- Server-side authentication
- Protected routes with hooks
- TypeScript support
- Vite build system

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/truxe

# JWT Keys (generate with: truxe keys generate)
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."

# Email Provider
EMAIL_PROVIDER=resend
EMAIL_API_KEY=your-api-key
EMAIL_FROM=noreply@yourapp.com

# Features
ENABLE_MULTI_TENANT=false
ENABLE_SIGNUP=true
```

### Configuration File

Create `truxe.config.yaml`:

```yaml
server:
  port: 3001
  cors:
    origin: "http://localhost:3000"

database:
  url: "sqlite:./dev.db"

auth:
  jwt:
    algorithm: "RS256"
    accessTokenTTL: "15m"
    refreshTokenTTL: "30d"
  session:
    maxConcurrent: 5

multiTenant:
  enabled: false
  defaultRole: "member"

email:
  provider: "resend"
  from: "noreply@yourapp.com"
```

## Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/truxe-auth/truxe.git
cd truxe/cli

# Install dependencies
npm install

# Build the CLI
npm run build

# Link for local testing
npm link
```

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint
```

## Architecture

The Truxe CLI is built with:

- **Commander.js** - Command-line interface framework
- **TypeScript** - Type-safe development
- **Inquirer.js** - Interactive prompts
- **Listr2** - Task progress indicators
- **Chalk** - Terminal styling

### Directory Structure

```
cli/
├── src/
│   ├── commands/        # CLI commands
│   │   ├── init.ts      # Project initialization
│   │   ├── dev.ts       # Development server
│   │   ├── migrate.ts   # Database migrations
│   │   ├── config.ts    # Configuration management
│   │   └── status.ts    # Health checks
│   ├── templates/       # Project templates
│   │   ├── nextjs/      # Next.js template
│   │   ├── nuxt/        # Nuxt template
│   │   └── sveltekit/   # SvelteKit template
│   ├── utils/           # Utility functions
│   │   ├── config.ts    # Configuration management
│   │   ├── project.ts   # Project utilities
│   │   ├── logger.ts    # Logging utilities
│   │   └── error-handler.ts # Error handling
│   ├── types/           # TypeScript types
│   └── index.ts         # CLI entry point
├── templates/           # Template files
├── tests/              # Test files
└── package.json
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Make your changes
5. Add tests for new features
6. Run tests: `npm test`
7. Submit a pull request

## Support

- 📖 [Documentation](https://docs.truxe.io)
- 💬 [Discord Community](https://discord.gg/truxe)
- 🐛 [GitHub Issues](https://github.com/truxe-auth/truxe/issues)
- 📧 [Email Support](mailto:support@truxe.io)

## License

MIT License - see [LICENSE](../LICENSE) for details.

---

**Made with ❤️ by the Truxe Team**

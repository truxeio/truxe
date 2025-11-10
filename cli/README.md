# Truxe CLI

The official command-line interface for Truxe authentication. Set up secure authentication in your applications in under 5 minutes.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
  - [Project Management](#project-management)
  - [Development](#development)
  - [Key Management](#key-management)
  - [Database Migrations](#database-migrations)
  - [Health & Status](#health--status)
  - [Configuration](#configuration)
  - [Port Management](#port-management)
- [Templates](#templates)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Support](#support)

---

## Installation

### Global Installation (Recommended)

```bash
# Install globally using npm
npm install -g @truxe/cli

# Or using pnpm
pnpm add -g @truxe/cli

# Or using yarn
yarn global add @truxe/cli
```

After installation, verify it works:

```bash
truxe --version
```

### Using npx (No Installation)

You can use the CLI without installing it globally:

```bash
npx @truxe/cli@latest init my-app
```

### Updating

```bash
# Update to latest version
npm update -g @truxe/cli

# Or reinstall
npm install -g @truxe/cli@latest
```

### Requirements

- **Node.js**: 20.0.0 or higher
- **npm/pnpm/yarn**: Latest version
- **Docker**: Optional, for database services
- **PostgreSQL**: Optional, for production databases

---

## Quick Start

Get started with Truxe in 5 minutes:

```bash
# 1. Install CLI globally
npm install -g @truxe/cli

# 2. Create a new project
truxe init my-app --template=nextjs

# 3. Navigate to project
cd my-app

# 4. Generate JWT keys
truxe keys generate

# 5. Start development server
truxe dev

# 6. In another terminal, start your app
npm run dev
```

Your authentication server will be running at `http://localhost:3001` and your app at `http://localhost:3000`.

---

## Commands

### Project Management

#### `truxe init [project-name]`

Initialize a new Truxe project with authentication.

**Options:**
- `-t, --template <template>` - Framework template (nextjs|nuxt|sveltekit|express)
- `--db <database>` - Database type (sqlite|postgresql), default: sqlite
- `--multi-tenant` - Enable multi-tenant mode
- `--skip-install` - Skip dependency installation
- `--skip-git` - Skip git repository initialization
- `-y, --yes` - Skip interactive prompts and use defaults

**Examples:**

```bash
# Interactive setup
truxe init my-app

# Quick setup with defaults
truxe init my-app --template=nextjs --yes

# Advanced setup with PostgreSQL
truxe init my-app \
  --template=nextjs \
  --db=postgresql \
  --multi-tenant

# Initialize in existing directory
cd my-existing-app
truxe init --template=nextjs
```

**What it does:**
- Creates project structure
- Sets up framework template
- Configures authentication
- Generates `.env` file
- Initializes git repository (optional)
- Installs dependencies (optional)

---

### Development

#### `truxe dev`

Start Truxe development server with hot reload.

**Options:**
- `-p, --port <port>` - Port for Truxe API, default: 3001
- `--api-port <port>` - Alternative port specification
- `--db <database>` - Database type (sqlite|postgresql)
- `--host <host>` - Host to bind to, default: 0.0.0.0
- `--open` - Open browser automatically
- `--watch` - Watch for file changes, default: true

**Examples:**

```bash
# Start on default port (3001)
truxe dev

# Start on custom port
truxe dev --port=8080

# Start with PostgreSQL
truxe dev --db=postgresql

# Start and open browser
truxe dev --open
```

**What it does:**
- Validates project configuration
- Checks environment variables
- Starts development server
- Enables hot reload
- Monitors file changes

---

### Key Management

#### `truxe keys generate`

Generate RSA key pair for JWT signing.

**Options:**
- `-f, --force` - Overwrite existing keys
- `--bits <bits>` - Key size in bits (2048|3072|4096), default: 2048
- `--output-dir <dir>` - Output directory for keys, default: keys
- `--update-env` - Update .env file with key paths, default: true

**Examples:**

```bash
# Generate default 2048-bit keys
truxe keys generate

# Generate 4096-bit keys
truxe keys generate --bits=4096

# Generate keys in custom directory
truxe keys generate --output-dir=./certs

# Overwrite existing keys
truxe keys generate --force
```

**What it does:**
- Generates RSA key pair
- Saves to `keys/private.pem` and `keys/public.pem`
- Sets proper file permissions (600 for private key)
- Updates `.env` file with key paths
- Displays key fingerprint

**Security Notes:**
- Private keys are saved with 600 permissions (owner read/write only)
- Never commit private keys to version control
- Use environment variables or secrets management in production

---

### Database Migrations

#### `truxe migrate [action]`

Run database migrations.

**Actions:**
- `up` - Apply pending migrations (default)
- `down` - Rollback migrations
- `status` - Show migration status
- `create <name>` - Create new migration file

**Options:**
- `--env <environment>` - Environment (development|production|staging), default: development
- `--steps <number>` - Number of migration steps, default: 1
- `--create <name>` - Create a new migration file
- `--dry-run` - Show what would be migrated without executing

**Examples:**

```bash
# Apply pending migrations
truxe migrate up

# Apply migrations in production
truxe migrate up --env=production

# Rollback last migration
truxe migrate down

# Rollback multiple migrations
truxe migrate down --steps=3

# Check migration status
truxe migrate status

# Create new migration
truxe migrate create add_user_preferences

# Dry run (see what would happen)
truxe migrate up --dry-run
```

**Subcommands:**

```bash
# Convenience commands
truxe migrate up --env=production
truxe migrate down --steps=2
truxe migrate status
truxe migrate create add_new_feature
```

---

### Health & Status

#### `truxe health`

Check system health and dependencies.

**Options:**
- `--json` - Output results as JSON
- `--skip-docker` - Skip Docker check
- `--skip-db` - Skip database check
- `--skip-redis` - Skip Redis check

**Examples:**

```bash
# Full health check
truxe health

# JSON output for scripting
truxe health --json

# Skip Docker check
truxe health --skip-docker

# Quick check (skip DB and Redis)
truxe health --skip-db --skip-redis
```

**What it checks:**
- ✅ Node.js version (>= 20.0.0)
- ✅ Package manager (npm/pnpm/yarn)
- ✅ Docker availability
- ✅ Port availability (87001, 87032, 87079)
- ✅ Environment variables
- ✅ PostgreSQL connection (if configured)
- ✅ Redis connection (if configured)

#### `truxe status`

Show project status and configuration.

**Options:**
- `--check-all` - Run all health checks
- `--json` - Output as JSON

**Examples:**

```bash
# Show project status
truxe status

# Run comprehensive checks
truxe status --check-all
```

---

### Configuration

#### `truxe config`

Manage project configuration.

**Subcommands:**

```bash
# Set configuration value
truxe config set database.url "postgresql://user:pass@localhost:5432/truxe"
truxe config set multiTenant.enabled true

# Get configuration value
truxe config get database.url
truxe config get --all

# Validate configuration
truxe config validate

# Show current configuration
truxe config show
```

**Examples:**

```bash
# Set database URL
truxe config set database.url "postgresql://localhost:5432/mydb"

# Enable multi-tenant
truxe config set multiTenant.enabled true

# Get all configuration
truxe config get --all

# Validate before deployment
truxe config validate
```

---

### Port Management

#### `truxe ports`

Manage port conflicts and availability.

**Subcommands:**

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

**Examples:**

```bash
# Check if ports are available
truxe ports check

# Find alternative for port 3000
truxe ports suggest 3000 --service api

# Kill process on port 3000
truxe ports kill 3000

# Monitor ports for 5 minutes
truxe ports monitor --duration 300
```

---

## Templates

Truxe CLI supports multiple framework templates:

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

**Usage:**
```bash
truxe init my-app --template=nextjs
```

### Nuxt

Vue.js application with:
- Universal rendering (SSR/SSG)
- Server-side authentication
- Protected pages middleware
- TypeScript support
- Auto-imports
- Composition API

**Usage:**
```bash
truxe init my-app --template=nuxt
```

### SvelteKit

Svelte application with:
- Full-stack capabilities
- Server-side authentication
- Protected routes with hooks
- TypeScript support
- Vite build system
- Progressive enhancement

**Usage:**
```bash
truxe init my-app --template=sveltekit
```

### Express

Express.js API protection:
- RESTful API authentication
- Middleware for route protection
- Token validation
- Session management

**Usage:**
```bash
truxe init my-api --template=express
```

---

## Configuration

### Environment Variables

The CLI uses environment variables for configuration. Create a `.env` file in your project root:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/truxe
# Or for SQLite
DATABASE_URL=sqlite:./dev.db

# JWT Keys (generate with: truxe keys generate)
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem

# Email Provider
EMAIL_PROVIDER=resend
EMAIL_API_KEY=your-api-key
EMAIL_FROM=noreply@yourapp.com

# Features
ENABLE_MULTI_TENANT=false
ENABLE_SIGNUP=true

# Server
PORT=3001
NODE_ENV=development
```

### Configuration File

Create `truxe.config.yaml` for advanced configuration:

```yaml
server:
  port: 3001
  cors:
    origin: "http://localhost:3000"

database:
  url: "sqlite:./dev.db"
  # Or for PostgreSQL
  # url: "postgresql://user:pass@localhost:5432/truxe"

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

---

## Troubleshooting

For detailed troubleshooting information, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

### Common Issues

#### "Command not found: truxe"

**Problem:** CLI is not installed or not in PATH.

**Solution:**
```bash
# Reinstall globally
npm install -g @truxe/cli

# Verify installation
which truxe
truxe --version
```

#### "Not a Truxe project"

**Problem:** Command is being run outside a Truxe project directory.

**Solution:**
```bash
# Initialize a new project
truxe init my-app

# Or navigate to existing project
cd my-truxe-project
```

#### Port Already in Use

**Problem:** Default port (3001) is already occupied.

**Solution:**
```bash
# Use a different port
truxe dev --port=3002

# Or find and kill the process
truxe ports kill 3001

# Or find alternative port
truxe ports suggest 3001
```

#### Database Connection Failed

**Problem:** Cannot connect to PostgreSQL or Redis.

**Solution:**
```bash
# Check database status
truxe health --skip-docker

# Verify connection string in .env
truxe config get database.url

# Test connection
truxe health
```

#### Migration Errors

**Problem:** Migrations fail or are out of sync.

**Solution:**
```bash
# Check migration status
truxe migrate status

# Rollback problematic migration
truxe migrate down

# Re-run migrations
truxe migrate up

# Create new migration if needed
truxe migrate create fix_schema
```

#### JWT Keys Not Found

**Problem:** JWT keys are missing or invalid.

**Solution:**
```bash
# Generate new keys
truxe keys generate

# Verify keys exist
ls -la keys/

# Check .env configuration
truxe config get JWT_PRIVATE_KEY_PATH
```

#### Permission Denied

**Problem:** File permissions are incorrect.

**Solution:**
```bash
# Fix key permissions
chmod 600 keys/private.pem
chmod 644 keys/public.pem

# Or regenerate keys
truxe keys generate --force
```

### Getting Help

All commands support `--help` flag:

```bash
# General help
truxe --help

# Command-specific help
truxe init --help
truxe dev --help
truxe migrate --help
```

### Debug Mode

Enable verbose logging:

```bash
# Run with verbose flag
truxe dev --verbose

# Or set environment variable
TRUXE_VERBOSE=true truxe dev
```

### Reporting Issues

If you encounter a bug:

1. Check existing issues on [GitHub](https://github.com/truxeio/truxe/issues)
2. Run with `--verbose` flag and collect logs
3. Include:
   - CLI version (`truxe --version`)
   - Node.js version (`node --version`)
   - Operating system
   - Error message and stack trace
   - Steps to reproduce

For more detailed troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/truxe.git
   cd truxe/cli
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Build the CLI**:
   ```bash
   npm run build
   ```
5. **Link for local testing**:
   ```bash
   npm link
   ```
6. **Make your changes** and test:
   ```bash
   npm test
   npm run lint
   ```
7. **Submit a pull request**

### Project Structure

```
cli/
├── src/
│   ├── commands/        # CLI commands
│   │   ├── init.ts      # Project initialization
│   │   ├── dev.ts       # Development server
│   │   ├── keys.ts      # JWT key management
│   │   ├── migrate.ts   # Database migrations
│   │   ├── health.ts    # Health checks
│   │   ├── config.ts    # Configuration management
│   │   ├── status.ts    # Project status
│   │   └── ports.ts     # Port management
│   ├── templates/       # Project templates
│   │   ├── nextjs/      # Next.js template
│   │   ├── nuxt/        # Nuxt template
│   │   └── sveltekit/   # SvelteKit template
│   ├── utils/           # Utility functions
│   │   ├── logger.ts    # Logging utilities
│   │   ├── config.ts    # Configuration management
│   │   ├── project.ts   # Project utilities
│   │   └── error-handler.ts # Error handling
│   ├── types/           # TypeScript types
│   └── index.ts         # CLI entry point
├── tests/              # Test files
├── package.json
└── README.md
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Lint code
npm run lint
```

### Architecture

The Truxe CLI is built with:

- **Commander.js** - Command-line interface framework
- **TypeScript** - Type-safe development
- **Inquirer.js** - Interactive prompts
- **Listr2** - Task progress indicators
- **Chalk** - Terminal styling
- **Ora** - Spinners and loading indicators

---

## Support

- 📖 [Documentation](https://docs.truxe.io)
- 💬 [Discord Community](https://discord.gg/truxe)
- 🐛 [GitHub Issues](https://github.com/truxeio/truxe/issues)
- 📧 [Email Support](mailto:support@truxe.io)

---

## License

MIT License - see [LICENSE](../LICENSE) for details.

---

**Made with ❤️ by the Truxe Team**

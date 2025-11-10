# @truxe/cli

Official CLI for [Truxe](https://truxe.io) - Set up authentication in 5 minutes.

## Features

- 🚀 **Quick Setup** - Initialize a new Truxe project in seconds
- 🔑 **JWT Key Management** - Generate and verify RSA keys automatically
- 🐳 **Docker Integration** - Automatic PostgreSQL and Redis setup
- 🔄 **Database Migrations** - Built-in migration management
- 🏥 **Health Checks** - Verify system dependencies
- 🎨 **Beautiful CLI** - Color-coded output with progress indicators

## Installation

```bash
npm install -g @truxe/cli
```

Or use with npx (no installation required):

```bash
npx @truxe/cli init my-project
```

## Quick Start

```bash
# 1. Initialize a new project
truxe init my-auth-server

# 2. Navigate to your project
cd my-auth-server

# 3. Generate JWT keys
truxe keys generate

# 4. Start Docker services
docker-compose up -d

# 5. Start development server
truxe dev
```

Your authentication server is now running at `http://localhost:3456`!

## Commands

### `truxe init [project-name]`

Initialize a new Truxe project with interactive setup.

```bash
# Interactive setup
truxe init

# With project name
truxe init my-auth-server

# Use defaults (no prompts)
truxe init my-auth-server --defaults

# Skip git initialization
truxe init my-auth-server --skip-git
```

**What it does:**
- Creates project directory structure
- Generates `.env` with secure random secrets
- Sets up `docker-compose.yml` for PostgreSQL and Redis
- Creates `.gitignore` and `README.md`
- Initializes git repository

**Interactive prompts:**
- Project name
- Database choice (PostgreSQL/MySQL)
- Redis configuration
- Email provider (SMTP, Brevo, SendGrid, or none)
- OAuth providers (GitHub, Google, Apple, Microsoft)
- OAuth credentials (optional)

### `truxe dev`

Start development server with Docker services.

```bash
# Start everything
truxe dev

# Skip Docker services
truxe dev --skip-docker

# Skip health checks
truxe dev --skip-health-check

# Use custom port
truxe dev --port 8080
```

**What it does:**
- Runs pre-flight checks (.env, JWT keys, Docker, ports)
- Starts Docker services (PostgreSQL + Redis)
- Waits for services to be healthy
- Verifies database and Redis connections
- Provides service URLs and useful commands

### `truxe keys generate`

Generate RSA key pair for JWT signing.

```bash
# Generate 2048-bit keys (default)
truxe keys generate

# Generate 4096-bit keys
truxe keys generate --bits 4096

# Custom output directory
truxe keys generate --output ./my-keys

# Force overwrite existing keys
truxe keys generate --force
```

**What it does:**
- Generates RSA-2048 or RSA-4096 key pair
- Saves `private.pem` and `public.pem`
- Sets correct file permissions (600 for private key)
- Updates `.env` with key paths
- Verifies keys/ is in `.gitignore`

### `truxe keys verify`

Verify existing JWT keys.

```bash
truxe keys verify
```

**What it does:**
- Checks if key files exist
- Validates PEM format
- Tests signing and verification
- Shows key fingerprint

### `truxe keys rotate`

Rotate JWT keys (guidance only - not yet implemented).

```bash
truxe keys rotate
```

### `truxe migrate`

Database migration management.

```bash
# Run pending migrations
truxe migrate up

# Rollback last migration
truxe migrate down

# Check migration status
truxe migrate status

# Create new migration
truxe migrate create add-users-table

# Dry run (show what would happen)
truxe migrate up --dry-run
```

**What it does:**
- Checks database connection
- Detects migration directories
- Provides guidance for popular migration tools
- (Full implementation coming soon)

### `truxe health`

Check system dependencies and configuration.

```bash
truxe health
```

**What it checks:**
- Node.js version (>= 20.0.0)
- npm/pnpm availability
- Docker installation and status
- PostgreSQL connection
- Redis connection
- Port availability (3456, 5433, 6380)
- Environment configuration

## Default Ports

Truxe uses memorable default ports:

| Service    | Port | Why                          |
|------------|------|------------------------------|
| API        | 3456 | Easy to remember (3-4-5-6)   |
| PostgreSQL | 5433 | Standard 5432 + 1            |
| Redis      | 6380 | Standard 6379 + 1            |

These avoid conflicts with standard installations while remaining close to familiar ports.

## Environment Variables

### Required Variables

```bash
# Application
PORT=3456
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5433/truxe
DB_PASSWORD=<generated>

# Redis
REDIS_URL=redis://localhost:6380
REDIS_PASSWORD=<generated>

# JWT Keys
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem

# Security Secrets
COOKIE_SECRET=<generated-64-chars>
SESSION_SECRET=<generated-64-chars>
OAUTH_STATE_SECRET=<generated-64-chars>
OAUTH_TOKEN_ENCRYPTION_KEY=<generated-64-chars>
```

### Optional Variables

```bash
# Email (for magic links)
EMAIL_PROVIDER=smtp|brevo|sendgrid
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password
EMAIL_FROM=noreply@yourdomain.com

# OAuth Providers
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3456/auth/oauth/callback/github

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3456/auth/oauth/callback/google

# URLs
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3456
```

All secrets are automatically generated with cryptographically secure random values.

## Troubleshooting

### Port Already in Use

If you see "Port already in use" errors:

```bash
# Check what's using Truxe ports
lsof -i :3456
lsof -i :5433
lsof -i :6380

# Stop conflicting services
docker-compose down  # Stop Truxe services
# Or kill specific process
kill <PID>
```

### Docker Not Running

```bash
# Check Docker status
docker ps

# Start Docker Desktop (macOS/Windows)
# Or start Docker daemon (Linux)
sudo systemctl start docker
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### JWT Keys Not Found

```bash
# Generate new keys
truxe keys generate

# Verify keys exist
ls -la keys/

# Check .env has correct paths
cat .env | grep JWT_
```

### Migration Directory Not Found

```bash
# Create migrations directory
mkdir -p migrations

# Install a migration tool
npm install --save-dev node-pg-migrate

# Create first migration
npx node-pg-migrate create initial-schema
```

## Global Options

```bash
# Enable verbose logging
truxe --verbose <command>

# Disable colored output
truxe --no-color <command>

# Show version
truxe --version

# Show help
truxe --help
truxe <command> --help
```

## Project Structure

After running `truxe init`, you'll have:

```
my-project/
├── .env                  # Environment configuration (gitignored)
├── .gitignore           # Git ignore rules
├── README.md            # Project documentation
├── docker-compose.yml   # PostgreSQL + Redis services
├── keys/                # JWT RSA keys (gitignored)
│   ├── private.pem      # Private key for signing
│   └── public.pem       # Public key for verification
└── logs/                # Application logs (gitignored)
```

## Integration with Truxe

This CLI is designed to work with [@truxe/node](https://npmjs.com/package/@truxe/node) (the Truxe Node.js SDK):

```bash
# In your application
npm install @truxe/node

# Use the generated configuration
import { TruxeClient } from '@truxe/node';

const truxe = new TruxeClient({
  apiUrl: process.env.API_URL,
  // Configuration from .env
});
```

## Examples

### Full Setup Workflow

```bash
# 1. Create project
truxe init my-auth-server --defaults
cd my-auth-server

# 2. Generate keys
truxe keys generate

# 3. Verify system
truxe health

# 4. Start services
docker-compose up -d

# 5. Check everything is ready
truxe health

# 6. Start dev server
truxe dev
```

### Custom Email Provider

```bash
# Initialize with interactive setup
truxe init my-project

# Select SMTP as email provider
# Enter your SMTP credentials

# Or update .env manually later
vim .env
```

### Production Deployment

```bash
# 1. Generate production keys
truxe keys generate --bits 4096

# 2. Update .env for production
cp .env .env.production
vim .env.production

# 3. Run health check
NODE_ENV=production truxe health

# 4. Deploy with Docker
docker-compose -f docker-compose.prod.yml up -d
```

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/truxeio/truxe.git
cd truxe/packages/cli

# Install dependencies
pnpm install

# Build
pnpm build

# Link globally for testing
npm link

# Test
truxe --help
```

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

### Code Quality

```bash
# Lint
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type check
pnpm type-check
```

## License

Business Source License 1.1 (BSL)

- ✅ Free for self-hosted production use
- ✅ Free for development and testing
- ❌ Cannot offer as managed service without authorization
- 🔄 Converts to MIT license on January 1, 2029

See [LICENSE](LICENSE) for full details.

## Links

- [Truxe Documentation](https://truxe.io/docs)
- [GitHub Repository](https://github.com/truxeio/truxe)
- [npm Package](https://npmjs.com/package/@truxe/cli)
- [Report Issues](https://github.com/truxeio/truxe/issues)
- [Discussions](https://github.com/truxeio/truxe/discussions)

## Support

- 📖 [Documentation](https://truxe.io/docs)
- 💬 [GitHub Discussions](https://github.com/truxeio/truxe/discussions)
- 🐛 [Report Bug](https://github.com/truxeio/truxe/issues/new?template=bug_report.md)
- ✨ [Request Feature](https://github.com/truxeio/truxe/issues/new?template=feature_request.md)

---

Made with ❤️ by the [Truxe Team](https://truxe.io)

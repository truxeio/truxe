# Truxe CLI Troubleshooting Guide

Common issues and solutions when using the Truxe CLI.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Command Not Found](#command-not-found)
- [Project Initialization](#project-initialization)
- [Development Server](#development-server)
- [Database Issues](#database-issues)
- [Port Conflicts](#port-conflicts)
- [JWT Keys](#jwt-keys)
- [Configuration](#configuration)
- [Getting Help](#getting-help)

---

## Installation Issues

### "Command not found: truxe"

**Problem:** The CLI is not installed or not in your PATH.

**Solutions:**

```bash
# Reinstall globally
npm install -g @truxe/cli

# Verify installation
which truxe
truxe --version

# Check npm global bin path
npm config get prefix

# Add to PATH if needed (macOS/Linux)
export PATH="$(npm config get prefix)/bin:$PATH"

# Or use npx instead
npx @truxe/cli@latest init my-app
```

**macOS/Linux:** Ensure npm's global bin directory is in your PATH:
```bash
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Windows:** npm global bin is usually added automatically. If not:
```powershell
# Check npm global path
npm config get prefix

# Add to PATH in System Environment Variables
```

### Permission Denied Errors

**Problem:** npm global install requires sudo/admin permissions.

**Solutions:**

```bash
# Option 1: Use npm's built-in fix
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Option 2: Fix npm permissions (macOS/Linux)
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}

# Option 3: Use npx (no installation needed)
npx @truxe/cli@latest
```

---

## Command Not Found

### "Not a Truxe project"

**Problem:** Command is being run outside a Truxe project directory.

**Solutions:**

```bash
# Check if you're in a Truxe project
ls -la | grep truxe.config

# Initialize a new project
truxe init my-app

# Or navigate to existing project
cd my-truxe-project
truxe dev
```

**Note:** Some commands like `truxe init` and `truxe health` can be run outside a project directory.

---

## Project Initialization

### "Project name already exists"

**Problem:** Directory with the same name already exists.

**Solutions:**

```bash
# Use a different name
truxe init my-app-v2

# Or remove existing directory
rm -rf my-app
truxe init my-app

# Or initialize in current directory
cd my-app
truxe init --template=nextjs
```

### Template Not Found

**Problem:** Invalid template name specified.

**Solutions:**

```bash
# List available templates
truxe init --help

# Use valid template name
truxe init my-app --template=nextjs  # ✅
truxe init my-app --template=react   # ❌ Invalid

# Available templates: nextjs, nuxt, sveltekit, express
```

### Installation Fails

**Problem:** npm/pnpm install fails during project setup.

**Solutions:**

```bash
# Skip installation and install manually
truxe init my-app --skip-install
cd my-app
npm install

# Check Node.js version (requires >= 20.0.0)
node --version

# Clear npm cache
npm cache clean --force

# Use pnpm instead
truxe init my-app --skip-install
cd my-app
pnpm install
```

---

## Development Server

### Port Already in Use

**Problem:** Default port (3001) is already occupied.

**Solutions:**

```bash
# Use a different port
truxe dev --port=3002

# Find what's using the port
truxe ports check 3001

# Kill the process
truxe ports kill 3001

# Or find alternative port
truxe ports suggest 3001 --service api
```

**macOS/Linux:**
```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 $(lsof -t -i:3001)
```

**Windows:**
```powershell
# Find process using port
netstat -ano | findstr :3001

# Kill process
taskkill /PID <PID> /F
```

### Server Won't Start

**Problem:** Development server fails to start.

**Solutions:**

```bash
# Check system health
truxe health

# Check for missing environment variables
truxe config validate

# Check logs with verbose mode
truxe dev --verbose

# Verify project structure
ls -la
cat package.json
```

### Hot Reload Not Working

**Problem:** File changes don't trigger server restart.

**Solutions:**

```bash
# Ensure watch mode is enabled (default)
truxe dev --watch

# Check file permissions
ls -la src/

# Verify nodemon is installed
npm list nodemon

# Restart server manually
# Press Ctrl+C and run again
truxe dev
```

---

## Database Issues

### Database Connection Failed

**Problem:** Cannot connect to PostgreSQL or SQLite.

**Solutions:**

```bash
# Check database status
truxe health --check-db

# Verify connection string
truxe config get database.url

# Test PostgreSQL connection
psql $DATABASE_URL

# For SQLite, check file permissions
ls -la *.db

# Update database URL
truxe config set database.url "postgresql://user:pass@localhost:5432/truxe"
```

### Migration Errors

**Problem:** Migrations fail or are out of sync.

**Solutions:**

```bash
# Check migration status
truxe migrate status

# View migration history
truxe migrate status --detailed

# Rollback problematic migration
truxe migrate down --steps=1

# Re-run migrations
truxe migrate up

# Dry run to see what would happen
truxe migrate up --dry-run

# Create new migration if schema changed
truxe migrate create fix_schema
```

### SQLite Locked

**Problem:** SQLite database is locked (multiple processes accessing).

**Solutions:**

```bash
# Stop all running Truxe processes
pkill -f truxe

# Check for other processes using database
lsof *.db

# Use PostgreSQL for production
truxe config set database.url "postgresql://..."
```

---

## Port Conflicts

### Port Already in Use

**Problem:** Required ports are occupied by other services.

**Solutions:**

```bash
# Check port availability
truxe ports check

# Check specific ports
truxe ports check 3001 8080

# Find alternative ports
truxe ports suggest 3001 --service api

# Kill processes using ports
truxe ports kill 3001 8080

# Interactive resolution
truxe ports resolve
```

### Multiple Services Conflict

**Problem:** Multiple Truxe instances trying to use same ports.

**Solutions:**

```bash
# Check running Truxe processes
ps aux | grep truxe

# Stop all instances
pkill -f truxe

# Use different ports for each instance
truxe dev --port=3001  # Instance 1
truxe dev --port=3002  # Instance 2
```

---

## JWT Keys

### Keys Not Found

**Problem:** JWT keys are missing or invalid.

**Solutions:**

```bash
# Generate new keys
truxe keys generate

# Verify keys exist
ls -la keys/

# Check .env configuration
truxe config get JWT_PRIVATE_KEY_PATH
truxe config get JWT_PUBLIC_KEY_PATH

# Regenerate keys
truxe keys generate --force
```

### Permission Denied

**Problem:** Cannot read or write key files.

**Solutions:**

```bash
# Fix key permissions
chmod 600 keys/private.pem
chmod 644 keys/public.pem

# Or regenerate keys
truxe keys generate --force

# Check file ownership
ls -la keys/
```

### Invalid Key Format

**Problem:** Keys are corrupted or in wrong format.

**Solutions:**

```bash
# Verify key format
head -1 keys/private.pem  # Should start with "-----BEGIN PRIVATE KEY-----"
head -1 keys/public.pem   # Should start with "-----BEGIN PUBLIC KEY-----"

# Regenerate keys
truxe keys generate --force

# Use different key size
truxe keys generate --bits=4096
```

---

## Configuration

### Configuration Not Found

**Problem:** Configuration file is missing or invalid.

**Solutions:**

```bash
# Check if config exists
ls -la truxe.config.yaml

# Validate configuration
truxe config validate

# Show current configuration
truxe config show

# Reset to defaults
truxe config reset --confirm
```

### Environment Variables Not Loaded

**Problem:** .env file not being read.

**Solutions:**

```bash
# Check .env file exists
ls -la .env

# Verify environment variables
truxe config get --all

# Load environment manually
export $(cat .env | xargs)

# Check .env format (no spaces around =)
cat .env
```

### Invalid Configuration Values

**Problem:** Configuration values are incorrect.

**Solutions:**

```bash
# Validate configuration
truxe config validate

# Get specific value
truxe config get database.url

# Set correct value
truxe config set database.url "postgresql://user:pass@localhost:5432/truxe"

# View all configuration
truxe config get --all
```

---

## Getting Help

### Enable Verbose Logging

```bash
# Run command with verbose flag
truxe dev --verbose

# Or set environment variable
TRUXE_VERBOSE=true truxe dev
```

### Command Help

```bash
# General help
truxe --help

# Command-specific help
truxe init --help
truxe dev --help
truxe migrate --help
truxe health --help
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=truxe:* truxe dev

# Or use verbose flag
truxe dev --verbose
```

### Check System Health

```bash
# Full health check
truxe health

# JSON output for scripting
truxe health --json

# Skip specific checks
truxe health --skip-docker --skip-db
```

### Reporting Issues

When reporting issues, include:

1. **CLI Version:**
   ```bash
   truxe --version
   ```

2. **Node.js Version:**
   ```bash
   node --version
   ```

3. **Operating System:**
   ```bash
   uname -a  # macOS/Linux
   systeminfo  # Windows
   ```

4. **Error Message:**
   ```bash
   truxe dev --verbose > error.log 2>&1
   ```

5. **System Health:**
   ```bash
   truxe health --json > health.json
   ```

### Resources

- **Documentation:** [https://docs.truxe.io](https://docs.truxe.io)
- **CLI README:** [cli/README.md](../cli/README.md)
- **GitHub Issues:** [https://github.com/truxeio/truxe/issues](https://github.com/truxeio/truxe/issues)
- **Discord Community:** [https://discord.gg/truxe](https://discord.gg/truxe)
- **Email Support:** support@truxe.io

---

## Common Error Messages

### "EACCES: permission denied"

**Solution:** Fix file permissions or use sudo (not recommended for global installs)

```bash
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

### "ENOENT: no such file or directory"

**Solution:** File or directory doesn't exist. Check paths and create if needed.

```bash
mkdir -p keys/
truxe keys generate
```

### "EADDRINUSE: address already in use"

**Solution:** Port is already in use. Use different port or kill existing process.

```bash
truxe ports kill 3001
# or
truxe dev --port=3002
```

### "ECONNREFUSED: connection refused"

**Solution:** Cannot connect to database or service. Check if service is running.

```bash
truxe health --check-db
# Start database if needed
docker-compose up -d postgres
```

---

**Still having issues?** Join our [Discord community](https://discord.gg/truxe) or open a [GitHub issue](https://github.com/truxeio/truxe/issues).


# Port Migration Scripts

Automated scripts for migrating Truxe from 21XXX to 87XXX port range.

## Scripts Overview

### 1. Pre-Migration Checker (`check-port-migration.sh`)

Validates system readiness before migration.

**Usage:**
```bash
./scripts/check-port-migration.sh
```

**Checks:**
- Required tools (sed, grep, lsof, docker)
- Current port configuration
- New port availability (87XXX range)
- Running services
- Backup directory capability
- File permissions
- Docker Compose validity

**Exit Codes:**
- `0` - Ready for migration
- `1` - Blockers found (cannot migrate)
- `2` - Warnings found (can migrate with caution)

---

### 2. Port Migration (`migrate-ports.sh`)

Automated migration from 21XXX to 87XXX ports.

**Usage:**
```bash
# Preview changes (recommended first)
./scripts/migrate-ports.sh --dry-run

# Run migration with backup
./scripts/migrate-ports.sh

# Run without backup (not recommended)
./scripts/migrate-ports.sh --skip-backup

# Force migration even if services are running
./scripts/migrate-ports.sh --force
```

**Options:**
- `-d, --dry-run` - Show changes without applying
- `-s, --skip-backup` - Skip backup creation
- `-f, --force` - Force migration despite running services
- `-h, --help` - Show help

**What it does:**
1. Creates timestamped backup in `backups/port-migration-YYYYMMDD-HHMMSS/`
2. Updates `.env` files (api/.env, root .env, env.*)
3. Updates Docker Compose files
4. Updates configuration files
5. Verifies migration success

**Port Mappings:**
```
21001 → 87001 (API)
21432 → 87032 (PostgreSQL)
21379 → 87079 (Redis)
21025 → 87025 (MailHog SMTP)
21825 → 87825 (MailHog Web)
21004 → 87004 (Grafana)
21005 → 87005 (Prometheus)
21080 → 87080 (Port Monitor)
21081 → 87081 (Traefik Dashboard)
21500 → 87500 (Consul)
```

---

### 3. Port Validation (`validate-ports.sh`)

Validates port configuration after migration.

**Usage:**
```bash
# Full validation
./scripts/validate-ports.sh

# Verbose output
./scripts/validate-ports.sh --verbose

# Only check configuration files
./scripts/validate-ports.sh --config-only

# Only check Docker configuration
./scripts/validate-ports.sh --docker-only

# Skip port availability checks
./scripts/validate-ports.sh --skip-availability
```

**Options:**
- `-v, --verbose` - Show detailed output
- `-s, --skip-availability` - Skip port availability checks
- `-c, --config-only` - Only validate configuration files
- `-d, --docker-only` - Only validate Docker configuration
- `-h, --help` - Show help

**Checks:**
- Port availability
- Configuration files (no old ports)
- Docker Compose port mappings
- Port mapping format (custom:standard)
- Configuration consistency across files

**Exit Codes:**
- `0` - All validations passed
- `1` - Critical errors found
- `2` - Warnings found (non-critical)

---

### 4. Port Rollback (`rollback-ports.sh`)

Restores configuration from backup.

**Usage:**
```bash
# Rollback from specific backup
./scripts/rollback-ports.sh backups/port-migration-20251107-143022

# Rollback from latest backup
./scripts/rollback-ports.sh $(ls -t backups/ | grep port-migration | head -1)

# Force rollback even if services are running
./scripts/rollback-ports.sh --force backups/port-migration-20251107-143022
```

**Options:**
- `-f, --force` - Force rollback despite running services
- `-h, --help` - Show help

**What it does:**
1. Verifies backup directory exists
2. Checks for running services
3. Restores all files from backup
4. Verifies restoration success

---

## Complete Migration Workflow

### Step 1: Pre-Migration Check

```bash
# Run pre-migration checker
./scripts/check-port-migration.sh

# If any blockers found, fix them first
# Example: Stop services
docker-compose down
```

### Step 2: Preview Migration

```bash
# Run in dry-run mode to see what will change
./scripts/migrate-ports.sh --dry-run

# Review the output carefully
```

### Step 3: Backup (Optional Manual)

```bash
# Create manual backup (script does this automatically)
cp api/.env api/.env.backup.manual
cp docker-compose.yml docker-compose.yml.backup.manual
```

### Step 4: Run Migration

```bash
# Run actual migration (creates automatic backup)
./scripts/migrate-ports.sh

# Script will display:
# - Backup location
# - Files updated
# - Verification results
```

### Step 5: Validate Migration

```bash
# Validate port configuration
./scripts/validate-ports.sh

# Check for any errors or warnings
```

### Step 6: Test Services

```bash
# Start services with new ports
docker-compose up -d

# Test API
curl http://localhost:87001/health

# Test database
psql postgresql://truxe:password@localhost:87032/truxe.io -c "SELECT 1"

# Test Redis
redis-cli -p 87079 ping
```

### Step 7: Rollback (If Needed)

```bash
# If issues occur, rollback to previous configuration
./scripts/rollback-ports.sh backups/port-migration-YYYYMMDD-HHMMSS

# Restart services
docker-compose up -d
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find what's using the port
lsof -i :87001

# Kill the process
kill -9 <PID>

# Or use fuser (if available)
fuser -k 87001/tcp
```

### Permission Denied

```bash
# Check file permissions
ls -la api/.env
ls -la docker-compose.yml

# Fix permissions if needed
chmod 644 api/.env
chmod 644 docker-compose.yml
```

### Migration Script Fails

```bash
# Run with verbose dry-run to see what would happen
./scripts/migrate-ports.sh --dry-run

# Check logs
./scripts/check-port-migration.sh

# Manual rollback if automatic backup failed
cp api/.env.backup.manual api/.env
```

### Services Won't Start

```bash
# Check Docker logs
docker-compose logs api
docker-compose logs database
docker-compose logs redis

# Verify port configuration
./scripts/validate-ports.sh --verbose

# Check if ports are available
./scripts/check-port-migration.sh
```

---

## Advanced Usage

### Custom Backup Location

```bash
# Modify BACKUP_DIR in migrate-ports.sh
BACKUP_DIR="/custom/backup/path/port-migration-$(date +%Y%m%d-%H%M%S)"
```

### Selective File Migration

```bash
# Edit migrate-ports.sh to comment out sections
# For example, skip Docker Compose migration:
# migrate_docker_compose  # Comment this out
```

### Add Custom Port Mappings

Edit `migrate-ports.sh` and add to the `PORT_MAP` array:

```bash
declare -A PORT_MAP=(
    ["21001"]="87001"
    ["21432"]="87032"
    # Add your custom mappings here
    ["21999"]="87999"
)
```

---

## Safety Features

### Automatic Backup
- Created before any changes
- Timestamped directory
- Includes all modified files
- Can be used for rollback

### Dry Run Mode
- Preview changes without applying
- Safe to run multiple times
- Shows exactly what will change

### Verification
- Checks for old ports after migration
- Validates configuration consistency
- Reports any issues found

### Service Check
- Detects running services
- Warns before proceeding
- Prevents conflicts

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Port Migration

on:
  workflow_dispatch:

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Check migration readiness
        run: ./scripts/check-port-migration.sh

      - name: Run migration
        run: ./scripts/migrate-ports.sh

      - name: Validate migration
        run: ./scripts/validate-ports.sh

      - name: Archive backup
        uses: actions/upload-artifact@v3
        with:
          name: port-migration-backup
          path: backups/port-migration-*
```

### GitLab CI

```yaml
port-migration:
  stage: deploy
  script:
    - ./scripts/check-port-migration.sh
    - ./scripts/migrate-ports.sh
    - ./scripts/validate-ports.sh
  artifacts:
    paths:
      - backups/port-migration-*
    expire_in: 30 days
  when: manual
```

---

## File Permissions

All scripts require execute permissions:

```bash
chmod +x scripts/check-port-migration.sh
chmod +x scripts/migrate-ports.sh
chmod +x scripts/validate-ports.sh
chmod +x scripts/rollback-ports.sh
```

---

## Dependencies

### Required:
- `bash` (4.0+)
- `sed`
- `grep`

### Recommended:
- `lsof` (for port checks)
- `docker` (for container checks)
- `docker-compose` (for validation)

### Optional:
- `psql` (for database testing)
- `redis-cli` (for Redis testing)
- `curl` (for API testing)

---

## Documentation

For more detailed information:
- [Port Migration Guide](../docs/deployment/PORT_MIGRATION_GUIDE.md)
- [Port Standardization Plan](../docs/deployment/PORT_STANDARDIZATION_PLAN.md)
- [Port Mapping Strategy](../docs/deployment/PORT_MAPPING_STRATEGY.md)

---

## Support

If you encounter issues:

1. Run diagnostic scripts:
   ```bash
   ./scripts/check-port-migration.sh
   ./scripts/validate-ports.sh --verbose
   ```

2. Check logs:
   ```bash
   docker-compose logs -f
   ```

3. Review documentation:
   - [Troubleshooting Guide](../docs/deployment/PORT_MIGRATION_GUIDE.md#troubleshooting)

4. Report issues:
   - [GitHub Issues](https://github.com/truxe-auth/truxe/issues)

---

**Version**: 1.0.0
**Last Updated**: 2025-11-07
**Maintainer**: Truxe Team

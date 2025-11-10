#!/bin/bash

# Truxe Port Migration Script
# Migrates from 21XXX port range to 87XXX port range
# Version: 1.0.0
# Date: 2025-11-07

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups/port-migration-$(date +%Y%m%d-%H%M%S)"
DRY_RUN=false
SKIP_BACKUP=false
FORCE=false

# Port mappings (old -> new)
declare -A PORT_MAP=(
    ["21001"]="87001"  # API
    ["21432"]="87032"  # PostgreSQL
    ["21379"]="87079"  # Redis
    ["21025"]="87025"  # MailHog SMTP
    ["21825"]="87825"  # MailHog Web
    ["21004"]="87004"  # Grafana
    ["21005"]="87005"  # Prometheus
    ["21080"]="87080"  # Port Monitor
    ["21081"]="87081"  # Traefik Dashboard
    ["21500"]="87500"  # Consul
)

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Show usage
show_usage() {
    cat << EOF
Truxe Port Migration Script v1.0.0

Usage: $0 [OPTIONS]

Migrates Truxe from 21XXX port range to 87XXX port range.

Options:
    -d, --dry-run           Show what would be changed without making changes
    -s, --skip-backup       Skip creating backup files
    -f, --force             Force migration even if services are running
    -h, --help              Show this help message

Examples:
    # Preview changes without applying
    $0 --dry-run

    # Run migration with backup
    $0

    # Run migration without backup (not recommended)
    $0 --skip-backup

    # Force migration even if services are running
    $0 --force

Port Mappings:
    21001 -> 87001 (API)
    21432 -> 87032 (PostgreSQL)
    21379 -> 87079 (Redis)
    21025 -> 87025 (MailHog SMTP)
    21825 -> 87825 (MailHog Web)
    21004 -> 87004 (Grafana)
    21005 -> 87005 (Prometheus)

Documentation:
    See docs/deployment/PORT_MIGRATION_GUIDE.md for detailed instructions.

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -s|--skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Check if services are running
check_services() {
    log_step "Checking if Truxe services are running..."

    local services_running=false

    # Check for Docker containers
    if command -v docker &> /dev/null; then
        if docker ps --filter "name=truxe" --format "{{.Names}}" | grep -q "truxe"; then
            log_warning "Truxe Docker containers are running"
            services_running=true
        fi
    fi

    # Check for processes using old ports
    for old_port in "${!PORT_MAP[@]}"; do
        if lsof -i ":$old_port" &> /dev/null; then
            log_warning "Port $old_port is in use"
            services_running=true
        fi
    done

    if [ "$services_running" = true ]; then
        if [ "$FORCE" = false ]; then
            log_error "Services are running. Please stop them first or use --force flag."
            echo ""
            echo "To stop services:"
            echo "  docker-compose down"
            echo ""
            echo "Or run with --force to continue anyway:"
            echo "  $0 --force"
            exit 1
        else
            log_warning "Continuing with migration despite running services (--force)"
        fi
    else
        log_success "No running services detected"
    fi
}

# Create backup
create_backup() {
    if [ "$SKIP_BACKUP" = true ]; then
        log_warning "Skipping backup creation (--skip-backup)"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would create backup in: $BACKUP_DIR"
        return 0
    fi

    log_step "Creating backup..."

    mkdir -p "$BACKUP_DIR"

    # Backup .env files
    if [ -f "$PROJECT_ROOT/api/.env" ]; then
        cp "$PROJECT_ROOT/api/.env" "$BACKUP_DIR/api.env.backup"
        log_success "Backed up api/.env"
    fi

    if [ -f "$PROJECT_ROOT/.env" ]; then
        cp "$PROJECT_ROOT/.env" "$BACKUP_DIR/root.env.backup"
        log_success "Backed up .env"
    fi

    # Backup docker-compose files
    for compose_file in docker-compose*.yml docker-compose*.yaml; do
        if [ -f "$PROJECT_ROOT/$compose_file" ]; then
            cp "$PROJECT_ROOT/$compose_file" "$BACKUP_DIR/$compose_file.backup"
            log_success "Backed up $compose_file"
        fi
    done

    # Backup environment files
    for env_file in env.* .env.*; do
        if [ -f "$PROJECT_ROOT/$env_file" ]; then
            cp "$PROJECT_ROOT/$env_file" "$BACKUP_DIR/${env_file}.backup"
            log_success "Backed up $env_file"
        fi
    done

    log_success "Backup created in: $BACKUP_DIR"
    echo ""
}

# Migrate a single file
migrate_file() {
    local file="$1"
    local changes_made=false

    if [ ! -f "$file" ]; then
        return 0
    fi

    # Create temp file
    local temp_file="${file}.tmp"
    cp "$file" "$temp_file"

    # Apply port replacements
    for old_port in "${!PORT_MAP[@]}"; do
        local new_port="${PORT_MAP[$old_port]}"

        if grep -q "$old_port" "$temp_file"; then
            sed -i.bak "s/${old_port}/${new_port}/g" "$temp_file"
            changes_made=true
            log_info "  Replaced $old_port -> $new_port"
        fi
    done

    if [ "$changes_made" = true ]; then
        if [ "$DRY_RUN" = false ]; then
            mv "$temp_file" "$file"
            rm -f "${temp_file}.bak"
            log_success "Updated: $file"
        else
            log_info "[DRY RUN] Would update: $file"
            rm -f "$temp_file" "${temp_file}.bak"
        fi
        return 0
    else
        rm -f "$temp_file" "${temp_file}.bak"
        return 1
    fi
}

# Migrate environment files
migrate_env_files() {
    log_step "Migrating environment files..."

    local files_updated=0

    # Migrate api/.env
    if migrate_file "$PROJECT_ROOT/api/.env"; then
        ((files_updated++))
    fi

    # Migrate root .env
    if migrate_file "$PROJECT_ROOT/.env"; then
        ((files_updated++))
    fi

    # Migrate environment-specific files
    for env_file in "$PROJECT_ROOT"/env.* "$PROJECT_ROOT"/.env.*; do
        if [ -f "$env_file" ]; then
            if migrate_file "$env_file"; then
                ((files_updated++))
            fi
        fi
    done

    if [ $files_updated -eq 0 ]; then
        log_warning "No environment files needed migration"
    else
        log_success "Migrated $files_updated environment file(s)"
    fi
    echo ""
}

# Migrate Docker Compose files
migrate_docker_compose() {
    log_step "Migrating Docker Compose files..."

    local files_updated=0

    for compose_file in "$PROJECT_ROOT"/docker-compose*.yml "$PROJECT_ROOT"/docker-compose*.yaml; do
        if [ -f "$compose_file" ]; then
            if migrate_file "$compose_file"; then
                ((files_updated++))
            fi
        fi
    done

    if [ $files_updated -eq 0 ]; then
        log_warning "No Docker Compose files needed migration"
    else
        log_success "Migrated $files_updated Docker Compose file(s)"
    fi
    echo ""
}

# Migrate configuration files
migrate_config_files() {
    log_step "Migrating configuration files..."

    local files=(
        "$PROJECT_ROOT/config/ports.js"
        "$PROJECT_ROOT/api/src/config/constants.js"
        "$PROJECT_ROOT/api/src/config/index.js"
    )

    local files_updated=0

    for file in "${files[@]}"; do
        if migrate_file "$file"; then
            ((files_updated++))
        fi
    done

    if [ $files_updated -eq 0 ]; then
        log_warning "No configuration files needed migration"
    else
        log_success "Migrated $files_updated configuration file(s)"
    fi
    echo ""
}

# Verify migration
verify_migration() {
    log_step "Verifying migration..."

    local old_ports_found=false

    # Check for remaining old ports in critical files
    local files_to_check=(
        "$PROJECT_ROOT/api/.env"
        "$PROJECT_ROOT/.env"
        "$PROJECT_ROOT/docker-compose.yml"
    )

    for file in "${files_to_check[@]}"; do
        if [ -f "$file" ]; then
            for old_port in "${!PORT_MAP[@]}"; do
                if grep -q "$old_port" "$file"; then
                    log_warning "Old port $old_port still found in $file"
                    old_ports_found=true
                fi
            done
        fi
    done

    if [ "$old_ports_found" = false ]; then
        log_success "Verification passed - no old ports found in critical files"
    else
        log_warning "Some old ports still remain - manual review recommended"
    fi
    echo ""
}

# Show summary
show_summary() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}Migration Summary${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}Mode:${NC} DRY RUN (no changes made)"
    else
        echo -e "${GREEN}Mode:${NC} LIVE (changes applied)"
    fi

    if [ "$SKIP_BACKUP" = false ] && [ "$DRY_RUN" = false ]; then
        echo -e "${GREEN}Backup:${NC} Created in $BACKUP_DIR"
    fi

    echo ""
    echo "Port Migrations Applied:"
    for old_port in "${!PORT_MAP[@]}"; do
        echo "  $old_port → ${PORT_MAP[$old_port]}"
    done

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ "$DRY_RUN" = false ]; then
        echo ""
        echo "Next steps:"
        echo "  1. Review the changes in your configuration files"
        echo "  2. Start services: docker-compose up -d"
        echo "  3. Verify services: curl http://localhost:87001/health"
        echo "  4. Test database: psql postgresql://...@localhost:87032/..."
        echo "  5. Test Redis: redis-cli -p 87079 ping"
        echo ""
        echo "If issues occur, restore from backup:"
        echo "  cp $BACKUP_DIR/api.env.backup api/.env"
        echo "  docker-compose up -d"
        echo ""
        echo "Documentation:"
        echo "  See docs/deployment/PORT_MIGRATION_GUIDE.md"
    else
        echo ""
        echo "This was a DRY RUN. To apply changes, run without --dry-run flag:"
        echo "  $0"
    fi

    echo ""
}

# Rollback migration
rollback_migration() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi

    log_step "Rolling back migration..."

    # Restore files from backup
    for backup_file in "$BACKUP_DIR"/*.backup; do
        if [ -f "$backup_file" ]; then
            original_file=$(basename "$backup_file" .backup)
            target_path="$PROJECT_ROOT/$original_file"

            if [[ "$original_file" == "api.env.backup" ]]; then
                target_path="$PROJECT_ROOT/api/.env"
            elif [[ "$original_file" == "root.env.backup" ]]; then
                target_path="$PROJECT_ROOT/.env"
            fi

            cp "$backup_file" "$target_path"
            log_success "Restored: $target_path"
        fi
    done

    log_success "Rollback complete"
}

# Main execution
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Truxe Port Migration Script${NC}"
    echo -e "${CYAN}Version 1.0.0${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        log_info "Running in DRY RUN mode - no changes will be made"
        echo ""
    fi

    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/package.json" ] && [ ! -f "$PROJECT_ROOT/api/package.json" ]; then
        log_error "Not in Truxe project root directory"
        exit 1
    fi

    # Pre-flight checks
    check_services

    # Create backup
    create_backup

    # Run migrations
    migrate_env_files
    migrate_docker_compose
    migrate_config_files

    # Verify
    if [ "$DRY_RUN" = false ]; then
        verify_migration
    fi

    # Show summary
    show_summary

    if [ "$DRY_RUN" = false ]; then
        log_success "Migration completed successfully!"
    else
        log_info "Dry run completed. No changes were made."
    fi
}

# Parse arguments and run
parse_args "$@"
main

exit 0

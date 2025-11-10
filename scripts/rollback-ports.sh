#!/bin/bash

# Truxe Port Rollback Script
# Restores port configuration from backup
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
BACKUP_DIR=""
FORCE=false

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Show usage
show_usage() {
    cat << EOF
Truxe Port Rollback Script v1.0.0

Usage: $0 [OPTIONS] <backup_directory>

Restores port configuration from a backup directory.

Arguments:
    <backup_directory>      Path to backup directory created by migrate-ports.sh

Options:
    -f, --force            Force rollback even if services are running
    -h, --help             Show this help message

Examples:
    # Restore from specific backup
    $0 backups/port-migration-20251107-143022

    # Restore from latest backup
    $0 \$(ls -t backups/ | grep port-migration | head -1)

    # Force rollback
    $0 --force backups/port-migration-20251107-143022

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                FORCE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                BACKUP_DIR="$1"
                shift
                ;;
        esac
    done

    if [ -z "$BACKUP_DIR" ]; then
        log_error "Backup directory not specified"
        show_usage
        exit 1
    fi

    # Convert to absolute path if relative
    if [[ ! "$BACKUP_DIR" =~ ^/ ]]; then
        BACKUP_DIR="$PROJECT_ROOT/$BACKUP_DIR"
    fi
}

# Check if services are running
check_services() {
    log_info "Checking if Truxe services are running..."

    local services_running=false

    # Check for Docker containers
    if command -v docker &> /dev/null; then
        if docker ps --filter "name=truxe" --format "{{.Names}}" | grep -q "truxe"; then
            log_warning "Truxe Docker containers are running"
            services_running=true
        fi
    fi

    if [ "$services_running" = true ]; then
        if [ "$FORCE" = false ]; then
            log_error "Services are running. Please stop them first or use --force flag."
            echo ""
            echo "To stop services:"
            echo "  docker-compose down"
            echo ""
            echo "Or run with --force to continue anyway:"
            echo "  $0 --force $BACKUP_DIR"
            exit 1
        else
            log_warning "Continuing with rollback despite running services (--force)"
        fi
    else
        log_success "No running services detected"
    fi
}

# Verify backup directory
verify_backup() {
    log_info "Verifying backup directory..."

    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi

    # Check if backup contains expected files
    local backup_files=$(ls -1 "$BACKUP_DIR"/*.backup 2>/dev/null | wc -l)

    if [ "$backup_files" -eq 0 ]; then
        log_error "No backup files found in: $BACKUP_DIR"
        exit 1
    fi

    log_success "Found $backup_files backup file(s)"
}

# Restore files
restore_files() {
    log_info "Restoring files from backup..."

    local files_restored=0

    # Restore each backup file
    for backup_file in "$BACKUP_DIR"/*.backup; do
        if [ ! -f "$backup_file" ]; then
            continue
        fi

        local filename=$(basename "$backup_file" .backup)
        local target_path=""

        # Determine target path based on filename
        case "$filename" in
            api.env.backup)
                target_path="$PROJECT_ROOT/api/.env"
                ;;
            root.env.backup)
                target_path="$PROJECT_ROOT/.env"
                ;;
            docker-compose*.yml.backup)
                local compose_name=$(echo "$filename" | sed 's/.backup$//')
                target_path="$PROJECT_ROOT/$compose_name"
                ;;
            docker-compose*.yaml.backup)
                local compose_name=$(echo "$filename" | sed 's/.backup$//')
                target_path="$PROJECT_ROOT/$compose_name"
                ;;
            env.*.backup)
                local env_name=$(echo "$filename" | sed 's/.backup$//')
                target_path="$PROJECT_ROOT/$env_name"
                ;;
            .env.*.backup)
                local env_name=$(echo "$filename" | sed 's/.backup$//')
                target_path="$PROJECT_ROOT/$env_name"
                ;;
            *)
                # Try to restore to same path
                target_path="$PROJECT_ROOT/$filename"
                ;;
        esac

        if [ -n "$target_path" ]; then
            # Create parent directory if needed
            local target_dir=$(dirname "$target_path")
            mkdir -p "$target_dir"

            # Restore file
            cp "$backup_file" "$target_path"
            log_success "Restored: $(basename "$target_path")"
            ((files_restored++))
        else
            log_warning "Skipped unknown backup file: $filename"
        fi
    done

    log_success "Restored $files_restored file(s)"
}

# Verify restoration
verify_restoration() {
    log_info "Verifying restoration..."

    # Check if old ports are back
    local old_ports_found=false

    if [ -f "$PROJECT_ROOT/api/.env" ]; then
        if grep -q "21001\|21432\|21379" "$PROJECT_ROOT/api/.env"; then
            old_ports_found=true
            log_success "Old port configuration restored in api/.env"
        fi
    fi

    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        if grep -q "21001\|21432\|21379" "$PROJECT_ROOT/docker-compose.yml"; then
            old_ports_found=true
            log_success "Old port configuration restored in docker-compose.yml"
        fi
    fi

    if [ "$old_ports_found" = false ]; then
        log_warning "Could not verify port restoration - manual check recommended"
    fi
}

# Show summary
show_summary() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}Rollback Summary${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Backup Directory: $BACKUP_DIR"
    echo "Restoration:      Complete"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Next steps:"
    echo "  1. Start services: docker-compose up -d"
    echo "  2. Verify services are working with old ports"
    echo "  3. If issues persist, check logs: docker-compose logs"
    echo ""
    echo "Port configuration has been rolled back to use 21XXX range."
    echo "To migrate again, run: ./scripts/migrate-ports.sh"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Truxe Port Rollback${NC}"
    echo -e "${CYAN}Version 1.0.0${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/package.json" ] && [ ! -f "$PROJECT_ROOT/api/package.json" ]; then
        log_error "Not in Truxe project root directory"
        exit 1
    fi

    # Verify backup
    verify_backup

    # Check services
    check_services

    # Confirm rollback
    if [ "$FORCE" = false ]; then
        echo ""
        log_warning "This will restore configuration from: $BACKUP_DIR"
        read -p "Continue with rollback? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Rollback cancelled"
            exit 0
        fi
    fi

    # Perform rollback
    echo ""
    restore_files
    verify_restoration

    # Show summary
    show_summary

    log_success "Rollback completed successfully!"
}

# Parse arguments and run
parse_args "$@"
main

exit 0

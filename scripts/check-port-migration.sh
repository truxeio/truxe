#!/bin/bash

# Truxe Pre-Migration Checker
# Checks system readiness for port migration
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

# Statistics
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0
BLOCKERS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((PASSED_CHECKS++))
}

log_error() {
    echo -e "${RED}[✗ BLOCKER]${NC} $1"
    ((FAILED_CHECKS++))
    ((BLOCKERS++))
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
    ((WARNINGS++))
}

# Show usage
show_usage() {
    cat << EOF
Truxe Pre-Migration Checker v1.0.0

Usage: $0 [OPTIONS]

Checks if the system is ready for port migration from 21XXX to 87XXX.

Options:
    -h, --help              Show this help message

This script checks:
    - Current port configuration
    - Port availability
    - Running services
    - Backup directory availability
    - Required tools
    - File permissions

Exit Codes:
    0 - Ready for migration
    1 - Blockers found (cannot migrate)
    2 - Warnings found (can migrate with caution)

EOF
}

# Check if required tools are installed
check_required_tools() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Required Tools Check${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    ((TOTAL_CHECKS++))
    if command -v lsof &> /dev/null; then
        log_success "lsof is installed"
    else
        log_warning "lsof not found - port availability checks will be skipped"
    fi

    ((TOTAL_CHECKS++))
    if command -v docker &> /dev/null; then
        log_success "docker is installed"
    else
        log_warning "docker not found - Docker checks will be skipped"
    fi

    ((TOTAL_CHECKS++))
    if command -v docker-compose &> /dev/null; then
        log_success "docker-compose is installed"
    else
        log_warning "docker-compose not found - Docker Compose checks will be skipped"
    fi

    ((TOTAL_CHECKS++))
    if command -v sed &> /dev/null; then
        log_success "sed is installed"
    else
        log_error "sed not found - required for migration"
    fi

    ((TOTAL_CHECKS++))
    if command -v grep &> /dev/null; then
        log_success "grep is installed"
    else
        log_error "grep not found - required for migration"
    fi
}

# Check current port configuration
check_current_ports() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Current Port Configuration${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local old_ports_found=false
    local new_ports_found=false

    # Check for old ports in .env
    if [ -f "$PROJECT_ROOT/api/.env" ]; then
        if grep -q "21001\|21432\|21379" "$PROJECT_ROOT/api/.env"; then
            old_ports_found=true
            log_info "Old ports (21XXX) found in api/.env - migration needed"
        fi

        if grep -q "87001\|87032\|87079" "$PROJECT_ROOT/api/.env"; then
            new_ports_found=true
            log_info "New ports (87XXX) found in api/.env"
        fi
    fi

    ((TOTAL_CHECKS++))
    if [ "$old_ports_found" = true ] && [ "$new_ports_found" = false ]; then
        log_success "Using old port configuration - ready for migration"
    elif [ "$old_ports_found" = false ] && [ "$new_ports_found" = true ]; then
        log_warning "Already using new port configuration - migration may not be needed"
    elif [ "$old_ports_found" = true ] && [ "$new_ports_found" = true ]; then
        log_warning "Mixed port configuration detected - manual review recommended"
    else
        log_warning "No port configuration found - may need manual setup"
    fi
}

# Check if new ports are available
check_new_port_availability() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}New Port Availability (87XXX Range)${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if ! command -v lsof &> /dev/null; then
        log_warning "lsof not available - skipping port checks"
        return 0
    fi

    local new_ports=("87001" "87032" "87079" "87025" "87825")
    local conflicts=0

    for port in "${new_ports[@]}"; do
        ((TOTAL_CHECKS++))
        if lsof -i ":$port" &> /dev/null; then
            local process=$(lsof -i ":$port" -t 2>/dev/null | head -1)
            local process_name=$(ps -p "$process" -o comm= 2>/dev/null || echo "unknown")
            log_error "Port $port is already in use by $process_name (PID: $process)"
            ((conflicts++))
        else
            log_success "Port $port is available"
        fi
    done

    if [ $conflicts -gt 0 ]; then
        echo ""
        log_error "Port conflicts detected - free these ports before migration"
        echo ""
        echo "To find what's using a port:"
        echo "  lsof -i :87001"
        echo ""
        echo "To kill a process:"
        echo "  kill -9 <PID>"
    fi
}

# Check running services
check_running_services() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Running Services Check${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    ((TOTAL_CHECKS++))
    if command -v docker &> /dev/null; then
        if docker ps --filter "name=truxe" --format "{{.Names}}" | grep -q "truxe"; then
            log_warning "Truxe Docker containers are running - should be stopped before migration"
            docker ps --filter "name=truxe" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
            echo ""
            log_info "To stop services: docker-compose down"
        else
            log_success "No Truxe Docker containers running"
        fi
    else
        log_info "Docker not available - skipping container check"
    fi
}

# Check backup directory
check_backup_capability() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Backup Directory Check${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local backup_root="$PROJECT_ROOT/backups"

    ((TOTAL_CHECKS++))
    if [ -d "$backup_root" ]; then
        log_success "Backup directory exists: $backup_root"
    else
        if mkdir -p "$backup_root" 2>/dev/null; then
            log_success "Created backup directory: $backup_root"
        else
            log_error "Cannot create backup directory: $backup_root"
        fi
    fi

    ((TOTAL_CHECKS++))
    if [ -w "$backup_root" ]; then
        log_success "Backup directory is writable"
    else
        log_error "Backup directory is not writable: $backup_root"
    fi

    # Check disk space
    ((TOTAL_CHECKS++))
    local available_space=$(df -k "$backup_root" | awk 'NR==2 {print $4}')
    if [ "$available_space" -gt 10240 ]; then  # 10MB minimum
        log_success "Sufficient disk space available ($(($available_space / 1024))MB)"
    else
        log_warning "Low disk space available ($(($available_space / 1024))MB)"
    fi
}

# Check file permissions
check_file_permissions() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}File Permissions Check${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local files_to_check=(
        "$PROJECT_ROOT/api/.env"
        "$PROJECT_ROOT/.env"
        "$PROJECT_ROOT/docker-compose.yml"
    )

    for file in "${files_to_check[@]}"; do
        if [ -f "$file" ]; then
            ((TOTAL_CHECKS++))
            if [ -w "$file" ]; then
                log_success "$(basename "$file") is writable"
            else
                log_error "$(basename "$file") is not writable - permission issue"
            fi
        fi
    done
}

# Check Docker Compose validity
check_docker_compose_validity() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Docker Compose Configuration${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if ! command -v docker-compose &> /dev/null; then
        log_info "docker-compose not available - skipping validation"
        return 0
    fi

    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        ((TOTAL_CHECKS++))
        if docker-compose -f "$PROJECT_ROOT/docker-compose.yml" config > /dev/null 2>&1; then
            log_success "docker-compose.yml syntax is valid"
        else
            log_error "docker-compose.yml has syntax errors"
        fi
    else
        log_warning "docker-compose.yml not found"
    fi
}

# Show migration readiness summary
show_summary() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Migration Readiness Summary${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Total Checks:    $TOTAL_CHECKS"
    echo -e "Passed:          ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Blockers:        ${RED}$BLOCKERS${NC}"
    echo -e "Warnings:        ${YELLOW}$WARNINGS${NC}"
    echo ""

    if [ $BLOCKERS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ System is ready for migration!${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Review the migration plan: docs/deployment/PORT_MIGRATION_GUIDE.md"
        echo "  2. Stop services: docker-compose down"
        echo "  3. Run migration: ./scripts/migrate-ports.sh"
        echo "  4. Or preview changes: ./scripts/migrate-ports.sh --dry-run"
        return 0
    elif [ $BLOCKERS -eq 0 ]; then
        echo -e "${YELLOW}⚠ System can migrate with caution${NC}"
        echo ""
        echo "Some warnings were found. Review them above and proceed if acceptable."
        echo ""
        echo "To proceed:"
        echo "  1. Address warnings if critical"
        echo "  2. Stop services: docker-compose down"
        echo "  3. Run migration: ./scripts/migrate-ports.sh"
        return 2
    else
        echo -e "${RED}✗ System is NOT ready for migration${NC}"
        echo ""
        echo "Critical blockers must be resolved before migration:"
        echo ""
        echo "Common fixes:"
        echo "  - Free up new ports (87XXX range)"
        echo "  - Install required tools (sed, grep)"
        echo "  - Fix file permissions"
        echo "  - Ensure backup directory is writable"
        echo "  - Fix Docker Compose syntax errors"
        echo ""
        echo "After fixing blockers, run this check again:"
        echo "  ./scripts/check-port-migration.sh"
        return 1
    fi
}

# Main execution
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Truxe Pre-Migration Checker${NC}"
    echo -e "${CYAN}Version 1.0.0${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/package.json" ] && [ ! -f "$PROJECT_ROOT/api/package.json" ]; then
        log_error "Not in Truxe project root directory"
        exit 1
    fi

    # Run checks
    check_required_tools
    check_current_ports
    check_new_port_availability
    check_running_services
    check_backup_capability
    check_file_permissions
    check_docker_compose_validity

    # Show summary and return appropriate exit code
    show_summary
    local exit_code=$?

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    exit $exit_code
}

# Parse arguments
if [ $# -gt 0 ]; then
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
fi

main

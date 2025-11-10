#!/bin/bash

# Truxe Port Validation Script
# Validates port configuration and checks for conflicts
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
VERBOSE=false
CHECK_AVAILABILITY=true
CHECK_CONFIG=true
CHECK_DOCKER=true

# Expected ports for 87XXX range
declare -A EXPECTED_PORTS=(
    ["API"]="87001"
    ["PostgreSQL"]="87032"
    ["Redis"]="87079"
    ["MailHog_SMTP"]="87025"
    ["MailHog_Web"]="87825"
    ["Grafana"]="87004"
    ["Prometheus"]="87005"
    ["Monitor"]="87080"
    ["Traefik"]="87081"
    ["Consul"]="87500"
)

# Old ports that should not be present
declare -a OLD_PORTS=(
    "21001"
    "21432"
    "21379"
    "21025"
    "21825"
    "21004"
    "21005"
    "21080"
    "21081"
    "21500"
)

# Statistics
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((PASSED_CHECKS++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((FAILED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
    ((WARNINGS++))
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

# Show usage
show_usage() {
    cat << EOF
Truxe Port Validation Script v1.0.0

Usage: $0 [OPTIONS]

Validates Truxe port configuration and checks for conflicts.

Options:
    -v, --verbose           Show detailed validation output
    -s, --skip-availability Skip port availability checks
    -c, --config-only       Only validate configuration files
    -d, --docker-only       Only validate Docker configuration
    -h, --help              Show this help message

Examples:
    # Run full validation
    $0

    # Verbose output
    $0 --verbose

    # Only check configuration files
    $0 --config-only

    # Skip port availability checks
    $0 --skip-availability

Exit Codes:
    0 - All validations passed
    1 - Critical errors found
    2 - Warnings found (non-critical)

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -s|--skip-availability)
                CHECK_AVAILABILITY=false
                shift
                ;;
            -c|--config-only)
                CHECK_DOCKER=false
                CHECK_AVAILABILITY=false
                shift
                ;;
            -d|--docker-only)
                CHECK_CONFIG=false
                CHECK_AVAILABILITY=false
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

# Check if port is in use
check_port_in_use() {
    local port=$1
    local service_name=$2

    ((TOTAL_CHECKS++))

    if lsof -i ":$port" &> /dev/null; then
        local process=$(lsof -i ":$port" -t 2>/dev/null | head -1)
        if [ -n "$process" ]; then
            local process_name=$(ps -p "$process" -o comm= 2>/dev/null || echo "unknown")
            log_warning "$service_name port $port is in use by process $process ($process_name)"
            return 1
        else
            log_warning "$service_name port $port is in use"
            return 1
        fi
    else
        log_success "$service_name port $port is available"
        return 0
    fi
}

# Check port availability
check_port_availability() {
    if [ "$CHECK_AVAILABILITY" = false ]; then
        log_info "Skipping port availability checks (--skip-availability)"
        return 0
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Port Availability Check${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    for service in "${!EXPECTED_PORTS[@]}"; do
        local port="${EXPECTED_PORTS[$service]}"
        check_port_in_use "$port" "$service"
    done

    echo ""
}

# Validate environment file
validate_env_file() {
    local env_file=$1
    local file_name=$(basename "$env_file")

    if [ ! -f "$env_file" ]; then
        log_verbose "File not found: $env_file"
        return 0
    fi

    log_verbose "Checking $file_name..."

    local old_ports_found=false

    # Check for old ports
    for old_port in "${OLD_PORTS[@]}"; do
        if grep -q "$old_port" "$env_file"; then
            ((TOTAL_CHECKS++))
            log_error "Old port $old_port found in $file_name"
            old_ports_found=true
        fi
    done

    # Check for new ports
    local new_ports_found=false
    for service in "${!EXPECTED_PORTS[@]}"; do
        local port="${EXPECTED_PORTS[$service]}"
        if grep -q "$port" "$env_file"; then
            new_ports_found=true
            break
        fi
    done

    if [ "$new_ports_found" = true ] && [ "$old_ports_found" = false ]; then
        ((TOTAL_CHECKS++))
        log_success "$file_name uses correct port configuration"
    elif [ "$old_ports_found" = true ]; then
        # Error already logged above
        :
    else
        ((TOTAL_CHECKS++))
        log_warning "$file_name has no port configuration"
    fi
}

# Validate configuration files
validate_config_files() {
    if [ "$CHECK_CONFIG" = false ]; then
        log_info "Skipping configuration file checks (--docker-only)"
        return 0
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Configuration Files Validation${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Check .env files
    validate_env_file "$PROJECT_ROOT/api/.env"
    validate_env_file "$PROJECT_ROOT/.env"

    # Check environment-specific files
    for env_file in "$PROJECT_ROOT"/env.* "$PROJECT_ROOT"/.env.*; do
        if [ -f "$env_file" ]; then
            validate_env_file "$env_file"
        fi
    done

    # Check config files for hardcoded ports
    local config_files=(
        "$PROJECT_ROOT/config/ports.js"
        "$PROJECT_ROOT/api/src/config/constants.js"
        "$PROJECT_ROOT/api/src/config/index.js"
    )

    for config_file in "${config_files[@]}"; do
        if [ -f "$config_file" ]; then
            log_verbose "Checking $(basename "$config_file")..."

            local has_issues=false
            for old_port in "${OLD_PORTS[@]}"; do
                # Skip if it's in a comment
                if grep -v "^[[:space:]]*\/\/" "$config_file" | grep -v "^[[:space:]]*\*" | grep -q "$old_port"; then
                    ((TOTAL_CHECKS++))
                    log_error "Old port $old_port found in $(basename "$config_file")"
                    has_issues=true
                fi
            done

            if [ "$has_issues" = false ]; then
                ((TOTAL_CHECKS++))
                log_success "$(basename "$config_file") is correctly configured"
            fi
        fi
    done

    echo ""
}

# Validate Docker Compose configuration
validate_docker_compose() {
    if [ "$CHECK_DOCKER" = false ]; then
        log_info "Skipping Docker configuration checks (--config-only)"
        return 0
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Docker Compose Validation${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Check if docker-compose exists
    if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
        log_warning "Docker not found - skipping Docker validation"
        echo ""
        return 0
    fi

    # Find docker-compose files
    local compose_files=()
    for file in "$PROJECT_ROOT"/docker-compose*.yml "$PROJECT_ROOT"/docker-compose*.yaml; do
        if [ -f "$file" ]; then
            compose_files+=("$file")
        fi
    done

    if [ ${#compose_files[@]} -eq 0 ]; then
        log_warning "No docker-compose files found"
        echo ""
        return 0
    fi

    # Validate each compose file
    for compose_file in "${compose_files[@]}"; do
        local file_name=$(basename "$compose_file")
        log_verbose "Checking $file_name..."

        local has_issues=false

        # Check for old ports
        for old_port in "${OLD_PORTS[@]}"; do
            if grep -q "$old_port" "$compose_file"; then
                ((TOTAL_CHECKS++))
                log_error "Old port $old_port found in $file_name"
                has_issues=true
            fi
        done

        # Validate port mapping format
        if grep -E "ports:" "$compose_file" | grep -v "#" | grep -E "[0-9]+:[0-9]+" > /dev/null; then
            local port_mappings=$(grep -A 5 "ports:" "$compose_file" | grep -E "^[[:space:]]*-[[:space:]]*['\"]?[0-9]+" || true)

            if [ -n "$port_mappings" ]; then
                while IFS= read -r line; do
                    # Extract port mapping
                    local mapping=$(echo "$line" | grep -oE "[0-9]+:[0-9]+")

                    if [ -n "$mapping" ]; then
                        local external_port=$(echo "$mapping" | cut -d: -f1)
                        local internal_port=$(echo "$mapping" | cut -d: -f2)

                        # Check if using correct pattern (custom:default)
                        case $internal_port in
                            5432|6379|3001|1025|8025|9090|3000|8080)
                                ((TOTAL_CHECKS++))
                                log_success "Port mapping $mapping uses correct pattern (custom:standard)"
                                ;;
                            *)
                                ((TOTAL_CHECKS++))
                                log_warning "Port mapping $mapping uses non-standard internal port $internal_port"
                                ;;
                        esac
                    fi
                done <<< "$port_mappings"
            fi
        fi

        if [ "$has_issues" = false ]; then
            ((TOTAL_CHECKS++))
            log_success "$file_name is correctly configured"
        fi
    done

    # Validate docker-compose config if docker is available
    if command -v docker-compose &> /dev/null; then
        for compose_file in "${compose_files[@]}"; do
            log_verbose "Validating Docker Compose syntax for $(basename "$compose_file")..."

            if docker-compose -f "$compose_file" config > /dev/null 2>&1; then
                ((TOTAL_CHECKS++))
                log_success "Docker Compose syntax valid for $(basename "$compose_file")"
            else
                ((TOTAL_CHECKS++))
                log_error "Docker Compose syntax invalid for $(basename "$compose_file")"
            fi
        done
    fi

    echo ""
}

# Check for mixed port configurations
check_port_consistency() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Port Consistency Check${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local files_to_check=(
        "$PROJECT_ROOT/api/.env"
        "$PROJECT_ROOT/docker-compose.yml"
        "$PROJECT_ROOT/config/ports.js"
    )

    local api_ports=()
    local db_ports=()
    local redis_ports=()

    # Extract ports from different files
    for file in "${files_to_check[@]}"; do
        if [ -f "$file" ]; then
            # Check for API port
            if grep -E "(TRUXE_API_PORT|API.*PORT)" "$file" | grep -q "87001"; then
                api_ports+=("87001:$(basename "$file")")
            elif grep -E "(TRUXE_API_PORT|API.*PORT)" "$file" | grep -q "21001"; then
                api_ports+=("21001:$(basename "$file")")
            fi

            # Check for DB port
            if grep -E "(TRUXE_DB_PORT|DATABASE.*PORT)" "$file" | grep -q "87032"; then
                db_ports+=("87032:$(basename "$file")")
            elif grep -E "(TRUXE_DB_PORT|DATABASE.*PORT)" "$file" | grep -q "21432"; then
                db_ports+=("21432:$(basename "$file")")
            fi

            # Check for Redis port
            if grep -E "(TRUXE_REDIS_PORT|REDIS.*PORT)" "$file" | grep -q "87079"; then
                redis_ports+=("87079:$(basename "$file")")
            elif grep -E "(TRUXE_REDIS_PORT|REDIS.*PORT)" "$file" | grep -q "21379"; then
                redis_ports+=("21379:$(basename "$file")")
            fi
        fi
    done

    # Check consistency
    ((TOTAL_CHECKS++))
    if [ ${#api_ports[@]} -gt 0 ]; then
        local first_port=$(echo "${api_ports[0]}" | cut -d: -f1)
        local consistent=true

        for port_info in "${api_ports[@]}"; do
            local port=$(echo "$port_info" | cut -d: -f1)
            if [ "$port" != "$first_port" ]; then
                consistent=false
                log_error "Inconsistent API ports: ${api_ports[*]}"
                break
            fi
        done

        if [ "$consistent" = true ]; then
            log_success "API port configuration is consistent ($first_port)"
        fi
    else
        log_warning "No API port configuration found"
    fi

    ((TOTAL_CHECKS++))
    if [ ${#db_ports[@]} -gt 0 ]; then
        local first_port=$(echo "${db_ports[0]}" | cut -d: -f1)
        local consistent=true

        for port_info in "${db_ports[@]}"; do
            local port=$(echo "$port_info" | cut -d: -f1)
            if [ "$port" != "$first_port" ]; then
                consistent=false
                log_error "Inconsistent database ports: ${db_ports[*]}"
                break
            fi
        done

        if [ "$consistent" = true ]; then
            log_success "Database port configuration is consistent ($first_port)"
        fi
    else
        log_warning "No database port configuration found"
    fi

    ((TOTAL_CHECKS++))
    if [ ${#redis_ports[@]} -gt 0 ]; then
        local first_port=$(echo "${redis_ports[0]}" | cut -d: -f1)
        local consistent=true

        for port_info in "${redis_ports[@]}"; do
            local port=$(echo "$port_info" | cut -d: -f1)
            if [ "$port" != "$first_port" ]; then
                consistent=false
                log_error "Inconsistent Redis ports: ${redis_ports[*]}"
                break
            fi
        done

        if [ "$consistent" = true ]; then
            log_success "Redis port configuration is consistent ($first_port)"
        fi
    else
        log_warning "No Redis port configuration found"
    fi

    echo ""
}

# Show validation summary
show_summary() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Validation Summary${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Total Checks:    $TOTAL_CHECKS"
    echo -e "Passed:          ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Failed:          ${RED}$FAILED_CHECKS${NC}"
    echo -e "Warnings:        ${YELLOW}$WARNINGS${NC}"
    echo ""

    if [ $FAILED_CHECKS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ All validations passed!${NC}"
        echo ""
        echo "Your port configuration is correct."
        return 0
    elif [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${YELLOW}⚠ Validation completed with warnings${NC}"
        echo ""
        echo "Some non-critical issues were found."
        echo "Review the warnings above and fix if necessary."
        return 2
    else
        echo -e "${RED}✗ Validation failed${NC}"
        echo ""
        echo "Critical errors were found. Please fix them before proceeding."
        echo ""
        echo "Common fixes:"
        echo "  - Run migration script: ./scripts/migrate-ports.sh"
        echo "  - Check documentation: docs/deployment/PORT_MIGRATION_GUIDE.md"
        echo "  - Verify .env files have correct ports (87XXX range)"
        echo "  - Update docker-compose.yml with new port mappings"
        return 1
    fi
}

# Main execution
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Truxe Port Validation${NC}"
    echo -e "${CYAN}Version 1.0.0${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/package.json" ] && [ ! -f "$PROJECT_ROOT/api/package.json" ]; then
        log_error "Not in Truxe project root directory"
        exit 1
    fi

    # Run validations
    check_port_availability
    validate_config_files
    validate_docker_compose
    check_port_consistency

    # Show summary and return appropriate exit code
    show_summary
    local exit_code=$?

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    exit $exit_code
}

# Parse arguments and run
parse_args "$@"
main

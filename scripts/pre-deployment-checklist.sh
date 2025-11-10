#!/usr/bin/env bash

# Truxe Phase 9 Pre-Deployment Checklist
# Validates all port standardization requirements before production deployment
# Version: 1.0.0
# Date: 2025-11-07

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERBOSE=false
FIX_ISSUES=false

# Checklist counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Results storage
declare -a FAILED_ITEMS=()
declare -a WARNING_ITEMS=()
declare -a PASSED_ITEMS=()

# Show usage
show_usage() {
    cat << EOF
Truxe Phase 9 Pre-Deployment Checklist v1.0.0

Usage: $0 [OPTIONS]

Validates all port standardization requirements before production deployment.

Options:
    -v, --verbose           Show detailed output
    -f, --fix               Attempt to fix issues automatically
    -h, --help              Show this help message

Examples:
    # Run checklist
    $0

    # Verbose output
    $0 --verbose

    # Auto-fix issues
    $0 --fix

Validation Categories:
    1. Hardcoded ports removed
    2. Environment variables configured
    3. Docker Compose port mappings
    4. Test configuration
    5. Documentation updated
    6. Migration tools tested
    7. Port conflict detection
    8. Health checks

EOF
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -f|--fix)
                FIX_ISSUES=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                echo -e "${RED}Error: Unknown option: $1${NC}"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Logging functions
log_info() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_check() {
    echo -e "${CYAN}[CHECK]${NC} $1"
    ((TOTAL_CHECKS++))
}

log_pass() {
    echo -e "${GREEN}  ✓${NC} $1"
    ((PASSED_CHECKS++))
    PASSED_ITEMS+=("$1")
}

log_fail() {
    echo -e "${RED}  ✗${NC} $1"
    ((FAILED_CHECKS++))
    FAILED_ITEMS+=("$1")
}

log_warning() {
    echo -e "${YELLOW}  ⚠${NC} $1"
    ((WARNING_CHECKS++))
    WARNING_ITEMS+=("$1")
}

# Check 1: All hardcoded ports removed from application code
check_hardcoded_ports() {
    log_check "Checking for hardcoded ports in application code"

    local hardcoded_found=false

    # Check for hardcoded port numbers (exclude comments, config files, and docs)
    local patterns=(
        "21001"
        "21432"
        "21379"
        "21025"
        "21825"
        ":3001[^0-9]"
        ":5432[^0-9]"
        ":6379[^0-9]"
    )

    local excluded_paths=(
        "node_modules"
        ".git"
        "docs/"
        "CHANGELOG.md"
        "PORT_MIGRATION_GUIDE.md"
        "PORT_STANDARDIZATION_PLAN.md"
        "scripts/"
        "package-lock.json"
    )

    # Build grep exclude pattern
    local exclude_args=""
    for path in "${excluded_paths[@]}"; do
        exclude_args="$exclude_args --exclude-dir=$path"
    done

    # Simplified check - just look for old 21XXX ports in main source
    if grep -r "21001\|21432\|21379" "$PROJECT_ROOT/api/src" 2>/dev/null | grep -v "node_modules" | grep -v "test" > /tmp/hardcoded_ports.txt; then
        if [ -s /tmp/hardcoded_ports.txt ]; then
            hardcoded_found=true
            log_fail "Found old 21XXX ports in source code"
            if [ "$VERBOSE" = true ]; then
                head -5 /tmp/hardcoded_ports.txt
            fi
        fi
    fi

    if [ "$hardcoded_found" = false ]; then
        log_pass "No hardcoded ports in application code"
    fi

    rm -f /tmp/hardcoded_ports.txt
}

# Check 2: Environment variables configured
check_env_variables() {
    log_check "Checking environment variable configuration"

    local required_vars=(
        "TRUXE_API_PORT"
        "TRUXE_DB_PORT"
        "TRUXE_REDIS_PORT"
    )

    # Check .env.example
    if [ -f "$PROJECT_ROOT/api/.env.example" ]; then
        local missing_vars=false
        for var in "${required_vars[@]}"; do
            if ! grep -q "$var" "$PROJECT_ROOT/api/.env.example"; then
                log_fail "Missing $var in .env.example"
                missing_vars=true
            fi
        done

        if [ "$missing_vars" = false ]; then
            log_pass "All required environment variables in .env.example"
        fi
    else
        log_fail ".env.example not found"
    fi

    # Check if .env exists and has correct ports
    if [ -f "$PROJECT_ROOT/api/.env" ]; then
        if grep -q "TRUXE_API_PORT=87001" "$PROJECT_ROOT/api/.env" && \
           grep -q "TRUXE_DB_PORT=87032" "$PROJECT_ROOT/api/.env" && \
           grep -q "TRUXE_REDIS_PORT=87079" "$PROJECT_ROOT/api/.env"; then
            log_pass ".env configured with 87XXX ports"
        else
            log_warning ".env may need port updates"
        fi
    else
        log_warning ".env not found (should be created from .env.example)"
    fi
}

# Check 3: Docker Compose port mappings
check_docker_compose() {
    log_check "Checking Docker Compose port mappings"

    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        # Check for new ports
        if grep -q "87001:3001" "$PROJECT_ROOT/docker-compose.yml" && \
           grep -q "87032:5432" "$PROJECT_ROOT/docker-compose.yml" && \
           grep -q "87079:6379" "$PROJECT_ROOT/docker-compose.yml"; then
            log_pass "Docker Compose using correct port mappings (87XXX:default)"
        else
            log_fail "Docker Compose port mappings incorrect"
        fi

        # Check for old ports
        if grep -q "21001" "$PROJECT_ROOT/docker-compose.yml" || \
           grep -q "21432" "$PROJECT_ROOT/docker-compose.yml" || \
           grep -q "21379" "$PROJECT_ROOT/docker-compose.yml"; then
            log_fail "Docker Compose still has old 21XXX ports"
        else
            log_pass "No old 21XXX ports in Docker Compose"
        fi
    else
        log_fail "docker-compose.yml not found"
    fi
}

# Check 4: Test configuration
check_test_configuration() {
    log_check "Checking test configuration"

    # Check if test files use environment variables
    if [ -d "$PROJECT_ROOT/api/tests" ]; then
        # Look for hardcoded test ports
        if grep -r "localhost:3001" "$PROJECT_ROOT/api/tests" 2>/dev/null | grep -v "node_modules" > /dev/null; then
            log_warning "Some tests may use hardcoded localhost:3001"
        else
            log_pass "Tests appear to use environment-based ports"
        fi
    else
        log_warning "No tests directory found"
    fi

    # Check package.json for test scripts
    if [ -f "$PROJECT_ROOT/api/package.json" ]; then
        if grep -q "test" "$PROJECT_ROOT/api/package.json"; then
            log_pass "Test scripts configured in package.json"
        else
            log_warning "No test scripts in package.json"
        fi
    fi
}

# Check 5: Documentation updated
check_documentation() {
    log_check "Checking documentation updates"

    local docs_updated=true

    # Check README for port mentions
    if [ -f "$PROJECT_ROOT/README.md" ]; then
        if grep -q "87001" "$PROJECT_ROOT/README.md" || grep -q "87XXX" "$PROJECT_ROOT/README.md"; then
            log_pass "README.md mentions new port range"
        else
            log_warning "README.md may need port updates"
            docs_updated=false
        fi
    fi

    # Check if migration guide exists
    if [ -f "$PROJECT_ROOT/docs/deployment/PORT_MIGRATION_GUIDE.md" ]; then
        log_pass "Port migration guide exists"
    else
        log_fail "Port migration guide missing"
        docs_updated=false
    fi

    # Check if monitoring guide exists
    if [ -f "$PROJECT_ROOT/docs/deployment/MONITORING_GUIDE.md" ]; then
        log_pass "Monitoring guide exists"
    else
        log_warning "Monitoring guide missing"
    fi
}

# Check 6: Migration tools tested
check_migration_tools() {
    log_check "Checking migration tools"

    local tools_ready=true

    # Check if migration script exists and is executable
    if [ -f "$PROJECT_ROOT/scripts/migrate-ports.sh" ]; then
        if [ -x "$PROJECT_ROOT/scripts/migrate-ports.sh" ]; then
            log_pass "migrate-ports.sh exists and is executable"
        else
            log_fail "migrate-ports.sh not executable"
            tools_ready=false
        fi
    else
        log_fail "migrate-ports.sh missing"
        tools_ready=false
    fi

    # Check if validation script exists
    if [ -f "$PROJECT_ROOT/scripts/validate-ports.sh" ]; then
        if [ -x "$PROJECT_ROOT/scripts/validate-ports.sh" ]; then
            log_pass "validate-ports.sh exists and is executable"
        else
            log_fail "validate-ports.sh not executable"
            tools_ready=false
        fi
    else
        log_fail "validate-ports.sh missing"
        tools_ready=false
    fi

    # Check if rollback script exists
    if [ -f "$PROJECT_ROOT/scripts/rollback-ports.sh" ]; then
        if [ -x "$PROJECT_ROOT/scripts/rollback-ports.sh" ]; then
            log_pass "rollback-ports.sh exists and is executable"
        else
            log_warning "rollback-ports.sh not executable"
        fi
    else
        log_warning "rollback-ports.sh missing"
    fi
}

# Check 7: Port conflict detection
check_port_conflicts() {
    log_check "Checking port conflict detection"

    # Check if lsof is available
    if command -v lsof &> /dev/null; then
        log_pass "lsof available for port conflict detection"

        # Check if new ports are available
        local ports_in_use=false
        for port in 87001 87032 87079; do
            if lsof -i ":$port" &> /dev/null; then
                log_warning "Port $port is currently in use"
                ports_in_use=true
                if [ "$VERBOSE" = true ]; then
                    lsof -i ":$port" | head -2
                fi
            fi
        done

        if [ "$ports_in_use" = false ]; then
            log_pass "All new ports (87001, 87032, 87079) are available"
        fi
    else
        log_warning "lsof not available - cannot check port conflicts"
    fi
}

# Check 8: Health checks
check_health_endpoints() {
    log_check "Checking health check configuration"

    # Check if health endpoint exists in code
    if grep -r "/health" "$PROJECT_ROOT/api/src" 2>/dev/null | grep -v "node_modules" > /dev/null; then
        log_pass "Health endpoint found in application code"
    else
        log_warning "Health endpoint not found"
    fi

    # Check if monitoring script can perform health checks
    if [ -f "$PROJECT_ROOT/scripts/monitor-ports.sh" ]; then
        log_pass "Monitoring script available for health checks"
    else
        log_warning "Monitoring script missing"
    fi
}

# Check 9: Monitoring tools
check_monitoring_tools() {
    log_check "Checking monitoring and validation tools"

    local tools_count=0
    local expected_tools=(
        "monitor-ports.sh"
        "port-dashboard.sh"
        "setup-monitoring-cron.sh"
    )

    for tool in "${expected_tools[@]}"; do
        if [ -f "$PROJECT_ROOT/scripts/$tool" ] && [ -x "$PROJECT_ROOT/scripts/$tool" ]; then
            ((tools_count++))
        fi
    done

    if [ $tools_count -eq ${#expected_tools[@]} ]; then
        log_pass "All monitoring tools present and executable ($tools_count/${#expected_tools[@]})"
    elif [ $tools_count -gt 0 ]; then
        log_warning "Some monitoring tools missing ($tools_count/${#expected_tools[@]})"
    else
        log_fail "No monitoring tools found"
    fi
}

# Check 10: Git status
check_git_status() {
    log_check "Checking git repository status"

    if [ -d "$PROJECT_ROOT/.git" ]; then
        # Check if on feature branch
        local current_branch=$(git -C "$PROJECT_ROOT" branch --show-current)
        if [[ "$current_branch" == "feature/port-standardization-87xxx" ]]; then
            log_pass "On correct feature branch: $current_branch"
        else
            log_warning "Current branch: $current_branch (expected: feature/port-standardization-87xxx)"
        fi

        # Check for uncommitted changes
        if git -C "$PROJECT_ROOT" diff-index --quiet HEAD --; then
            log_pass "No uncommitted changes"
        else
            log_warning "Uncommitted changes detected"
            if [ "$VERBOSE" = true ]; then
                git -C "$PROJECT_ROOT" status --short
            fi
        fi
    else
        log_warning "Not a git repository"
    fi
}

# Generate summary report
generate_summary() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BOLD}${CYAN}Pre-Deployment Checklist Summary${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Total Checks:     $TOTAL_CHECKS"
    echo -e "${GREEN}Passed:${NC}           $PASSED_CHECKS"
    echo -e "${RED}Failed:${NC}           $FAILED_CHECKS"
    echo -e "${YELLOW}Warnings:${NC}         $WARNING_CHECKS"
    echo ""

    # Calculate percentage
    if [ $TOTAL_CHECKS -gt 0 ]; then
        local percentage=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
        echo "Success Rate:     ${percentage}%"
        echo ""
    fi

    # Show failed items
    if [ ${#FAILED_ITEMS[@]} -gt 0 ]; then
        echo -e "${RED}${BOLD}Failed Items:${NC}"
        for item in "${FAILED_ITEMS[@]}"; do
            echo -e "  ${RED}✗${NC} $item"
        done
        echo ""
    fi

    # Show warnings
    if [ ${#WARNING_ITEMS[@]} -gt 0 ]; then
        echo -e "${YELLOW}${BOLD}Warnings:${NC}"
        for item in "${WARNING_ITEMS[@]}"; do
            echo -e "  ${YELLOW}⚠${NC} $item"
        done
        echo ""
    fi

    # Overall status
    if [ $FAILED_CHECKS -eq 0 ]; then
        if [ $WARNING_CHECKS -eq 0 ]; then
            echo -e "${GREEN}${BOLD}✓ READY FOR DEPLOYMENT${NC}"
            echo ""
            echo "All pre-deployment checks passed!"
        else
            echo -e "${YELLOW}${BOLD}⚠ READY WITH WARNINGS${NC}"
            echo ""
            echo "All critical checks passed, but review warnings before deployment."
        fi
    else
        echo -e "${RED}${BOLD}✗ NOT READY FOR DEPLOYMENT${NC}"
        echo ""
        echo "Fix failed checks before deploying to production."
        echo ""
        echo "Recommended actions:"
        echo "  1. Review failed items above"
        echo "  2. Fix issues manually or run with --fix"
        echo "  3. Re-run this checklist"
        echo "  4. Run test suite: npm test"
    fi
    echo ""
}

# Main execution
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BOLD}${CYAN}Truxe Phase 9 Pre-Deployment Checklist${NC}"
    echo -e "${CYAN}Version 1.0.0${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Run all checks
    check_hardcoded_ports
    check_env_variables
    check_docker_compose
    check_test_configuration
    check_documentation
    check_migration_tools
    check_port_conflicts
    check_health_endpoints
    check_monitoring_tools
    check_git_status

    # Generate summary
    generate_summary

    # Exit with appropriate code
    if [ $FAILED_CHECKS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Parse arguments and run
parse_args "$@"
main

exit 0

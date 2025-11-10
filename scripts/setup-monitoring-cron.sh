#!/usr/bin/env bash

# Truxe Port Monitoring Cron Setup
# Installs automated port monitoring and validation
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
MONITOR_INTERVAL=300  # Default: 5 minutes
VALIDATE_INTERVAL=3600  # Default: 1 hour
WEBHOOK_URL=""
ENABLE_WEBHOOK=false
UNINSTALL=false

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
Truxe Port Monitoring Cron Setup v1.0.0

Usage: $0 [OPTIONS]

Sets up automated port monitoring and validation using cron jobs.

Options:
    -m, --monitor-interval <sec>    Monitoring interval in seconds (default: 300)
    -v, --validate-interval <sec>   Validation interval in seconds (default: 3600)
    -w, --webhook <url>             Enable webhook alerting
    -u, --uninstall                 Remove monitoring cron jobs
    -h, --help                      Show this help message

Examples:
    # Install with default intervals (5 min monitoring, 1 hour validation)
    $0

    # Install with custom intervals
    $0 --monitor-interval 600 --validate-interval 7200

    # Install with webhook alerting
    $0 --webhook https://hooks.slack.com/services/YOUR/WEBHOOK/URL

    # Uninstall monitoring
    $0 --uninstall

Cron Jobs:
    - Port Monitoring: Continuous health checks of all services
    - Port Validation: Periodic validation of configuration consistency

Logs:
    - Monitoring: logs/port-monitor.log
    - Validation: logs/port-validation.log

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -m|--monitor-interval)
                MONITOR_INTERVAL="$2"
                shift 2
                ;;
            -v|--validate-interval)
                VALIDATE_INTERVAL="$2"
                shift 2
                ;;
            -w|--webhook)
                WEBHOOK_URL="$2"
                ENABLE_WEBHOOK=true
                shift 2
                ;;
            -u|--uninstall)
                UNINSTALL=true
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

# Check requirements
check_requirements() {
    log_info "Checking requirements..."

    # Check for cron
    if ! command -v crontab &> /dev/null; then
        log_error "crontab command not found"
        echo ""
        echo "Please install cron:"
        echo "  macOS: cron is built-in"
        echo "  Ubuntu/Debian: sudo apt-get install cron"
        echo "  CentOS/RHEL: sudo yum install cronie"
        exit 1
    fi

    # Check if monitoring script exists
    if [ ! -f "$SCRIPT_DIR/monitor-ports.sh" ]; then
        log_error "monitor-ports.sh not found"
        exit 1
    fi

    # Check if validation script exists
    if [ ! -f "$SCRIPT_DIR/validate-ports.sh" ]; then
        log_error "validate-ports.sh not found"
        exit 1
    fi

    # Check if scripts are executable
    if [ ! -x "$SCRIPT_DIR/monitor-ports.sh" ]; then
        log_warning "monitor-ports.sh not executable, fixing..."
        chmod +x "$SCRIPT_DIR/monitor-ports.sh"
    fi

    if [ ! -x "$SCRIPT_DIR/validate-ports.sh" ]; then
        log_warning "validate-ports.sh not executable, fixing..."
        chmod +x "$SCRIPT_DIR/validate-ports.sh"
    fi

    log_success "All requirements met"
}

# Convert seconds to cron interval
seconds_to_cron() {
    local seconds=$1

    if [ $seconds -ge 3600 ]; then
        # Hourly intervals
        local hours=$((seconds / 3600))
        echo "0 */$hours * * *"
    elif [ $seconds -ge 60 ]; then
        # Minute intervals
        local minutes=$((seconds / 60))
        echo "*/$minutes * * * *"
    else
        log_error "Interval too small (minimum 60 seconds)"
        exit 1
    fi
}

# Get existing crontab without Truxe entries
get_clean_crontab() {
    if crontab -l 2>/dev/null | grep -v "# Truxe Port Monitoring" | grep -v "monitor-ports.sh" | grep -v "validate-ports.sh"; then
        :
    fi
}

# Install monitoring cron jobs
install_monitoring() {
    log_info "Installing monitoring cron jobs..."

    # Create log directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Build monitoring command
    local monitor_cmd="$SCRIPT_DIR/monitor-ports.sh"
    if [ "$ENABLE_WEBHOOK" = true ]; then
        monitor_cmd="$monitor_cmd --alert \"$WEBHOOK_URL\""
    fi

    # Build validation command
    local validate_cmd="$SCRIPT_DIR/validate-ports.sh --quiet"

    # Convert intervals to cron syntax
    local monitor_cron=$(seconds_to_cron $MONITOR_INTERVAL)
    local validate_cron=$(seconds_to_cron $VALIDATE_INTERVAL)

    # Get existing crontab (without Truxe entries)
    local existing_cron=$(get_clean_crontab)

    # Create new crontab
    local new_cron=$(cat <<EOF
$existing_cron

# Truxe Port Monitoring (installed $(date '+%Y-%m-%d %H:%M:%S'))
$monitor_cron $monitor_cmd >> $PROJECT_ROOT/logs/port-monitor.log 2>&1
$validate_cron $validate_cmd >> $PROJECT_ROOT/logs/port-validation.log 2>&1
EOF
)

    # Install new crontab
    echo "$new_cron" | crontab -

    log_success "Monitoring cron jobs installed"
    echo ""
    echo "Monitoring Schedule:"
    echo "  Port Health Checks: Every $(($MONITOR_INTERVAL / 60)) minute(s)"
    echo "  Port Validation:    Every $(($VALIDATE_INTERVAL / 60)) minute(s)"
    echo ""
    echo "Logs:"
    echo "  Monitoring: $PROJECT_ROOT/logs/port-monitor.log"
    echo "  Validation: $PROJECT_ROOT/logs/port-validation.log"
    echo ""

    if [ "$ENABLE_WEBHOOK" = true ]; then
        echo "Webhook Alerts: Enabled"
        echo "  URL: $WEBHOOK_URL"
        echo ""
    fi
}

# Uninstall monitoring cron jobs
uninstall_monitoring() {
    log_info "Uninstalling monitoring cron jobs..."

    # Get existing crontab without Truxe entries
    local clean_cron=$(get_clean_crontab)

    if [ -z "$clean_cron" ]; then
        # No other cron jobs, remove crontab completely
        crontab -r 2>/dev/null || true
        log_success "All cron jobs removed (crontab was empty)"
    else
        # Install clean crontab
        echo "$clean_cron" | crontab -
        log_success "Truxe monitoring cron jobs removed"
    fi

    echo ""
    echo "Note: Log files were not deleted"
    echo "  To remove logs: rm -rf $PROJECT_ROOT/logs/port-*.log"
    echo ""
}

# Show current monitoring status
show_status() {
    log_info "Current monitoring status:"
    echo ""

    # Check if cron jobs exist
    if crontab -l 2>/dev/null | grep -q "Truxe Port Monitoring"; then
        echo -e "${GREEN}Status: INSTALLED${NC}"
        echo ""
        echo "Active cron jobs:"
        crontab -l | grep -A 2 "Truxe Port Monitoring"
        echo ""
    else
        echo -e "${YELLOW}Status: NOT INSTALLED${NC}"
        echo ""
        echo "To install monitoring:"
        echo "  $0"
        echo ""
    fi

    # Check log files
    if [ -f "$PROJECT_ROOT/logs/port-monitor.log" ]; then
        local monitor_lines=$(wc -l < "$PROJECT_ROOT/logs/port-monitor.log")
        echo "Monitoring log: $monitor_lines lines"
    else
        echo "Monitoring log: Not found"
    fi

    if [ -f "$PROJECT_ROOT/logs/port-validation.log" ]; then
        local validate_lines=$(wc -l < "$PROJECT_ROOT/logs/port-validation.log")
        echo "Validation log: $validate_lines lines"
    else
        echo "Validation log: Not found"
    fi
    echo ""
}

# Main execution
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Truxe Port Monitoring Cron Setup${NC}"
    echo -e "${CYAN}Version 1.0.0${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Check requirements
    check_requirements

    if [ "$UNINSTALL" = true ]; then
        uninstall_monitoring
    else
        install_monitoring
    fi

    # Show status
    show_status

    log_success "Setup completed successfully!"
    echo ""
    echo "Useful commands:"
    echo "  View monitoring status:  $0 --help"
    echo "  View cron jobs:          crontab -l"
    echo "  View monitoring logs:    tail -f $PROJECT_ROOT/logs/port-monitor.log"
    echo "  View validation logs:    tail -f $PROJECT_ROOT/logs/port-validation.log"
    echo "  Uninstall monitoring:    $0 --uninstall"
    echo ""
}

# Parse arguments and run
parse_args "$@"
main

exit 0

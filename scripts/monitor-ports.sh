#!/usr/bin/env bash

# Truxe Port Monitoring Script
# Continuous monitoring of port configuration and availability
# Version: 1.0.0
# Date: 2025-11-07

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INTERVAL=60  # Default monitoring interval in seconds
CONTINUOUS=false
OUTPUT_JSON=false
ALERT_ENABLED=false
ALERT_WEBHOOK=""
LOG_FILE="$PROJECT_ROOT/logs/port-monitor.log"

# Expected ports (service:port pairs)
EXPECTED_SERVICES=(
    "API:87001"
    "PostgreSQL:87032"
    "Redis:87079"
    "MailHog_SMTP:87025"
    "MailHog_Web:87825"
    "Grafana:87004"
    "Prometheus:87005"
)

# Statistics
TOTAL_CHECKS=0
HEALTHY_SERVICES=0
UNHEALTHY_SERVICES=0
PORT_CONFLICTS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    [ -n "${LOG_FILE:-}" ] && echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    [ -n "${LOG_FILE:-}" ] && echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    [ -n "${LOG_FILE:-}" ] && echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >> "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
    [ -n "${LOG_FILE:-}" ] && echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $1" >> "$LOG_FILE"
}

# Show usage
show_usage() {
    cat << EOF
Truxe Port Monitoring Script v1.0.0

Usage: $0 [OPTIONS]

Monitors Truxe port configuration and service availability.

Options:
    -c, --continuous        Run continuously with interval
    -i, --interval <sec>    Monitoring interval in seconds (default: 60)
    -j, --json              Output results in JSON format
    -a, --alert <webhook>   Enable alerting via webhook URL
    -l, --log <file>        Log file path (default: logs/port-monitor.log)
    -h, --help              Show this help message

Examples:
    # Single check
    $0

    # Continuous monitoring (every 60 seconds)
    $0 --continuous

    # Continuous with custom interval
    $0 --continuous --interval 30

    # JSON output
    $0 --json

    # With alerting
    $0 --continuous --alert https://hooks.slack.com/services/YOUR/WEBHOOK/URL

    # Run as background service
    nohup $0 --continuous --interval 60 > /dev/null 2>&1 &

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--continuous)
                CONTINUOUS=true
                shift
                ;;
            -i|--interval)
                INTERVAL="$2"
                shift 2
                ;;
            -j|--json)
                OUTPUT_JSON=true
                shift
                ;;
            -a|--alert)
                ALERT_ENABLED=true
                ALERT_WEBHOOK="$2"
                shift 2
                ;;
            -l|--log)
                LOG_FILE="$2"
                shift 2
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

# Initialize logging
init_logging() {
    local log_dir=$(dirname "$LOG_FILE")
    if [ ! -d "$log_dir" ]; then
        mkdir -p "$log_dir"
    fi

    if [ ! -f "$LOG_FILE" ]; then
        touch "$LOG_FILE"
    fi
}

# Check service health
check_service_health() {
    local service_name=$1
    local port=$2
    local status="unknown"
    local details=""

    # Check if port is listening
    if lsof -i ":$port" &> /dev/null; then
        local pid=$(lsof -i ":$port" -t 2>/dev/null | head -1)
        local process_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")

        # Check if it's a Truxe service
        if [[ "$process_name" =~ (node|docker|postgres|redis) ]]; then
            status="healthy"
            details="Running on port $port (PID: $pid, Process: $process_name)"
        else
            status="warning"
            details="Port $port in use by non-Truxe process: $process_name (PID: $pid)"
        fi
    else
        status="down"
        details="Port $port not listening"
    fi

    echo "$status|$details"
}

# Check port availability
check_port_availability() {
    local port=$1

    if lsof -i ":$port" &> /dev/null; then
        return 1  # Port in use
    else
        return 0  # Port available
    fi
}

# Generate JSON report
generate_json_report() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    cat << EOF
{
  "timestamp": "$timestamp",
  "monitoring_interval": $INTERVAL,
  "statistics": {
    "total_checks": $TOTAL_CHECKS,
    "healthy_services": $HEALTHY_SERVICES,
    "unhealthy_services": $UNHEALTHY_SERVICES,
    "port_conflicts": $PORT_CONFLICTS
  },
  "services": [
EOF

    local first=true
    for service_port in "${EXPECTED_SERVICES[@]}"; do
        local service=$(echo "$service_port" | cut -d':' -f1)
        local port=$(echo "$service_port" | cut -d':' -f2)
        local result=$(check_service_health "$service" "$port")
        local status=$(echo "$result" | cut -d'|' -f1)
        local details=$(echo "$result" | cut -d'|' -f2)

        if [ "$first" = false ]; then
            echo ","
        fi
        first=false

        cat << EOF
    {
      "name": "$service",
      "port": $port,
      "status": "$status",
      "details": "$details"
    }
EOF
    done

    cat << EOF

  ]
}
EOF
}

# Send alert
send_alert() {
    local message=$1
    local severity=${2:-"warning"}

    if [ "$ALERT_ENABLED" = false ] || [ -z "$ALERT_WEBHOOK" ]; then
        return 0
    fi

    local color="#FFA500"  # Orange for warning
    if [ "$severity" = "critical" ]; then
        color="#FF0000"  # Red
    elif [ "$severity" = "info" ]; then
        color="#00FF00"  # Green
    fi

    local payload=$(cat <<EOF
{
  "text": "Truxe Port Monitor Alert",
  "attachments": [{
    "color": "$color",
    "title": "Port Monitoring Alert",
    "text": "$message",
    "footer": "Truxe Port Monitor",
    "ts": $(date +%s)
  }]
}
EOF
)

    curl -X POST -H 'Content-Type: application/json' -d "$payload" "$ALERT_WEBHOOK" &> /dev/null || true
}

# Perform health check
perform_health_check() {
    local check_time=$(date '+%Y-%m-%d %H:%M:%S')

    if [ "$OUTPUT_JSON" = true ]; then
        generate_json_report
        return 0
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Truxe Port Health Check${NC}"
    echo -e "${CYAN}Time: $check_time${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Reset statistics for this check
    TOTAL_CHECKS=0
    HEALTHY_SERVICES=0
    UNHEALTHY_SERVICES=0
    PORT_CONFLICTS=0

    # Check each service
    for service_port in "${EXPECTED_SERVICES[@]}"; do
        local service=$(echo "$service_port" | cut -d':' -f1)
        local port=$(echo "$service_port" | cut -d':' -f2)
        local result=$(check_service_health "$service" "$port")
        local status=$(echo "$result" | cut -d'|' -f1)
        local details=$(echo "$result" | cut -d'|' -f2)

        ((TOTAL_CHECKS++))

        case $status in
            healthy)
                log_success "$service ($port): $details"
                ((HEALTHY_SERVICES++))
                ;;
            warning)
                log_warning "$service ($port): $details"
                ((PORT_CONFLICTS++))
                if [ "$ALERT_ENABLED" = true ]; then
                    send_alert "Port conflict detected on $service (port $port): $details" "warning"
                fi
                ;;
            down)
                log_error "$service ($port): $details"
                ((UNHEALTHY_SERVICES++))
                if [ "$ALERT_ENABLED" = true ]; then
                    send_alert "Service down: $service (port $port)" "critical"
                fi
                ;;
            *)
                log_warning "$service ($port): Unknown status"
                ;;
        esac
    done

    # Show summary
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Health Check Summary${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Total Services:      $TOTAL_CHECKS"
    echo -e "Healthy:             ${GREEN}$HEALTHY_SERVICES${NC}"
    echo -e "Unhealthy:           ${RED}$UNHEALTHY_SERVICES${NC}"
    echo -e "Port Conflicts:      ${YELLOW}$PORT_CONFLICTS${NC}"
    echo ""

    # Determine overall status
    if [ $UNHEALTHY_SERVICES -eq 0 ] && [ $PORT_CONFLICTS -eq 0 ]; then
        echo -e "${GREEN}✓ All services are healthy${NC}"
        return 0
    elif [ $UNHEALTHY_SERVICES -eq 0 ]; then
        echo -e "${YELLOW}⚠ Some warnings detected${NC}"
        return 2
    else
        echo -e "${RED}✗ Some services are unhealthy${NC}"
        return 1
    fi
}

# Continuous monitoring loop
run_continuous_monitoring() {
    log_info "Starting continuous port monitoring (interval: ${INTERVAL}s)"

    if [ "$ALERT_ENABLED" = true ]; then
        log_info "Alerting enabled via webhook"
        send_alert "Port monitoring started (interval: ${INTERVAL}s)" "info"
    fi

    local iteration=0

    while true; do
        ((iteration++))

        if [ "$OUTPUT_JSON" = false ]; then
            echo ""
            echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
            echo -e "${MAGENTA}Monitoring Iteration #$iteration${NC}"
            echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
        fi

        perform_health_check

        if [ "$CONTINUOUS" = true ]; then
            if [ "$OUTPUT_JSON" = false ]; then
                echo ""
                echo -e "${BLUE}Next check in ${INTERVAL} seconds...${NC}"
                echo ""
            fi
            sleep "$INTERVAL"
        else
            break
        fi
    done
}

# Check for required tools
check_requirements() {
    if ! command -v lsof &> /dev/null; then
        log_error "lsof is required but not installed"
        exit 1
    fi

    if [ "$ALERT_ENABLED" = true ] && ! command -v curl &> /dev/null; then
        log_error "curl is required for alerting but not installed"
        exit 1
    fi
}

# Cleanup on exit
cleanup() {
    if [ "$CONTINUOUS" = true ]; then
        log_info "Monitoring stopped"
        if [ "$ALERT_ENABLED" = true ]; then
            send_alert "Port monitoring stopped" "info"
        fi
    fi
}

# Main execution
main() {
    # Setup trap for cleanup
    trap cleanup EXIT INT TERM

    if [ "$OUTPUT_JSON" = false ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${CYAN}Truxe Port Monitor${NC}"
        echo -e "${CYAN}Version 1.0.0${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi

    # Check requirements
    check_requirements

    # Initialize logging
    init_logging

    # Run monitoring
    if [ "$CONTINUOUS" = true ]; then
        run_continuous_monitoring
    else
        perform_health_check
        exit $?
    fi
}

# Parse arguments and run
parse_args "$@"
main

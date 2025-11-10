#!/usr/bin/env bash

# Truxe Port Monitoring Dashboard
# Real-time monitoring dashboard for port health
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
GRAY='\033[0;37m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REFRESH_INTERVAL=5  # Default refresh interval in seconds
COMPACT_MODE=false

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

# Show usage
show_usage() {
    cat << EOF
Truxe Port Monitoring Dashboard v1.0.0

Usage: $0 [OPTIONS]

Real-time dashboard for monitoring Truxe port health.

Options:
    -r, --refresh <sec>     Refresh interval in seconds (default: 5)
    -c, --compact           Compact mode (less detail)
    -h, --help              Show this help message

Examples:
    # Start dashboard with default refresh (5 seconds)
    $0

    # Fast refresh (2 seconds)
    $0 --refresh 2

    # Compact mode
    $0 --compact

Controls:
    Ctrl+C: Exit dashboard

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -r|--refresh)
                REFRESH_INTERVAL="$2"
                shift 2
                ;;
            -c|--compact)
                COMPACT_MODE=true
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

# Clear screen
clear_screen() {
    clear
}

# Get terminal dimensions
get_terminal_size() {
    local rows=$(tput lines)
    local cols=$(tput cols)
    echo "$rows:$cols"
}

# Check service health
check_service_health() {
    local service_name=$1
    local port=$2
    local status="down"
    local details=""
    local pid=""
    local process_name=""

    # Check if port is listening
    if lsof -i ":$port" &> /dev/null; then
        pid=$(lsof -i ":$port" -t 2>/dev/null | head -1)
        process_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")

        # Check if it's a Truxe service
        if [[ "$process_name" =~ (node|docker|postgres|redis|mailhog|grafana|prometheus) ]]; then
            status="healthy"
            details="$process_name (PID: $pid)"
        else
            status="warning"
            details="$process_name (PID: $pid) - Non-Truxe process"
        fi
    else
        status="down"
        details="Not listening"
    fi

    echo "$status|$details|$pid|$process_name"
}

# Get status icon
get_status_icon() {
    local status=$1

    case $status in
        healthy)
            echo -e "${GREEN}●${NC}"
            ;;
        warning)
            echo -e "${YELLOW}●${NC}"
            ;;
        down)
            echo -e "${RED}●${NC}"
            ;;
        *)
            echo -e "${GRAY}●${NC}"
            ;;
    esac
}

# Get status color
get_status_color() {
    local status=$1

    case $status in
        healthy)
            echo "${GREEN}"
            ;;
        warning)
            echo "${YELLOW}"
            ;;
        down)
            echo "${RED}"
            ;;
        *)
            echo "${GRAY}"
            ;;
    esac
}

# Format uptime
format_uptime() {
    local seconds=$1

    if [ $seconds -lt 60 ]; then
        echo "${seconds}s"
    elif [ $seconds -lt 3600 ]; then
        echo "$((seconds / 60))m"
    elif [ $seconds -lt 86400 ]; then
        echo "$((seconds / 3600))h $((seconds % 3600 / 60))m"
    else
        echo "$((seconds / 86400))d $((seconds % 86400 / 3600))h"
    fi
}

# Get process uptime
get_process_uptime() {
    local pid=$1

    if [ -z "$pid" ]; then
        echo "N/A"
        return
    fi

    # Get elapsed time in seconds
    local elapsed=$(ps -p "$pid" -o etimes= 2>/dev/null | tr -d ' ' || echo "0")
    format_uptime "$elapsed"
}

# Draw header
draw_header() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║         TRUXE PORT MONITORING DASHBOARD v1.0.0                   ║${NC}"
    echo -e "${BOLD}${CYAN}╠══════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║${NC} ${timestamp}                                  Refresh: ${REFRESH_INTERVAL}s      ${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Draw service table header
draw_table_header() {
    if [ "$COMPACT_MODE" = true ]; then
        printf "${BOLD}%-3s %-20s %-8s %-15s${NC}\n" "" "SERVICE" "PORT" "STATUS"
        echo "───────────────────────────────────────────────────────────"
    else
        printf "${BOLD}%-3s %-20s %-8s %-15s %-10s %-25s${NC}\n" "" "SERVICE" "PORT" "STATUS" "UPTIME" "DETAILS"
        echo "──────────────────────────────────────────────────────────────────────────────────────────"
    fi
}

# Draw service row
draw_service_row() {
    local service=$1
    local port=$2
    local status=$3
    local details=$4
    local pid=$5

    local icon=$(get_status_icon "$status")
    local color=$(get_status_color "$status")
    local uptime=$(get_process_uptime "$pid")

    if [ "$COMPACT_MODE" = true ]; then
        printf "%s %-20s %-8s ${color}%-15s${NC}\n" "$icon" "$service" "$port" "$status"
    else
        printf "%s %-20s %-8s ${color}%-15s${NC} %-10s %-25s\n" "$icon" "$service" "$port" "$status" "$uptime" "$details"
    fi
}

# Draw statistics summary
draw_statistics() {
    local total=$1
    local healthy=$2
    local unhealthy=$3
    local warnings=$4

    echo ""
    echo -e "${BOLD}Summary:${NC}"
    echo "────────────────────────────────────────"
    printf "Total Services:      %d\n" "$total"
    printf "${GREEN}Healthy:${NC}             %d (%.0f%%)\n" "$healthy" $(echo "scale=0; $healthy * 100 / $total" | bc 2>/dev/null || echo "0")
    printf "${RED}Unhealthy:${NC}           %d (%.0f%%)\n" "$unhealthy" $(echo "scale=0; $unhealthy * 100 / $total" | bc 2>/dev/null || echo "0")
    printf "${YELLOW}Warnings:${NC}            %d (%.0f%%)\n" "$warnings" $(echo "scale=0; $warnings * 100 / $total" | bc 2>/dev/null || echo "0")
    echo ""
}

# Draw overall status
draw_overall_status() {
    local healthy=$1
    local unhealthy=$2
    local warnings=$3

    if [ $unhealthy -eq 0 ] && [ $warnings -eq 0 ]; then
        echo -e "${GREEN}${BOLD}✓ All services are operational${NC}"
    elif [ $unhealthy -eq 0 ]; then
        echo -e "${YELLOW}${BOLD}⚠ Some warnings detected${NC}"
    else
        echo -e "${RED}${BOLD}✗ Some services are down${NC}"
    fi
    echo ""
}

# Draw footer
draw_footer() {
    echo "────────────────────────────────────────"
    echo -e "${GRAY}Press Ctrl+C to exit${NC}"
    echo ""
}

# Collect service data
collect_service_data() {
    local total=0
    local healthy=0
    local unhealthy=0
    local warnings=0

    for service_port in "${EXPECTED_SERVICES[@]}"; do
        local service=$(echo "$service_port" | cut -d':' -f1)
        local port=$(echo "$service_port" | cut -d':' -f2)
        local result=$(check_service_health "$service" "$port")
        local status=$(echo "$result" | cut -d'|' -f1)
        local details=$(echo "$result" | cut -d'|' -f2)
        local pid=$(echo "$result" | cut -d'|' -f3)

        ((total++))

        case $status in
            healthy)
                ((healthy++))
                ;;
            warning)
                ((warnings++))
                ;;
            down)
                ((unhealthy++))
                ;;
        esac

        draw_service_row "$service" "$port" "$status" "$details" "$pid"
    done

    echo ""
    draw_statistics "$total" "$healthy" "$unhealthy" "$warnings"
    draw_overall_status "$healthy" "$unhealthy" "$warnings"
}

# Main dashboard loop
run_dashboard() {
    # Hide cursor
    tput civis

    # Trap to show cursor on exit
    trap 'tput cnorm; echo ""; exit 0' EXIT INT TERM

    while true; do
        clear_screen
        draw_header
        draw_table_header
        collect_service_data
        draw_footer

        sleep "$REFRESH_INTERVAL"
    done
}

# Main execution
main() {
    # Check requirements
    if ! command -v lsof &> /dev/null; then
        echo -e "${RED}Error: lsof is required but not installed${NC}"
        exit 1
    fi

    if ! command -v bc &> /dev/null; then
        echo -e "${YELLOW}Warning: bc not found, percentage calculations disabled${NC}"
    fi

    # Run dashboard
    run_dashboard
}

# Parse arguments and run
parse_args "$@"
main

exit 0

#!/bin/bash

# Truxe Docker Manager
# Simplified management of multiple Docker Compose configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DOCKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$DOCKER_DIR")"
PROJECT_NAME="truxe"

# Available environments
ENVIRONMENTS=("dev" "staging" "prod" "production" "testing" "alpha")
TOOLS=("enhanced" "enhanced-validation" "optimized")

# Helper functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Truxe Docker Manager${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

# Check if environment exists
check_environment() {
    local env=$1
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${env} " ]]; then
        print_error "Environment '$env' not found!"
        print_info "Available environments: ${ENVIRONMENTS[*]}"
        exit 1
    fi
    
    local compose_file="$DOCKER_DIR/environments/docker-compose.$env.yml"
    if [[ ! -f "$compose_file" ]]; then
        print_error "Compose file not found: $compose_file"
        exit 1
    fi
}

# Check if tool exists
check_tool() {
    local tool=$1
    if [[ ! " ${TOOLS[@]} " =~ " ${tool} " ]]; then
        print_error "Tool '$tool' not found!"
        print_info "Available tools: ${TOOLS[*]}"
        exit 1
    fi
    
    local compose_file="$DOCKER_DIR/tools/docker-compose.$tool.yml"
    if [[ ! -f "$compose_file" ]]; then
        print_error "Tool compose file not found: $compose_file"
        exit 1
    fi
}

# Get compose files for environment and optional tools
get_compose_files() {
    local env=$1
    shift
    local tools=("$@")
    
    local files=("-f" "$DOCKER_DIR/environments/docker-compose.$env.yml")
    
    for tool in "${tools[@]}"; do
        if [[ -n "$tool" ]]; then
            check_tool "$tool"
            files+=("-f" "$DOCKER_DIR/tools/docker-compose.$tool.yml")
        fi
    done
    
    echo "${files[@]}"
}

# Start environment
start_environment() {
    local env=$1
    shift
    local tools=("$@")
    
    check_environment "$env"
    
    print_info "Starting $env environment..."
    if [[ ${#tools[@]} -gt 0 ]]; then
        print_info "With tools: ${tools[*]}"
    fi
    
    local compose_files
    compose_files=($(get_compose_files "$env" "${tools[@]}"))
    
    cd "$PROJECT_ROOT"
    docker-compose -p "${PROJECT_NAME}-${env}" "${compose_files[@]}" up -d
    
    print_success "$env environment started!"
    
    # Show running services
    echo
    print_info "Running services:"
    docker-compose -p "${PROJECT_NAME}-${env}" "${compose_files[@]}" ps
    
    # Show access URLs
    show_access_urls "$env"
}

# Stop environment
stop_environment() {
    local env=$1
    
    if [[ "$env" == "all" ]]; then
        print_info "Stopping all environments..."
        for e in "${ENVIRONMENTS[@]}"; do
            local compose_file="$DOCKER_DIR/environments/docker-compose.$e.yml"
            if [[ -f "$compose_file" ]]; then
                cd "$PROJECT_ROOT"
                docker-compose -p "${PROJECT_NAME}-${e}" -f "$compose_file" down 2>/dev/null || true
                print_success "Stopped $e environment"
            fi
        done
    else
        check_environment "$env"
        
        print_info "Stopping $env environment..."
        cd "$PROJECT_ROOT"
        docker-compose -p "${PROJECT_NAME}-${env}" -f "$DOCKER_DIR/environments/docker-compose.$env.yml" down
        print_success "$env environment stopped!"
    fi
}

# Restart environment
restart_environment() {
    local env=$1
    shift
    local tools=("$@")
    
    print_info "Restarting $env environment..."
    stop_environment "$env"
    sleep 2
    start_environment "$env" "${tools[@]}"
}

# Show logs
show_logs() {
    local env=$1
    local service=$2
    local follow=${3:-false}
    
    check_environment "$env"
    
    local compose_file="$DOCKER_DIR/environments/docker-compose.$env.yml"
    local follow_flag=""
    
    if [[ "$follow" == "true" ]]; then
        follow_flag="-f"
    fi
    
    cd "$PROJECT_ROOT"
    if [[ -n "$service" ]]; then
        print_info "Showing logs for $service in $env environment..."
        docker-compose -p "${PROJECT_NAME}-${env}" -f "$compose_file" logs $follow_flag "$service"
    else
        print_info "Showing logs for $env environment..."
        docker-compose -p "${PROJECT_NAME}-${env}" -f "$compose_file" logs $follow_flag
    fi
}

# Show status
show_status() {
    local env=$1
    
    if [[ "$env" == "all" ]]; then
        print_info "Status of all environments:"
        echo
        for e in "${ENVIRONMENTS[@]}"; do
            local compose_file="$DOCKER_DIR/environments/docker-compose.$e.yml"
            if [[ -f "$compose_file" ]]; then
                echo -e "${PURPLE}=== $e Environment ===${NC}"
                cd "$PROJECT_ROOT"
                docker-compose -p "${PROJECT_NAME}-${e}" -f "$compose_file" ps 2>/dev/null || echo "Not running"
                echo
            fi
        done
    else
        check_environment "$env"
        
        print_info "Status of $env environment:"
        cd "$PROJECT_ROOT"
        docker-compose -p "${PROJECT_NAME}-${env}" -f "$DOCKER_DIR/environments/docker-compose.$env.yml" ps
    fi
}

# Execute command in service
exec_command() {
    local env=$1
    local service=$2
    shift 2
    local cmd=("$@")
    
    check_environment "$env"
    
    print_info "Executing command in $service ($env): ${cmd[*]}"
    cd "$PROJECT_ROOT"
    docker-compose -p "${PROJECT_NAME}-${env}" -f "$DOCKER_DIR/environments/docker-compose.$env.yml" exec "$service" "${cmd[@]}"
}

# Clean up
cleanup() {
    local env=$1
    local volumes=${2:-false}
    
    if [[ "$env" == "all" ]]; then
        print_warning "Cleaning up all environments..."
        for e in "${ENVIRONMENTS[@]}"; do
            local compose_file="$DOCKER_DIR/environments/docker-compose.$e.yml"
            if [[ -f "$compose_file" ]]; then
                cd "$PROJECT_ROOT"
                if [[ "$volumes" == "true" ]]; then
                    docker-compose -p "${PROJECT_NAME}-${e}" -f "$compose_file" down -v --remove-orphans 2>/dev/null || true
                else
                    docker-compose -p "${PROJECT_NAME}-${e}" -f "$compose_file" down --remove-orphans 2>/dev/null || true
                fi
                print_success "Cleaned up $e environment"
            fi
        done
        
        # Clean up orphaned containers and networks
        print_info "Cleaning up orphaned resources..."
        docker container prune -f
        docker network prune -f
        if [[ "$volumes" == "true" ]]; then
            docker volume prune -f
        fi
    else
        check_environment "$env"
        
        print_warning "Cleaning up $env environment..."
        cd "$PROJECT_ROOT"
        if [[ "$volumes" == "true" ]]; then
            docker-compose -p "${PROJECT_NAME}-${env}" -f "$DOCKER_DIR/environments/docker-compose.$env.yml" down -v --remove-orphans
        else
            docker-compose -p "${PROJECT_NAME}-${env}" -f "$DOCKER_DIR/environments/docker-compose.$env.yml" down --remove-orphans
        fi
        print_success "$env environment cleaned up!"
    fi
}

# Show access URLs
show_access_urls() {
    local env=$1
    
    echo
    print_info "Access URLs for $env environment:"
    
    case "$env" in
        "dev")
            echo "  API:       http://localhost:3000"
            echo "  Frontend:  http://localhost:3001"
            echo "  Database:  localhost:5432"
            echo "  MailHog:   http://localhost:8025"
            echo "  Dashboard: http://localhost:3000/dashboard"
            ;;
        "staging"|"prod"|"production")
            echo "  HTTPS:     https://localhost"
            echo "  HTTP:      http://localhost (redirects to HTTPS)"
            echo "  Dashboard: https://localhost/dashboard"
            ;;
        "testing")
            echo "  Test API:  http://localhost:3100"
            echo "  Test DB:   localhost:5433"
            ;;
        "alpha")
            echo "  API:       http://localhost:3000"
            echo "  Frontend:  http://localhost:3001"
            echo "  Dashboard: http://localhost:3000/dashboard"
            echo "  Feedback:  http://localhost:3000/feedback"
            ;;
    esac
}

# Build services
build_services() {
    local service=$1
    
    cd "$PROJECT_ROOT"
    
    if [[ "$service" == "all" ]]; then
        print_info "Building all custom services..."
        docker build -f "$DOCKER_DIR/services/Dockerfile.port-monitor" -t "${PROJECT_NAME}/port-monitor" .
        docker build -f "$DOCKER_DIR/services/Dockerfile.port-validator" -t "${PROJECT_NAME}/port-validator" .
        print_success "All services built!"
    elif [[ "$service" == "port-monitor" ]]; then
        print_info "Building port monitor service..."
        docker build -f "$DOCKER_DIR/services/Dockerfile.port-monitor" -t "${PROJECT_NAME}/port-monitor" .
        print_success "Port monitor service built!"
    elif [[ "$service" == "port-validator" ]]; then
        print_info "Building port validator service..."
        docker build -f "$DOCKER_DIR/services/Dockerfile.port-validator" -t "${PROJECT_NAME}/port-validator" .
        print_success "Port validator service built!"
    else
        print_error "Unknown service: $service"
        print_info "Available services: all, port-monitor, port-validator"
        exit 1
    fi
}

# Show help
show_help() {
    print_header
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commands:"
    echo "  start <env> [tools...]     Start environment with optional tools"
    echo "  stop <env|all>             Stop environment or all environments"
    echo "  restart <env> [tools...]   Restart environment with optional tools"
    echo "  status <env|all>           Show status of environment(s)"
    echo "  logs <env> [service] [-f]  Show logs (use -f to follow)"
    echo "  exec <env> <service> <cmd> Execute command in service"
    echo "  build <service|all>        Build custom services"
    echo "  clean <env|all> [-v]       Clean up (use -v to remove volumes)"
    echo "  urls <env>                 Show access URLs for environment"
    echo "  help                       Show this help"
    echo
    echo "Environments:"
    echo "  ${ENVIRONMENTS[*]}"
    echo
    echo "Tools (optional with start/restart):"
    echo "  ${TOOLS[*]}"
    echo
    echo "Examples:"
    echo "  $0 start dev                    # Start development environment"
    echo "  $0 start prod optimized         # Start production with optimization"
    echo "  $0 start dev enhanced           # Start development with enhanced features"
    echo "  $0 logs dev api -f              # Follow API logs in development"
    echo "  $0 exec dev api npm test        # Run tests in development API container"
    echo "  $0 stop all                     # Stop all environments"
    echo "  $0 clean all -v                 # Clean up everything including volumes"
    echo "  $0 build all                    # Build all custom services"
}

# Main script logic
main() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 0
    fi
    
    local command=$1
    shift
    
    case "$command" in
        "start")
            if [[ $# -eq 0 ]]; then
                print_error "Environment required for start command"
                exit 1
            fi
            local env=$1
            shift
            start_environment "$env" "$@"
            ;;
        "stop")
            if [[ $# -eq 0 ]]; then
                print_error "Environment required for stop command"
                exit 1
            fi
            stop_environment "$1"
            ;;
        "restart")
            if [[ $# -eq 0 ]]; then
                print_error "Environment required for restart command"
                exit 1
            fi
            local env=$1
            shift
            restart_environment "$env" "$@"
            ;;
        "status")
            local env=${1:-all}
            show_status "$env"
            ;;
        "logs")
            if [[ $# -eq 0 ]]; then
                print_error "Environment required for logs command"
                exit 1
            fi
            local env=$1
            local service=$2
            local follow=false
            if [[ "$3" == "-f" || "$2" == "-f" ]]; then
                follow=true
                if [[ "$2" == "-f" ]]; then
                    service=""
                fi
            fi
            show_logs "$env" "$service" "$follow"
            ;;
        "exec")
            if [[ $# -lt 3 ]]; then
                print_error "Usage: $0 exec <env> <service> <command>"
                exit 1
            fi
            exec_command "$@"
            ;;
        "build")
            local service=${1:-all}
            build_services "$service"
            ;;
        "clean")
            local env=${1:-all}
            local volumes=false
            if [[ "$2" == "-v" ]]; then
                volumes=true
            fi
            cleanup "$env" "$volumes"
            ;;
        "urls")
            if [[ $# -eq 0 ]]; then
                print_error "Environment required for urls command"
                exit 1
            fi
            show_access_urls "$1"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"


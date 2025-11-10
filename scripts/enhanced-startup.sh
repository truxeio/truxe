#!/bin/bash

# Truxe Enhanced Startup Script
# Implements graceful service startup ordering with health checks and port validation
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${TRUXE_ENV:-development}"
COMPOSE_FILE="${1:-docker-compose.optimized.yml}"
STARTUP_TIMEOUT="${STARTUP_TIMEOUT:-300}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-10}"
MAX_RETRIES="${MAX_RETRIES:-30}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Service startup order with dependencies
declare -A SERVICE_DEPENDENCIES=(
    ["traefik"]=""
    ["consul"]=""
    ["database"]=""
    ["redis"]=""
    ["api"]="database redis consul"
    ["prometheus"]="api consul"
    ["grafana"]="prometheus"
    ["mailhog"]=""
    ["port-monitor"]="consul prometheus"
)

# Service health check endpoints
declare -A HEALTH_ENDPOINTS=(
    ["traefik"]="http://localhost:${TRUXE_TRAEFIK_DASHBOARD_PORT:-21081}/ping"
    ["consul"]="http://localhost:${TRUXE_CONSUL_PORT:-21500}/v1/status/leader"
    ["database"]="postgresql://truxe:password@localhost:${TRUXE_DB_PORT:-87032}/truxe_${ENVIRONMENT}"
    ["redis"]="redis://localhost:${TRUXE_REDIS_PORT:-87079}"
    ["api"]="http://localhost:${TRUXE_API_PORT:-21001}/health/ready"
    ["prometheus"]="http://localhost:${TRUXE_PROMETHEUS_PORT:-21005}/-/healthy"
    ["grafana"]="http://localhost:${TRUXE_GRAFANA_PORT:-21004}/api/health"
    ["mailhog"]="http://localhost:${TRUXE_MAILHOG_WEB_PORT:-21825}"
)

# Function to check if a service is healthy
check_service_health() {
    local service="$1"
    local endpoint="${HEALTH_ENDPOINTS[$service]:-}"
    
    if [[ -z "$endpoint" ]]; then
        log_warning "No health check endpoint defined for $service"
        return 0
    fi
    
    case "$endpoint" in
        http*)
            curl -sf "$endpoint" >/dev/null 2>&1
            ;;
        postgresql*)
            pg_isready -d "$endpoint" >/dev/null 2>&1
            ;;
        redis*)
            redis-cli -u "$endpoint" ping >/dev/null 2>&1
            ;;
        *)
            log_warning "Unknown endpoint type for $service: $endpoint"
            return 0
            ;;
    esac
}

# Function to wait for service to be healthy
wait_for_service() {
    local service="$1"
    local retries=0
    
    log_info "Waiting for $service to be healthy..."
    
    while [[ $retries -lt $MAX_RETRIES ]]; do
        if check_service_health "$service"; then
            log_success "$service is healthy"
            return 0
        fi
        
        retries=$((retries + 1))
        log_info "Waiting for $service... (attempt $retries/$MAX_RETRIES)"
        sleep "$HEALTH_CHECK_INTERVAL"
    done
    
    log_error "$service failed to become healthy after $MAX_RETRIES attempts"
    return 1
}

# Function to check port availability
check_port_availability() {
    local service="$1"
    local port_var="TRUXE_${service^^}_PORT"
    local port="${!port_var:-}"
    
    if [[ -z "$port" ]]; then
        log_warning "No port defined for $service"
        return 0
    fi
    
    if lsof -ti:$port >/dev/null 2>&1; then
        log_error "Port $port is already in use (required for $service)"
        return 1
    fi
    
    log_success "Port $port is available for $service"
    return 0
}

# Function to validate all ports before startup
validate_ports() {
    log_info "Validating port availability..."
    
    local port_conflicts=0
    
    # Check API port
    if ! check_port_availability "api"; then
        port_conflicts=$((port_conflicts + 1))
    fi
    
    # Check database port
    if ! check_port_availability "db"; then
        port_conflicts=$((port_conflicts + 1))
    fi
    
    # Check Redis port
    if ! check_port_availability "redis"; then
        port_conflicts=$((port_conflicts + 1))
    fi
    
    # Check Traefik ports
    if ! check_port_availability "traefik_dashboard"; then
        port_conflicts=$((port_conflicts + 1))
    fi
    
    # Check monitoring ports
    if ! check_port_availability "prometheus"; then
        port_conflicts=$((port_conflicts + 1))
    fi
    
    if ! check_port_availability "grafana"; then
        port_conflicts=$((port_conflicts + 1))
    fi
    
    if [[ $port_conflicts -gt 0 ]]; then
        log_error "Found $port_conflicts port conflicts. Please resolve them before starting."
        return 1
    fi
    
    log_success "All ports are available"
    return 0
}

# Function to start a service
start_service() {
    local service="$1"
    
    log_info "Starting $service..."
    
    # Start the service
    docker-compose -f "$COMPOSE_FILE" up -d "$service"
    
    # Wait for it to be healthy
    if ! wait_for_service "$service"; then
        log_error "Failed to start $service"
        return 1
    fi
    
    return 0
}

# Function to get services in dependency order
get_startup_order() {
    local -a ordered_services=()
    local -a remaining_services=()
    local -A started_services=()
    
    # Initialize remaining services
    for service in "${!SERVICE_DEPENDENCIES[@]}"; do
        remaining_services+=("$service")
    done
    
    # Process services until all are ordered
    while [[ ${#remaining_services[@]} -gt 0 ]]; do
        local -a next_batch=()
        local -a still_remaining=()
        
        for service in "${remaining_services[@]}"; do
            local dependencies="${SERVICE_DEPENDENCIES[$service]}"
            local can_start=true
            
            # Check if all dependencies are started
            if [[ -n "$dependencies" ]]; then
                for dep in $dependencies; do
                    if [[ -z "${started_services[$dep]:-}" ]]; then
                        can_start=false
                        break
                    fi
                done
            fi
            
            if $can_start; then
                next_batch+=("$service")
                started_services["$service"]=1
            else
                still_remaining+=("$service")
            fi
        done
        
        # Add next batch to ordered services
        for service in "${next_batch[@]}"; do
            ordered_services+=("$service")
        done
        
        # Update remaining services
        remaining_services=("${still_remaining[@]}")
        
        # Prevent infinite loop
        if [[ ${#next_batch[@]} -eq 0 && ${#remaining_services[@]} -gt 0 ]]; then
            log_error "Circular dependency detected in services: ${remaining_services[*]}"
            return 1
        fi
    done
    
    printf '%s\n' "${ordered_services[@]}"
}

# Function to perform pre-startup checks
pre_startup_checks() {
    log_info "Performing pre-startup checks..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running"
        return 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "docker-compose is not installed"
        return 1
    fi
    
    # Check if compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Compose file not found: $COMPOSE_FILE"
        return 1
    fi
    
    # Validate port configuration
    if ! validate_ports; then
        return 1
    fi
    
    # Check secrets
    if [[ ! -d "$PROJECT_ROOT/secrets" ]]; then
        log_warning "Secrets directory not found, creating..."
        mkdir -p "$PROJECT_ROOT/secrets"
    fi
    
    # Generate missing secrets
    if [[ ! -f "$PROJECT_ROOT/secrets/db_password.txt" ]]; then
        log_info "Generating database password..."
        openssl rand -base64 32 > "$PROJECT_ROOT/secrets/db_password.txt"
    fi
    
    if [[ ! -f "$PROJECT_ROOT/secrets/redis_password.txt" ]]; then
        log_info "Generating Redis password..."
        openssl rand -base64 32 > "$PROJECT_ROOT/secrets/redis_password.txt"
    fi
    
    log_success "Pre-startup checks completed"
    return 0
}

# Function to create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    local data_path="${DATA_PATH:-$PROJECT_ROOT/data}"
    
    mkdir -p "$data_path"/{postgres,redis,prometheus,grafana,consul,traefik}
    mkdir -p "$PROJECT_ROOT/logs"/{traefik,api}
    
    # Set proper permissions
    chmod 755 "$data_path"/*
    chmod 755 "$PROJECT_ROOT/logs"/*
    
    log_success "Directories created"
}

# Function to start all services in order
start_all_services() {
    log_info "Starting Truxe services in dependency order..."
    
    # Get startup order
    local -a startup_order
    mapfile -t startup_order < <(get_startup_order)
    
    if [[ ${#startup_order[@]} -eq 0 ]]; then
        log_error "Failed to determine startup order"
        return 1
    fi
    
    log_info "Startup order: ${startup_order[*]}"
    
    # Start services in order
    for service in "${startup_order[@]}"; do
        if ! start_service "$service"; then
            log_error "Failed to start $service, aborting startup"
            return 1
        fi
    done
    
    log_success "All services started successfully"
    return 0
}

# Function to display service status
show_status() {
    log_info "Service Status:"
    echo
    
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo
    log_info "Health Check Results:"
    
    for service in "${!HEALTH_ENDPOINTS[@]}"; do
        if check_service_health "$service"; then
            log_success "$service: Healthy"
        else
            log_error "$service: Unhealthy"
        fi
    done
}

# Function to cleanup on exit
cleanup() {
    local exit_code=$?
    
    if [[ $exit_code -ne 0 ]]; then
        log_error "Startup failed, cleaning up..."
        docker-compose -f "$COMPOSE_FILE" down
    fi
    
    exit $exit_code
}

# Main function
main() {
    log_info "Starting Truxe Enhanced Startup"
    log_info "Environment: $ENVIRONMENT"
    log_info "Compose file: $COMPOSE_FILE"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Perform pre-startup checks
    if ! pre_startup_checks; then
        log_error "Pre-startup checks failed"
        return 1
    fi
    
    # Create directories
    create_directories
    
    # Start services
    if ! start_all_services; then
        log_error "Service startup failed"
        return 1
    fi
    
    # Show final status
    show_status
    
    log_success "Truxe startup completed successfully!"
    
    # Show access URLs
    echo
    log_info "Access URLs:"
    echo "  API: http://localhost:${TRUXE_API_PORT:-21001}"
    echo "  Grafana: http://localhost:${TRUXE_GRAFANA_PORT:-21004}"
    echo "  Prometheus: http://localhost:${TRUXE_PROMETHEUS_PORT:-21005}"
    echo "  Traefik Dashboard: http://localhost:${TRUXE_TRAEFIK_DASHBOARD_PORT:-21081}"
    echo "  Consul: http://localhost:${TRUXE_CONSUL_PORT:-21500}"
    echo "  MailHog: http://localhost:${TRUXE_MAILHOG_WEB_PORT:-21825}"
    
    return 0
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

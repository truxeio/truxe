#!/bin/bash

# Truxe Deployment Testing Script
# Comprehensive testing for production deployments across multiple platforms

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$TEST_RESULTS_DIR/deployment-test-$TIMESTAMP.log"

# Test configuration
DEFAULT_TIMEOUT=300
API_TIMEOUT=30
HEALTH_CHECK_RETRIES=10
LOAD_TEST_DURATION="2m"
LOAD_TEST_VUS=10

# Create test results directory
mkdir -p "$TEST_RESULTS_DIR"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

# Test result tracking
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log "Running test: $test_name"
    
    if eval "$test_command"; then
        success "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        error "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("$test_name")
        return 1
    fi
}

# Utility functions
wait_for_service() {
    local url="$1"
    local timeout="${2:-$DEFAULT_TIMEOUT}"
    local retries="${3:-$HEALTH_CHECK_RETRIES}"
    
    log "Waiting for service at $url (timeout: ${timeout}s, retries: $retries)"
    
    for i in $(seq 1 $retries); do
        if curl -sf --max-time "$API_TIMEOUT" "$url" >/dev/null 2>&1; then
            success "Service is ready at $url"
            return 0
        fi
        
        if [ $i -lt $retries ]; then
            log "Attempt $i/$retries failed, waiting 10 seconds..."
            sleep 10
        fi
    done
    
    error "Service at $url is not ready after $retries attempts"
    return 1
}

check_http_status() {
    local url="$1"
    local expected_status="${2:-200}"
    
    local actual_status
    actual_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$API_TIMEOUT" "$url")
    
    if [ "$actual_status" = "$expected_status" ]; then
        return 0
    else
        error "Expected HTTP $expected_status, got $actual_status for $url"
        return 1
    fi
}

check_json_response() {
    local url="$1"
    local expected_field="$2"
    local expected_value="$3"
    
    local response
    response=$(curl -s --max-time "$API_TIMEOUT" "$url")
    
    if echo "$response" | jq -e ".$expected_field == \"$expected_value\"" >/dev/null 2>&1; then
        return 0
    else
        error "JSON field $expected_field does not match expected value $expected_value"
        error "Response: $response"
        return 1
    fi
}

# Docker Compose Tests
test_docker_compose() {
    log "Testing Docker Compose deployment"
    
    # Cleanup any existing containers
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down -v 2>/dev/null || true
    
    # Generate test secrets
    mkdir -p "$PROJECT_ROOT/secrets"
    openssl genpkey -algorithm RSA -out "$PROJECT_ROOT/secrets/jwt-private-key.pem" -pkcs8 2>/dev/null
    openssl rsa -pubout -in "$PROJECT_ROOT/secrets/jwt-private-key.pem" -out "$PROJECT_ROOT/secrets/jwt-public-key.pem" 2>/dev/null
    
    # Start services
    run_test "Docker Compose - Start services" \
        "cd '$PROJECT_ROOT' && docker-compose up -d --build"
    
    # Wait for services to be ready
    run_test "Docker Compose - API health check" \
        "wait_for_service 'http://localhost:3001/health'"
    
    # Test API endpoints
    run_test "Docker Compose - JWKS endpoint" \
        "check_http_status 'http://localhost:3001/.well-known/jwks.json'"
    
    run_test "Docker Compose - OpenID configuration" \
        "check_http_status 'http://localhost:3001/.well-known/openid-configuration'"
    
    # Test database connectivity
    run_test "Docker Compose - Database connection" \
        "docker-compose exec -T database pg_isready -U truxe -d truxe.io"
    
    # Test Redis connectivity
    run_test "Docker Compose - Redis connection" \
        "docker-compose exec -T redis redis-cli ping | grep -q PONG"
    
    # Test magic link endpoint (should return validation error, not 500)
    run_test "Docker Compose - Magic link validation" \
        "check_http_status 'http://localhost:3001/auth/magic-link' '400' -X POST -H 'Content-Type: application/json' -d '{\"email\":\"invalid\"}'"
    
    # Cleanup
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down -v
    rm -rf "$PROJECT_ROOT/secrets"
}

# Kubernetes Tests
test_kubernetes() {
    log "Testing Kubernetes deployment"
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        warning "kubectl not found, skipping Kubernetes tests"
        return 0
    fi
    
    # Check if cluster is accessible
    if ! kubectl cluster-info &>/dev/null; then
        warning "Kubernetes cluster not accessible, skipping Kubernetes tests"
        return 0
    fi
    
    local namespace="truxe-test-$TIMESTAMP"
    
    # Create test namespace
    run_test "Kubernetes - Create test namespace" \
        "kubectl create namespace '$namespace'"
    
    # Apply manifests
    run_test "Kubernetes - Apply secrets" \
        "kubectl apply -f '$PROJECT_ROOT/deploy/kubernetes/secrets.yaml' -n '$namespace'"
    
    run_test "Kubernetes - Apply configmaps" \
        "kubectl apply -f '$PROJECT_ROOT/deploy/kubernetes/configmap.yaml' -n '$namespace'"
    
    run_test "Kubernetes - Deploy database" \
        "kubectl apply -f '$PROJECT_ROOT/deploy/kubernetes/database.yaml' -n '$namespace'"
    
    run_test "Kubernetes - Deploy Redis" \
        "kubectl apply -f '$PROJECT_ROOT/deploy/kubernetes/redis.yaml' -n '$namespace'"
    
    run_test "Kubernetes - Deploy API" \
        "kubectl apply -f '$PROJECT_ROOT/deploy/kubernetes/api.yaml' -n '$namespace'"
    
    # Wait for deployments
    run_test "Kubernetes - Wait for database deployment" \
        "kubectl rollout status deployment/truxe-database -n '$namespace' --timeout=300s"
    
    run_test "Kubernetes - Wait for Redis deployment" \
        "kubectl rollout status deployment/truxe-redis -n '$namespace' --timeout=300s"
    
    run_test "Kubernetes - Wait for API deployment" \
        "kubectl rollout status deployment/truxe-api -n '$namespace' --timeout=300s"
    
    # Test pod health
    run_test "Kubernetes - Check pod status" \
        "kubectl get pods -n '$namespace' | grep -E '(Running|Completed)' | wc -l | grep -q '[3-9]'"
    
    # Port forward and test API
    kubectl port-forward -n "$namespace" service/truxe-api-service 8080:3001 &
    local port_forward_pid=$!
    
    sleep 10
    
    run_test "Kubernetes - API health check via port-forward" \
        "wait_for_service 'http://localhost:8080/health' 60 5"
    
    # Cleanup
    kill $port_forward_pid 2>/dev/null || true
    kubectl delete namespace "$namespace" --ignore-not-found=true
}

# Dokploy Tests
test_dokploy() {
    log "Testing Dokploy configuration"
    
    # Validate dokploy.json
    run_test "Dokploy - Validate configuration file" \
        "jq empty '$PROJECT_ROOT/dokploy.json'"
    
    # Check required fields
    run_test "Dokploy - Check required fields" \
        "jq -e '.name and .description and .compose and .domains' '$PROJECT_ROOT/dokploy.json' >/dev/null"
    
    # Validate compose file reference
    local compose_file
    compose_file=$(jq -r '.compose.file' "$PROJECT_ROOT/dokploy.json")
    
    run_test "Dokploy - Validate compose file exists" \
        "test -f '$PROJECT_ROOT/$compose_file'"
    
    # Validate environment variables
    run_test "Dokploy - Check required environment variables" \
        "jq -e '.environment.required | length > 0' '$PROJECT_ROOT/dokploy.json' >/dev/null"
}

# Performance Tests
test_performance() {
    local base_url="$1"
    
    log "Running performance tests against $base_url"
    
    # Check if k6 is available
    if ! command -v k6 &> /dev/null; then
        warning "k6 not found, skipping performance tests"
        return 0
    fi
    
    # Create k6 test script
    cat > "$TEST_RESULTS_DIR/performance-test.js" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // Test health endpoint
  let response = http.get(`${__ENV.BASE_URL}/health`);
  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Test JWKS endpoint
  response = http.get(`${__ENV.BASE_URL}/.well-known/jwks.json`);
  check(response, {
    'JWKS status is 200': (r) => r.status === 200,
    'JWKS response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
EOF
    
    # Run performance test
    run_test "Performance - Load test" \
        "BASE_URL='$base_url' k6 run '$TEST_RESULTS_DIR/performance-test.js'"
}

# Security Tests
test_security() {
    local base_url="$1"
    
    log "Running security tests against $base_url"
    
    # Test security headers
    run_test "Security - X-Frame-Options header" \
        "curl -s -I '$base_url/health' | grep -i 'x-frame-options'"
    
    run_test "Security - X-Content-Type-Options header" \
        "curl -s -I '$base_url/health' | grep -i 'x-content-type-options'"
    
    # Test rate limiting (if enabled)
    run_test "Security - Rate limiting response" \
        "for i in {1..20}; do curl -s '$base_url/health' >/dev/null; done; curl -s -o /dev/null -w '%{http_code}' '$base_url/health' | grep -E '(200|429)'"
    
    # Test invalid endpoints
    run_test "Security - 404 for invalid endpoints" \
        "check_http_status '$base_url/invalid-endpoint' '404'"
    
    # Test HTTPS redirect (if applicable)
    if [[ "$base_url" == https://* ]]; then
        local http_url="${base_url/https:/http:}"
        run_test "Security - HTTPS redirect" \
            "curl -s -o /dev/null -w '%{http_code}' '$http_url/health' | grep -E '(301|302|308)'"
    fi
}

# Monitoring Tests
test_monitoring() {
    local base_url="$1"
    
    log "Testing monitoring endpoints"
    
    # Test metrics endpoint
    run_test "Monitoring - Metrics endpoint" \
        "check_http_status '$base_url/metrics'"
    
    # Test metrics format
    run_test "Monitoring - Prometheus metrics format" \
        "curl -s '$base_url/metrics' | grep -E '^[a-zA-Z_][a-zA-Z0-9_]*{.*}\\s+[0-9]+(\\.[0-9]+)?$'"
    
    # Test health endpoint JSON structure
    run_test "Monitoring - Health endpoint JSON structure" \
        "check_json_response '$base_url/health' 'status' 'ok'"
}

# Integration Tests
test_integration() {
    local base_url="$1"
    
    log "Running integration tests against $base_url"
    
    # Test authentication flow
    local magic_link_response
    magic_link_response=$(curl -s -X POST "$base_url/auth/magic-link" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com"}' \
        -w "%{http_code}")
    
    # Should return 400 for missing configuration, not 500
    run_test "Integration - Magic link endpoint error handling" \
        "echo '$magic_link_response' | grep -E '(200|400|422)'"
    
    # Test JWKS endpoint structure
    run_test "Integration - JWKS endpoint structure" \
        "curl -s '$base_url/.well-known/jwks.json' | jq -e '.keys | length >= 0'"
    
    # Test OpenID configuration
    run_test "Integration - OpenID configuration structure" \
        "curl -s '$base_url/.well-known/openid-configuration' | jq -e '.issuer and .jwks_uri'"
}

# Main test execution
main() {
    log "Starting Truxe deployment tests"
    log "Test results will be saved to: $LOG_FILE"
    
    # Parse command line arguments
    local test_type="${1:-all}"
    local base_url="${2:-http://localhost:3001}"
    
    case "$test_type" in
        "docker")
            test_docker_compose
            ;;
        "kubernetes"|"k8s")
            test_kubernetes
            ;;
        "dokploy")
            test_dokploy
            ;;
        "performance")
            test_performance "$base_url"
            ;;
        "security")
            test_security "$base_url"
            ;;
        "monitoring")
            test_monitoring "$base_url"
            ;;
        "integration")
            test_integration "$base_url"
            ;;
        "api")
            # Test against running API
            wait_for_service "$base_url/health"
            test_integration "$base_url"
            test_security "$base_url"
            test_monitoring "$base_url"
            test_performance "$base_url"
            ;;
        "all")
            test_dokploy
            test_docker_compose
            test_kubernetes
            ;;
        *)
            error "Unknown test type: $test_type"
            echo "Usage: $0 [docker|kubernetes|dokploy|performance|security|monitoring|integration|api|all] [base_url]"
            exit 1
            ;;
    esac
    
    # Print test summary
    log "Test execution completed"
    echo
    echo "=========================================="
    echo "           TEST SUMMARY"
    echo "=========================================="
    echo "Total tests: $TESTS_TOTAL"
    success "Passed: $TESTS_PASSED"
    error "Failed: $TESTS_FAILED"
    echo
    
    if [ $TESTS_FAILED -gt 0 ]; then
        echo "Failed tests:"
        for test in "${FAILED_TESTS[@]}"; do
            error "  - $test"
        done
        echo
        error "Some tests failed. Check the log file for details: $LOG_FILE"
        exit 1
    else
        success "All tests passed! 🎉"
        echo "Full test log: $LOG_FILE"
        exit 0
    fi
}

# Handle script interruption
trap 'error "Tests interrupted"; exit 130' INT TERM

# Run main function
main "$@"

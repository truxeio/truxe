#!/bin/bash

# Truxe Alpha Release Script
# Comprehensive deployment with enhanced port management and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.alpha.yml"
ENV_FILE="env.alpha"
PROJECT_NAME="truxe-alpha"

echo -e "${BLUE}🚀 Truxe Alpha Release Deployment${NC}"
echo "=================================="

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi
print_status "Docker is running"

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    print_error "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi
print_status "Docker Compose is available"

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    print_error "Environment file $ENV_FILE not found. Please create it first."
    exit 1
fi
print_status "Environment file found"

# Check if JWT keys exist
if [ ! -f "secrets/jwt-private-key.pem" ] || [ ! -f "secrets/jwt-public-key.pem" ]; then
    print_error "JWT keys not found in secrets/ directory. Please generate them first."
    exit 1
fi
print_status "JWT keys found"

# Check port availability
echo -e "${BLUE}🔍 Checking port availability...${NC}"
node scripts/port-manager.js validate alpha
if [ $? -eq 0 ]; then
    print_status "Port validation passed"
else
    print_warning "Port validation failed, but continuing with deployment"
fi

# Stop existing containers
echo -e "${BLUE}🛑 Stopping existing containers...${NC}"
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE -p $PROJECT_NAME down --remove-orphans || true
print_status "Existing containers stopped"

# Build images
echo -e "${BLUE}🔨 Building Docker images...${NC}"
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE -p $PROJECT_NAME build --no-cache
print_status "Docker images built"

# Start services
echo -e "${BLUE}🚀 Starting services...${NC}"
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE -p $PROJECT_NAME up -d

# Wait for services to be healthy
echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Check service health
echo -e "${BLUE}🔍 Checking service health...${NC}"

# Load port configuration from environment
API_PORT=${TRUXE_API_PORT:-87001}
MONITOR_PORT=${TRUXE_MONITOR_PORT:-87080}
PROMETHEUS_PORT=${TRUXE_PROMETHEUS_PORT:-87005}
GRAFANA_PORT=${TRUXE_GRAFANA_PORT:-87004}
MAILHOG_PORT=${TRUXE_MAILHOG_WEB_PORT:-87825}

# Check API health
if curl -f http://localhost:$API_PORT/health > /dev/null 2>&1; then
    print_status "API service is healthy"
else
    print_error "API service is not responding"
    docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE -p $PROJECT_NAME logs api
    exit 1
fi

# Check Port Monitor health
if curl -f http://localhost:$MONITOR_PORT/health > /dev/null 2>&1; then
    print_status "Port Monitor service is healthy"
else
    print_warning "Port Monitor service is not responding"
fi

# Check Prometheus health
if curl -f http://localhost:$PROMETHEUS_PORT/-/healthy > /dev/null 2>&1; then
    print_status "Prometheus service is healthy"
else
    print_warning "Prometheus service is not responding"
fi

# Check Grafana health
if curl -f http://localhost:$GRAFANA_PORT/api/health > /dev/null 2>&1; then
    print_status "Grafana service is healthy"
else
    print_warning "Grafana service is not responding"
fi

# Display service information
echo -e "${BLUE}📊 Service Information${NC}"
echo "========================"
echo "API: http://localhost:$API_PORT"
echo "API Docs: http://localhost:$API_PORT/docs"
echo "Port Monitor: http://localhost:$MONITOR_PORT"
echo "Prometheus: http://localhost:$PROMETHEUS_PORT"
echo "Grafana: http://localhost:$GRAFANA_PORT (admin/alpha_grafana_admin_2024)"
echo "MailHog: http://localhost:$MAILHOG_PORT"

# Display port status
echo -e "${BLUE}🔍 Port Status${NC}"
echo "=============="
node scripts/port-manager.js status alpha

# Display container status
echo -e "${BLUE}📋 Container Status${NC}"
echo "===================="
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE -p $PROJECT_NAME ps

# Final status
echo -e "${GREEN}🎉 Truxe Alpha Release deployed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Test the API: curl http://localhost:$API_PORT/health"
echo "2. Check port monitoring: curl http://localhost:$MONITOR_PORT/status"
echo "3. View metrics: http://localhost:$PROMETHEUS_PORT"
echo "4. Access dashboard: http://localhost:$GRAFANA_PORT"
echo ""
echo "To stop the services:"
echo "docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE -p $PROJECT_NAME down"

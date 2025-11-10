#!/bin/bash
# Truxe Website Deployment Script
# This script deploys the Truxe website to production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Change to deployment directory
cd "$(dirname "$0")/.."

print_info "Starting Truxe Website deployment..."

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_error ".env.production file not found!"
    exit 1
fi

print_success "Environment file found"

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Check if we're deploying to remote server or local
if [ "$1" == "remote" ]; then
    print_info "Deploying to remote server..."

    # Get server details from environment or arguments
    SERVER_USER=${2:-root}
    SERVER_HOST=${3:-truxe.io}

    print_info "Server: $SERVER_USER@$SERVER_HOST"

    # Copy files to server
    print_info "Copying files to server..."
    rsync -avz --exclude 'node_modules' --exclude '.next' \
        ../packages/website/ $SERVER_USER@$SERVER_HOST:/opt/truxe/packages/website/

    rsync -avz docker-compose.production.yml $SERVER_USER@$SERVER_HOST:/opt/truxe/deployment/
    rsync -avz nginx/ $SERVER_USER@$SERVER_HOST:/opt/truxe/deployment/nginx/
    rsync -avz .env.production $SERVER_USER@$SERVER_HOST:/opt/truxe/deployment/

    print_success "Files copied to server"

    # Execute deployment on remote server
    print_info "Building and starting containers on remote server..."
    ssh $SERVER_USER@$SERVER_HOST "cd /opt/truxe/deployment && \
        docker-compose -f docker-compose.production.yml build website && \
        docker-compose -f docker-compose.production.yml up -d website && \
        docker-compose -f docker-compose.production.yml restart nginx"

    print_success "Remote deployment completed!"

else
    print_info "Deploying locally..."

    # Build the website container
    print_info "Building website container..."
    docker-compose -f docker-compose.production.yml build website

    print_success "Website container built"

    # Start the website container
    print_info "Starting website container..."
    docker-compose -f docker-compose.production.yml up -d website

    print_success "Website container started"

    # Restart nginx to pick up new configuration
    print_info "Restarting nginx..."
    docker-compose -f docker-compose.production.yml restart nginx

    print_success "Nginx restarted"

    # Show container status
    print_info "Container status:"
    docker-compose -f docker-compose.production.yml ps website nginx

    # Check website health
    print_info "Checking website health..."
    sleep 5

    if docker-compose -f docker-compose.production.yml exec -T website wget --quiet --tries=1 --spider http://localhost:3000/; then
        print_success "Website is healthy!"
    else
        print_warning "Website health check failed. Check logs with: docker-compose -f docker-compose.production.yml logs website"
    fi
fi

print_success "Deployment completed!"

# Show helpful commands
echo ""
print_info "Useful commands:"
echo "  View logs: docker-compose -f docker-compose.production.yml logs -f website"
echo "  Stop website: docker-compose -f docker-compose.production.yml stop website"
echo "  Restart website: docker-compose -f docker-compose.production.yml restart website"
echo "  View all containers: docker-compose -f docker-compose.production.yml ps"

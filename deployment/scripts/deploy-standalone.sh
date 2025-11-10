#!/bin/bash

# Truxe - Standalone Production Deployment Script
# This script deploys Truxe with its own Traefik instance (no Dokploy)

set -e  # Exit on error

# Always work from repository root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

cd "$REPO_DIR"

echo "🚀 Truxe Standalone Deployment"
echo "=================================="
echo ""
echo "📂 Repository: $REPO_DIR"
echo "📂 Deployment: $DEPLOY_DIR"
echo ""

# Check if .env.standalone exists
if [ ! -f "$DEPLOY_DIR/.env.standalone" ]; then
    echo "❌ Error: .env.standalone file not found!"
    echo ""
    echo "Please run quick-setup first:"
    echo "  cd $DEPLOY_DIR"
    echo "  ./scripts/quick-setup.sh"
    exit 1
fi

# Load environment variables
set -a
source "$DEPLOY_DIR/.env.standalone"
set +a

echo "📋 Configuration:"
echo "  Domain: $DOMAIN"
echo "  API URL: https://api.$DOMAIN"
echo "  Traefik Dashboard: https://traefik.$DOMAIN"
echo ""

# Check if JWT keys exist
if [ -z "$JWT_PRIVATE_KEY_BASE64" ] || [ -z "$JWT_PUBLIC_KEY_BASE64" ]; then
    echo "❌ Error: JWT keys not configured!"
    echo ""
    echo "Please run quick-setup to generate keys:"
    echo "  cd $DEPLOY_DIR"
    echo "  ./scripts/quick-setup.sh"
    exit 1
fi

# Check if secrets exist
if [ -z "$COOKIE_SECRET" ] || [ -z "$SESSION_SECRET" ]; then
    echo "❌ Error: Security secrets not configured!"
    echo ""
    echo "Please run quick-setup to generate secrets:"
    echo "  cd $DEPLOY_DIR"
    echo "  ./scripts/quick-setup.sh"
    exit 1
fi

echo "🔨 Building and deploying..."
echo ""

# Pull latest changes (if in git)
if [ -d "$REPO_DIR/.git" ]; then
    echo "📥 Pulling latest changes..."
    git pull
    echo ""
fi

# Detect docker compose command (docker-compose vs docker compose)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo "Using: $DOCKER_COMPOSE"
echo ""

# Stop existing containers
echo "🛑 Stopping existing containers..."
$DOCKER_COMPOSE -f deployment/docker-compose.standalone.yml --env-file deployment/.env.standalone down 2>/dev/null || true
echo ""

# Build images
echo "🏗️  Building images..."
$DOCKER_COMPOSE -f deployment/docker-compose.standalone.yml --env-file deployment/.env.standalone build --no-cache
echo ""

# Start services
echo "▶️  Starting services..."
$DOCKER_COMPOSE -f deployment/docker-compose.standalone.yml --env-file deployment/.env.standalone up -d
echo ""

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 15

# Check health
echo ""
echo "🏥 Health Check:"
$DOCKER_COMPOSE -f deployment/docker-compose.standalone.yml --env-file deployment/.env.standalone ps
echo ""

# Show logs
echo "📋 Recent logs:"
$DOCKER_COMPOSE -f deployment/docker-compose.standalone.yml --env-file deployment/.env.standalone logs --tail=50
echo ""

echo "✅ Deployment complete!"
echo ""
echo "🌐 Your API is available at: https://api.$DOMAIN"
echo "📊 Traefik Dashboard: https://traefik.$DOMAIN"
echo ""
echo "📝 Useful commands (run from $REPO_DIR):"
echo "  View logs: $DOCKER_COMPOSE -f deployment/docker-compose.standalone.yml logs -f"
echo "  Stop all: $DOCKER_COMPOSE -f deployment/docker-compose.standalone.yml down"
echo "  Restart: $DOCKER_COMPOSE -f deployment/docker-compose.standalone.yml restart api"
echo ""

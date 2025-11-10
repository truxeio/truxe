#!/bin/bash

# Remote deployment script for Truxe
# This script connects to the production server and deploys the latest code

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SERVER="deployer@truxe.io"
REPO_PATH="/home/deployer/Truxe"

echo -e "${GREEN}🚀 Starting remote deployment to production...${NC}"
echo ""

# Check SSH connection
echo -e "${YELLOW}Checking SSH connection...${NC}"
if ! ssh -o ConnectTimeout=5 "$SERVER" "echo 'Connected'" &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to server. Please check SSH keys.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ SSH connection successful${NC}"
echo ""

# Pull latest code
echo -e "${YELLOW}Pulling latest code from GitHub...${NC}"
ssh "$SERVER" "cd $REPO_PATH && git pull"
echo -e "${GREEN}✓ Code updated${NC}"
echo ""

# Deploy
echo -e "${YELLOW}Deploying containers...${NC}"
ssh "$SERVER" "cd $REPO_PATH && ./deployment/scripts/deploy-standalone.sh"
echo -e "${GREEN}✓ Deployment complete${NC}"
echo ""

# Wait for services to start
echo -e "${YELLOW}Waiting for services to start (30s)...${NC}"
sleep 30

# Check health
echo -e "${YELLOW}Checking API health...${NC}"
HEALTH=$(curl -s https://api.truxe.io/health | jq -r '.status')
echo "Status: $HEALTH"

if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "degraded" ]; then
    echo -e "${GREEN}✓ API is running${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Deployment successful!${NC}"
echo ""
echo "API: https://api.truxe.io"
echo "Health: https://api.truxe.io/health"
echo "Docs: https://api.truxe.io/docs"

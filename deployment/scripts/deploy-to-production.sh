#!/bin/bash
set -e

# Truxe Production Deployment Script
# Configure these variables for your server

SERVER="${TRUXE_SERVER:-your-server-name}"
SERVER_IP="${TRUXE_SERVER_IP:-your-server-ip}"
DEPLOY_DIR="${TRUXE_DEPLOY_DIR:-/opt/truxe}"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "Truxe Production Deployment"
echo "==========================================${NC}"
echo ""

# Check if .env.production exists
if [ ! -f "deployment/.env.production" ]; then
    echo -e "${RED}Error: deployment/.env.production not found!${NC}"
    echo ""
    echo "Please create it from template:"
    echo "  cp deployment/.env.production.template deployment/.env.production"
    echo "  vim deployment/.env.production"
    echo ""
    exit 1
fi

# Step 1: Test SSH connection
echo -e "${YELLOW}[1/7] Testing SSH connection to $SERVER...${NC}"
if ssh -o ConnectTimeout=5 $SERVER "echo 'SSH connection successful'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ SSH connection successful${NC}"
else
    echo -e "${RED}✗ SSH connection failed${NC}"
    echo "Please check your SSH configuration"
    exit 1
fi

# Step 2: Run server setup script
echo -e "${YELLOW}[2/7] Setting up server (Docker, Firewall, etc.)...${NC}"
scp deployment/scripts/setup-server.sh $SERVER:/tmp/
ssh $SERVER "chmod +x /tmp/setup-server.sh && /tmp/setup-server.sh"
echo -e "${GREEN}✓ Server setup completed${NC}"

# Step 3: Create deployment directory structure
echo -e "${YELLOW}[3/7] Creating deployment directories...${NC}"
ssh $SERVER "mkdir -p $DEPLOY_DIR/{deployment/{nginx/{conf.d,logs},ssl},api}"
echo -e "${GREEN}✓ Directories created${NC}"

# Step 4: Upload deployment files
echo -e "${YELLOW}[4/7] Uploading deployment files...${NC}"

# Upload docker-compose
scp deployment/docker-compose.production.yml $SERVER:$DEPLOY_DIR/docker-compose.yml

# Upload nginx config
scp deployment/nginx/nginx.conf $SERVER:$DEPLOY_DIR/deployment/nginx/
scp deployment/nginx/conf.d/truxe-api.conf $SERVER:$DEPLOY_DIR/deployment/nginx/conf.d/

# Upload environment file
scp deployment/.env.production $SERVER:$DEPLOY_DIR/.env

echo -e "${GREEN}✓ Deployment files uploaded${NC}"

# Step 5: Upload API code
echo -e "${YELLOW}[5/7] Uploading API code...${NC}"
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='*.log' \
    api/ $SERVER:$DEPLOY_DIR/api/
echo -e "${GREEN}✓ API code uploaded${NC}"

# Step 6: Start services
echo -e "${YELLOW}[6/7] Starting Docker services...${NC}"
ssh $SERVER "cd $DEPLOY_DIR && docker-compose pull && docker-compose up -d"
echo -e "${GREEN}✓ Services started${NC}"

# Step 7: Wait and check health
echo -e "${YELLOW}[7/7] Checking service health...${NC}"
sleep 10

HEALTH_CHECK=$(ssh $SERVER "curl -s -o /dev/null -w '%{http_code}' http://localhost:87001/health" || echo "000")

if [ "$HEALTH_CHECK" == "200" ]; then
    echo -e "${GREEN}✓ Health check passed (HTTP $HEALTH_CHECK)${NC}"
else
    echo -e "${RED}✗ Health check failed (HTTP $HEALTH_CHECK)${NC}"
    echo ""
    echo "Checking logs:"
    ssh $SERVER "cd $DEPLOY_DIR && docker-compose logs --tail=50 truxe-api"
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✓ Deployment completed successfully!"
echo "==========================================${NC}"
echo ""
echo -e "${BLUE}Service Information:${NC}"
echo "  Server: $SERVER ($SERVER_IP)"
echo "  API (internal): http://localhost:87001"
echo "  Health check: http://localhost:87001/health"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Configure DNS:"
echo "     - api.truxe.io → $SERVER_IP"
echo "  2. Set up SSL certificate:"
echo "     ssh $SERVER"
echo "     certbot certonly --nginx -d api.truxe.io"
echo "  3. Test external access:"
echo "     curl https://api.truxe.io/health"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  View logs:     ssh $SERVER 'cd $DEPLOY_DIR && docker-compose logs -f'"
echo "  Restart:       ssh $SERVER 'cd $DEPLOY_DIR && docker-compose restart'"
echo "  Stop:          ssh $SERVER 'cd $DEPLOY_DIR && docker-compose down'"
echo "  Shell access:  ssh $SERVER 'cd $DEPLOY_DIR && docker-compose exec truxe-api sh'"
echo ""
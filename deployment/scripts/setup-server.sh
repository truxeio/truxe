#!/bin/bash
set -e

# Truxe Server Setup Script
# This script sets up a fresh Hetzner server for Truxe deployment

echo "=========================================="
echo "Truxe Production Server Setup"
echo "=========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Update system
echo -e "${YELLOW}[1/8] Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# Step 2: Install essential packages
echo -e "${YELLOW}[2/8] Installing essential packages...${NC}"
apt-get install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    ufw \
    fail2ban \
    certbot \
    python3-certbot-nginx

# Step 3: Install Docker
echo -e "${YELLOW}[3/8] Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}✓ Docker installed${NC}"
else
    echo -e "${GREEN}✓ Docker already installed${NC}"
fi

# Step 4: Install Docker Compose
echo -e "${YELLOW}[4/8] Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✓ Docker Compose already installed${NC}"
fi

# Step 5: Configure Firewall
echo -e "${YELLOW}[5/8] Configuring firewall...${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload
echo -e "${GREEN}✓ Firewall configured${NC}"

# Step 6: Configure Fail2Ban
echo -e "${YELLOW}[6/8] Configuring Fail2Ban...${NC}"
systemctl enable fail2ban
systemctl start fail2ban
echo -e "${GREEN}✓ Fail2Ban configured${NC}"

# Step 7: Create deployment directory
echo -e "${YELLOW}[7/8] Creating deployment directory...${NC}"
mkdir -p /opt/truxe
mkdir -p /opt/truxe/deployment/nginx/conf.d
mkdir -p /opt/truxe/deployment/nginx/logs
mkdir -p /opt/truxe/deployment/ssl
mkdir -p /opt/truxe/api
echo -e "${GREEN}✓ Directories created${NC}"

# Step 8: Display system info
echo -e "${YELLOW}[8/8] System information:${NC}"
echo ""
echo "Hostname: $(hostname)"
echo "IP Address: $(curl -s ifconfig.me)"
echo "OS: $(lsb_release -d | cut -f2)"
echo "Docker: $(docker --version)"
echo "Docker Compose: $(docker-compose --version)"
echo ""

echo -e "${GREEN}=========================================="
echo -e "✓ Server setup completed successfully!"
echo -e "==========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Clone Truxe repository to /opt/truxe"
echo "2. Copy deployment files to /opt/truxe/deployment"
echo "3. Configure .env.production with your secrets"
echo "4. Point DNS to: $(curl -s ifconfig.me)"
echo "5. Run: cd /opt/truxe && docker-compose -f deployment/docker-compose.production.yml up -d"
echo ""
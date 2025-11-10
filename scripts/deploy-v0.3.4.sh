#!/bin/bash

# Truxe v0.3.4 Production Deployment Script
# Feature: Email Verification & Enhanced Templates
# Date: November 3, 2025

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PRODUCTION_HOST="${PRODUCTION_HOST:-truxe.io}"
PRODUCTION_USER="${PRODUCTION_USER:-truxe}"
PRODUCTION_PATH="${PRODUCTION_PATH:-/var/www/truxe}"
DB_NAME="${DB_NAME:-truxe_prod}"
VERSION="v0.3.4"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║       🚀 TRUXE v0.3.4 PRODUCTION DEPLOYMENT                      ║"
echo "║       Email Verification & Enhanced Templates                       ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Phase 1: Pre-deployment checks
echo -e "${BLUE}📋 Phase 1: Pre-deployment Validation${NC}"
echo "══════════════════════════════════════════════════════════════════════"

echo -e "${YELLOW}→ Checking git status...${NC}"
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}✗ Working directory not clean. Commit or stash changes first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git status clean${NC}"

echo -e "${YELLOW}→ Verifying tag exists...${NC}"
if ! git tag | grep -q "^${VERSION}$"; then
    echo -e "${RED}✗ Tag ${VERSION} not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tag ${VERSION} exists${NC}"

echo -e "${YELLOW}→ Running tests...${NC}"
cd api && npm test -- --silent 2>&1 | grep -E "(PASS|FAIL|Tests:)" | tail -3
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo -e "${RED}✗ Tests failed${NC}"
    exit 1
fi
cd ..
echo -e "${GREEN}✓ All tests passing${NC}"

echo ""

# Phase 2: Database backup
echo -e "${BLUE}📋 Phase 2: Database Backup${NC}"
echo "══════════════════════════════════════════════════════════════════════"

echo -e "${YELLOW}→ Creating database backup on production...${NC}"
ssh ${PRODUCTION_USER}@${PRODUCTION_HOST} << 'ENDSSH'
    BACKUP_DIR="/backups/truxe"
    BACKUP_FILE="truxe_pre_v0.3.4_$(date +%Y%m%d_%H%M%S).backup"

    mkdir -p $BACKUP_DIR

    # Create backup
    PGPASSWORD=$DB_PASSWORD pg_dump \
        -h localhost \
        -U truxe \
        -d truxe_prod \
        -F c \
        -b \
        -v \
        -f "$BACKUP_DIR/$BACKUP_FILE"

    echo "✓ Backup created: $BACKUP_FILE"
    ls -lh "$BACKUP_DIR/$BACKUP_FILE"
ENDSSH

echo -e "${GREEN}✓ Database backup complete${NC}"
echo ""

# Phase 3: Database migration
echo -e "${BLUE}📋 Phase 3: Database Migration${NC}"
echo "══════════════════════════════════════════════════════════════════════"

echo -e "${YELLOW}→ Uploading migration file...${NC}"
scp database/migrations/022_email_verification.sql \
    ${PRODUCTION_USER}@${PRODUCTION_HOST}:${PRODUCTION_PATH}/database/migrations/

echo -e "${YELLOW}→ Running migration on production...${NC}"
ssh ${PRODUCTION_USER}@${PRODUCTION_HOST} << 'ENDSSH'
    cd /var/www/truxe

    PGPASSWORD=$DB_PASSWORD psql \
        -h localhost \
        -U truxe \
        -d truxe_prod \
        -f database/migrations/022_email_verification.sql

    echo "✓ Migration completed"

    # Verify migration
    echo "Verifying migration..."
    PGPASSWORD=$DB_PASSWORD psql -h localhost -U truxe -d truxe_prod \
        -c "\dt email_verification_tokens" 2>&1 | grep -q "email_verification_tokens"

    if [ $? -eq 0 ]; then
        echo "✓ Migration verified: email_verification_tokens table exists"
    else
        echo "✗ Migration verification failed"
        exit 1
    fi
ENDSSH

echo -e "${GREEN}✓ Database migration complete${NC}"
echo ""

# Phase 4: Update application code
echo -e "${BLUE}📋 Phase 4: Application Update${NC}"
echo "══════════════════════════════════════════════════════════════════════"

echo -e "${YELLOW}→ Pulling latest code on production...${NC}"
ssh ${PRODUCTION_USER}@${PRODUCTION_HOST} << ENDSSH
    cd ${PRODUCTION_PATH}

    # Fetch latest
    git fetch origin

    # Checkout version
    git checkout ${VERSION}

    echo "✓ Checked out ${VERSION}"

    # Install dependencies
    cd api
    npm install --production

    echo "✓ Dependencies installed"
ENDSSH

echo -e "${GREEN}✓ Application code updated${NC}"
echo ""

# Phase 5: Update environment variables
echo -e "${BLUE}📋 Phase 5: Environment Configuration${NC}"
echo "══════════════════════════════════════════════════════════════════════"

echo -e "${YELLOW}→ Updating environment variables...${NC}"
ssh ${PRODUCTION_USER}@${PRODUCTION_HOST} << 'ENDSSH'
    cd /var/www/truxe

    # Backup current .env
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

    # Add email verification configuration
    if ! grep -q "EMAIL_VERIFICATION_BASE_URL" .env; then
        cat >> .env << 'EOF'

# Email Verification Configuration (v0.3.4)
EMAIL_VERIFICATION_BASE_URL=https://truxe.io
EMAIL_VERIFICATION_TOKEN_EXPIRY=86400
EMAIL_VERIFICATION_RESEND_COOLDOWN=300
EOF
        echo "✓ Email verification config added"
    else
        echo "✓ Email verification config already exists"
    fi
ENDSSH

echo -e "${GREEN}✓ Environment variables configured${NC}"
echo ""

# Phase 6: Restart application
echo -e "${BLUE}📋 Phase 6: Application Restart${NC}"
echo "══════════════════════════════════════════════════════════════════════"

echo -e "${YELLOW}→ Restarting application...${NC}"
ssh ${PRODUCTION_USER}@${PRODUCTION_HOST} << 'ENDSSH'
    # Restart using PM2
    pm2 reload truxe-api --update-env

    # Wait for startup
    sleep 5

    echo "✓ Application restarted"
ENDSSH

echo -e "${GREEN}✓ Application restart complete${NC}"
echo ""

# Phase 7: Restart BullMQ worker (if applicable)
echo -e "${BLUE}📋 Phase 7: Worker Restart${NC}"
echo "══════════════════════════════════════════════════════════════════════"

echo -e "${YELLOW}→ Restarting BullMQ worker...${NC}"
ssh ${PRODUCTION_USER}@${PRODUCTION_HOST} << 'ENDSSH'
    # Check if worker is running
    if pm2 list | grep -q "truxe-worker"; then
        pm2 reload truxe-worker
        echo "✓ Worker restarted"
    else
        echo "ℹ Worker not configured, skipping"
    fi
ENDSSH

echo -e "${GREEN}✓ Worker restart complete${NC}"
echo ""

# Phase 8: Health checks
echo -e "${BLUE}📋 Phase 8: Health Checks${NC}"
echo "══════════════════════════════════════════════════════════════════════"

echo -e "${YELLOW}→ Running health checks...${NC}"

# Wait for application to be ready
sleep 10

# Check health endpoint
echo "Checking API health..."
HEALTH_RESPONSE=$(curl -s https://truxe.io/health || echo "failed")

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✓ API health check passed${NC}"
else
    echo -e "${RED}✗ API health check failed${NC}"
    echo "$HEALTH_RESPONSE"
    exit 1
fi

# Check email verification endpoint
echo "Checking email verification endpoint..."
VERIFY_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST https://truxe.io/api/auth/email/send-verification \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}' || echo "000")

if [ "$VERIFY_RESPONSE" = "200" ] || [ "$VERIFY_RESPONSE" = "400" ]; then
    echo -e "${GREEN}✓ Email verification endpoint accessible${NC}"
else
    echo -e "${RED}✗ Email verification endpoint failed (HTTP $VERIFY_RESPONSE)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All health checks passed${NC}"
echo ""

# Phase 9: Deployment summary
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║  ✅ DEPLOYMENT COMPLETE! v0.3.4 is now live on truxe.io     ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

echo -e "${GREEN}📊 Deployment Summary:${NC}"
echo "  • Version: ${VERSION}"
echo "  • Feature: Email Verification & Enhanced Templates"
echo "  • Database: Migration 022 applied"
echo "  • Application: Code updated and restarted"
echo "  • Health checks: All passing"
echo ""

echo -e "${YELLOW}📝 Post-Deployment Tasks:${NC}"
echo "  1. Monitor logs for any errors"
echo "  2. Test email verification flow manually"
echo "  3. Check email delivery success rate"
echo "  4. Monitor token generation/validation metrics"
echo "  5. Setup alerts for email verification failures"
echo ""

echo -e "${BLUE}📖 Documentation:${NC}"
echo "  • Deployment guide: docs/v0.3/PRODUCTION_DEPLOYMENT_v0.3.4.md"
echo "  • CHANGELOG: CHANGELOG.md"
echo "  • API docs: Update with new endpoints"
echo ""

echo -e "${GREEN}🎉 Deployment successful!${NC}"

#!/bin/bash

# Truxe - Quick Setup Script
# Interactive setup wizard for first-time deployment

set -e

# Get the deployment directory (parent of scripts)
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Truxe - Quick Setup Wizard                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Auto-pull latest changes if in a git repo
if [ -d "$REPO_DIR/.git" ]; then
    echo "📥 Pulling latest changes..."
    cd "$REPO_DIR"
    git pull
    echo "✓ Repository updated"
    echo ""
fi

# Check if $DEPLOY_DIR/.env.standalone already exists
if [ -f $DEPLOY_DIR/.env.standalone ]; then
    echo "⚠️  $DEPLOY_DIR/.env.standalone already exists!"
    read -p "Do you want to overwrite it? (yes/no): " overwrite
    if [ "$overwrite" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi
fi

# Start fresh
cp $DEPLOY_DIR/.env.standalone.example $DEPLOY_DIR/.env.standalone

echo "📝 Configuring Truxe deployment..."
echo ""

# Use defaults for domain and email
domain="truxe.io"
acme_email="admin@truxe.io"

echo "✓ Domain: $domain"
echo "✓ Email: $acme_email"
echo ""

sed -i "s|DOMAIN=.*|DOMAIN=$domain|" $DEPLOY_DIR/.env.standalone
sed -i "s|ACME_EMAIL=.*|ACME_EMAIL=$acme_email|" $DEPLOY_DIR/.env.standalone

# Generate all secrets automatically
echo "🔐 Generating security credentials..."
db_password=$(openssl rand -base64 32)
redis_password=$(openssl rand -base64 32)
cookie_secret=$(openssl rand -base64 32)
session_secret=$(openssl rand -base64 32)

# Generate JWT keys
mkdir -p $DEPLOY_DIR/../api
openssl genrsa -out $DEPLOY_DIR/../api/jwt-private-key.pem 2048 2>/dev/null
openssl rsa -in $DEPLOY_DIR/../api/jwt-private-key.pem -pubout -out $DEPLOY_DIR/../api/jwt-public-key.pem 2>/dev/null

jwt_private_base64=$(cat $DEPLOY_DIR/../api/jwt-private-key.pem | base64 -w 0 2>/dev/null || cat $DEPLOY_DIR/../api/jwt-private-key.pem | base64)
jwt_public_base64=$(cat $DEPLOY_DIR/../api/jwt-public-key.pem | base64 -w 0 2>/dev/null || cat $DEPLOY_DIR/../api/jwt-public-key.pem | base64)

# Apply all configs
sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$db_password|" $DEPLOY_DIR/.env.standalone
sed -i "s|REDIS_PASSWORD=.*|REDIS_PASSWORD=$redis_password|" $DEPLOY_DIR/.env.standalone
sed -i "s|JWT_PRIVATE_KEY_BASE64=.*|JWT_PRIVATE_KEY_BASE64=$jwt_private_base64|" $DEPLOY_DIR/.env.standalone
sed -i "s|JWT_PUBLIC_KEY_BASE64=.*|JWT_PUBLIC_KEY_BASE64=$jwt_public_base64|" $DEPLOY_DIR/.env.standalone
sed -i "s|COOKIE_SECRET=.*|COOKIE_SECRET=$cookie_secret|" $DEPLOY_DIR/.env.standalone
sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$session_secret|" $DEPLOY_DIR/.env.standalone

echo "✓ Database password"
echo "✓ Redis password"
echo "✓ JWT keys"
echo "✓ Security secrets"
echo ""

# Traefik dashboard (only thing we ask)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 TRAEFIK DASHBOARD CREDENTIALS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "Username [admin]: " traefik_user
traefik_user=${traefik_user:-admin}
read -sp "Password: " traefik_pass
echo ""

if command -v htpasswd &> /dev/null; then
    traefik_auth=$(htpasswd -nb "$traefik_user" "$traefik_pass")
    echo "✓ Traefik credentials configured"
else
    echo "⚠️  htpasswd not found. Using online method..."
    echo "Please generate htpasswd manually:"
    echo "  1. Visit: https://hostingcanada.org/htpasswd-generator/"
    echo "  2. Enter username: $traefik_user"
    echo "  3. Enter password: (your password)"
    read -p "Paste the generated htpasswd string: " traefik_auth
    echo "✓ Traefik credentials configured"
fi

sed -i "s|TRAEFIK_AUTH=.*|TRAEFIK_AUTH=$traefik_auth|" $DEPLOY_DIR/.env.standalone
echo ""

# Configure Brevo API key (user must provide their own)
echo "⚠️  You need a Brevo API key for email functionality"
echo "   Sign up at: https://www.brevo.com/ (FREE tier: 300 emails/day)"
read -p "Paste your Brevo API key (or press Enter to skip): " brevo_key

if [ -z "$brevo_key" ]; then
    echo "⚠️  Skipping email configuration - you can add it later to .env.standalone"
    brevo_key="your-brevo-api-key-here"
fi

email_from="noreply@$domain"
cors_origin="https://$domain https://app.$domain"

sed -i "s|BREVO_API_KEY=.*|BREVO_API_KEY=$brevo_key|" $DEPLOY_DIR/.env.standalone
sed -i "s|EMAIL_FROM=.*|EMAIL_FROM=$email_from|" $DEPLOY_DIR/.env.standalone
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=\"$cors_origin\"|" $DEPLOY_DIR/.env.standalone

echo "✓ Email configuration (Brevo)"
echo "✓ CORS origins"
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  Configuration Complete                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Summary:"
echo "  • Domain: $domain"
echo "  • API URL: https://api.$domain"
echo "  • Traefik Dashboard: https://traefik.$domain"
echo "  • Email: $email_from"
echo "  • CORS Origins: $cors_origin"
echo ""
echo "🔐 Security (passwords saved in $DEPLOY_DIR/.env.standalone):"
echo "  • Database password: Generated"
echo "  • Redis password: Generated"
echo "  • Cookie secret: Generated"
echo "  • Session secret: Generated"
echo "  • JWT keys: Generated"
echo "  • Traefik auth: Configured"
echo ""
echo "⚠️  IMPORTANT: Make sure DNS is configured:"
echo "  A  api.$domain      → Your Server IP"
echo "  A  traefik.$domain  → Your Server IP"
echo ""
echo "✅ Configuration saved to $DEPLOY_DIR/.env.standalone"
echo ""
echo "🚀 Starting deployment..."
"$DEPLOY_DIR/scripts/deploy-standalone.sh"

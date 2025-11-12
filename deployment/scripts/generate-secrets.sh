#!/bin/bash

echo "=================================================="
echo "Truxe Production Secrets Generator"
echo "=================================================="
echo ""

# Function to generate random password
generate_secret() {
    openssl rand -base64 32 | tr -d '\n'
}

# Function to generate JWT keys
generate_jwt_keys() {
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    cd $TEMP_DIR
    
    # Generate RSA private key (2048 bits)
    openssl genrsa -out private.pem 2048 2>/dev/null
    
    # Extract public key
    openssl rsa -in private.pem -pubout -out public.pem 2>/dev/null
    
    # Base64 encode (single line)
    PRIVATE_KEY=$(cat private.pem | base64 | tr -d '\n')
    PUBLIC_KEY=$(cat public.pem | base64 | tr -d '\n')
    
    # Cleanup
    cd - > /dev/null
    rm -rf $TEMP_DIR
    
    echo "$PRIVATE_KEY|$PUBLIC_KEY"
}

echo "Generating secrets... (this may take a few seconds)"
echo ""

# Generate all secrets
DB_PASSWORD=$(generate_secret)
REDIS_PASSWORD=$(generate_secret)
COOKIE_SECRET=$(generate_secret)
SESSION_SECRET=$(generate_secret)
OAUTH_STATE_SECRET=$(generate_secret)
OAUTH_TOKEN_ENCRYPTION_KEY=$(generate_secret)

# Generate JWT keys
echo "Generating RSA key pair for JWT..."
JWT_KEYS=$(generate_jwt_keys)
JWT_PRIVATE_KEY_BASE64=$(echo "$JWT_KEYS" | cut -d'|' -f1)
JWT_PUBLIC_KEY_BASE64=$(echo "$JWT_KEYS" | cut -d'|' -f2)

echo "=================================================="
echo "✅ All secrets generated successfully!"
echo "=================================================="
echo ""
echo "Copy the following to your .env.production file:"
echo ""
echo "=================================================="

cat << EOF

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
DB_PASSWORD=$DB_PASSWORD

# =============================================================================
# REDIS CONFIGURATION
# =============================================================================
REDIS_PASSWORD=$REDIS_PASSWORD

# =============================================================================
# JWT CONFIGURATION
# =============================================================================
JWT_PRIVATE_KEY_BASE64=$JWT_PRIVATE_KEY_BASE64
JWT_PUBLIC_KEY_BASE64=$JWT_PUBLIC_KEY_BASE64

# =============================================================================
# BREVO EMAIL SERVICE
# Get from: https://app.brevo.com/settings/keys/api
# =============================================================================
BREVO_API_KEY=your_brevo_api_key_here
BREVO_LIST_ID=your_brevo_list_id_here

# =============================================================================
# GITHUB OAUTH (Optional)
# Create at: https://github.com/settings/developers
# =============================================================================
GITHUB_CLIENT_ID=your_github_oauth_client_id_here
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret_here

# =============================================================================
# SECURITY SECRETS
# =============================================================================
COOKIE_SECRET=$COOKIE_SECRET
SESSION_SECRET=$SESSION_SECRET
OAUTH_STATE_SECRET=$OAUTH_STATE_SECRET
OAUTH_TOKEN_ENCRYPTION_KEY=$OAUTH_TOKEN_ENCRYPTION_KEY

# =============================================================================
# PRODUCTION URLS
# =============================================================================
FRONTEND_URL=https://truxe.io
API_URL=https://api.truxe.io

EOF

echo "=================================================="
echo ""
echo "📝 NEXT STEPS:"
echo ""
echo "1. Copy the output above to your .env.production file"
echo "2. Fill in BREVO_API_KEY and BREVO_LIST_ID manually"
echo "3. Fill in GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET if using GitHub OAuth"
echo "4. IMPORTANT: Save this file securely (password manager, 1Password, etc.)"
echo "5. Never commit .env.production to git!"
echo ""
echo "=================================================="


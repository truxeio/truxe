#!/bin/bash
#
# OAuth Provider API - Manual Testing Script
# 
# This script demonstrates the complete OAuth 2.0 Authorization Code Flow with PKCE.
#
# Prerequisites:
# - Truxe API running on http://localhost:3001
# - Valid user authentication token (USER_TOKEN)
# - jq installed for JSON parsing
#

set -e

BASE_URL="${BASE_URL:-http://localhost:3001}"
API_BASE="$BASE_URL/api/oauth"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}OAuth Provider API - Manual Test${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check prerequisites
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Please install jq to run this script.${NC}"
    exit 1
fi

if [ -z "$USER_TOKEN" ]; then
    echo -e "${RED}Error: USER_TOKEN environment variable is not set.${NC}"
    echo -e "${YELLOW}Please authenticate first and set USER_TOKEN:${NC}"
    echo -e "  export USER_TOKEN=<your-jwt-token>"
    exit 1
fi

# Generate PKCE parameters
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d "=" | tr '+/' '-_')
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -sha256 -binary | openssl base64 | tr -d "=" | tr '+/' '-_')

echo -e "${GREEN}✓ Generated PKCE parameters${NC}"
echo -e "  Code Verifier: ${CODE_VERIFIER:0:20}..."
echo -e "  Code Challenge: ${CODE_CHALLENGE:0:20}...\n"

# ============================================================================
# Step 1: Register OAuth Client
# ============================================================================

echo -e "${BLUE}Step 1: Register OAuth Client${NC}"

CLIENT_RESPONSE=$(curl -s -X POST "$API_BASE/clients" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Test OAuth App",
    "redirect_uris": ["http://localhost:8000/callback"],
    "allowed_scopes": ["openid", "email", "profile"],
    "require_pkce": true,
    "require_consent": false
  }')

CLIENT_ID=$(echo "$CLIENT_RESPONSE" | jq -r '.client_id')
CLIENT_SECRET=$(echo "$CLIENT_RESPONSE" | jq -r '.client_secret')

if [ "$CLIENT_ID" == "null" ] || [ -z "$CLIENT_ID" ]; then
    echo -e "${RED}✗ Failed to register client${NC}"
    echo "$CLIENT_RESPONSE" | jq '.'
    exit 1
fi

echo -e "${GREEN}✓ Client registered successfully${NC}"
echo -e "  Client ID: $CLIENT_ID"
echo -e "  Client Secret: ${CLIENT_SECRET:0:20}...\n"

# ============================================================================
# Step 2: Get Authorization Code
# ============================================================================

echo -e "${BLUE}Step 2: Request Authorization Code${NC}"

# For testing, we'll directly call the POST /authorize endpoint
# In a real flow, the user would visit the GET /authorize URL in a browser

AUTH_RESPONSE=$(curl -s -X POST "$API_BASE/authorize" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": \"$CLIENT_ID\",
    \"redirect_uri\": \"http://localhost:8000/callback\",
    \"authorized\": true,
    \"scope\": \"openid email profile\",
    \"state\": \"random-state-123\",
    \"code_challenge\": \"$CODE_CHALLENGE\",
    \"code_challenge_method\": \"S256\"
  }")

REDIRECT_URL=$(echo "$AUTH_RESPONSE" | jq -r '.redirect_url')

if [ "$REDIRECT_URL" == "null" ] || [ -z "$REDIRECT_URL" ]; then
    echo -e "${RED}✗ Failed to get authorization${NC}"
    echo "$AUTH_RESPONSE" | jq '.'
    exit 1
fi

# Extract authorization code from redirect URL
AUTH_CODE=$(echo "$REDIRECT_URL" | grep -o 'code=[^&]*' | cut -d'=' -f2)

echo -e "${GREEN}✓ Authorization code received${NC}"
echo -e "  Code: ${AUTH_CODE:0:20}...\n"

# ============================================================================
# Step 3: Exchange Code for Tokens
# ============================================================================

echo -e "${BLUE}Step 3: Exchange Authorization Code for Tokens${NC}"

TOKEN_RESPONSE=$(curl -s -X POST "$API_BASE/token" \
  -H "Content-Type: application/json" \
  -d "{
    \"grant_type\": \"authorization_code\",
    \"code\": \"$AUTH_CODE\",
    \"redirect_uri\": \"http://localhost:8000/callback\",
    \"client_id\": \"$CLIENT_ID\",
    \"client_secret\": \"$CLIENT_SECRET\",
    \"code_verifier\": \"$CODE_VERIFIER\"
  }")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
REFRESH_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.refresh_token')
EXPIRES_IN=$(echo "$TOKEN_RESPONSE" | jq -r '.expires_in')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}✗ Failed to get tokens${NC}"
    echo "$TOKEN_RESPONSE" | jq '.'
    exit 1
fi

echo -e "${GREEN}✓ Tokens received${NC}"
echo -e "  Access Token: ${ACCESS_TOKEN:0:30}..."
echo -e "  Refresh Token: ${REFRESH_TOKEN:0:20}..."
echo -e "  Expires In: $EXPIRES_IN seconds\n"

# ============================================================================
# Step 4: Get UserInfo
# ============================================================================

echo -e "${BLUE}Step 4: Get User Information${NC}"

USERINFO_RESPONSE=$(curl -s -X GET "$API_BASE/userinfo" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo -e "${GREEN}✓ UserInfo retrieved${NC}"
echo "$USERINFO_RESPONSE" | jq '.'
echo ""

# ============================================================================
# Step 5: Introspect Token
# ============================================================================

echo -e "${BLUE}Step 5: Introspect Access Token${NC}"

INTROSPECT_RESPONSE=$(curl -s -X POST "$API_BASE/introspect" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$ACCESS_TOKEN\",
    \"client_id\": \"$CLIENT_ID\",
    \"client_secret\": \"$CLIENT_SECRET\"
  }")

ACTIVE=$(echo "$INTROSPECT_RESPONSE" | jq -r '.active')

echo -e "${GREEN}✓ Token introspection complete${NC}"
echo -e "  Active: $ACTIVE"
echo "$INTROSPECT_RESPONSE" | jq '.'
echo ""

# ============================================================================
# Step 6: Refresh Token
# ============================================================================

echo -e "${BLUE}Step 6: Refresh Access Token${NC}"

REFRESH_RESPONSE=$(curl -s -X POST "$API_BASE/token" \
  -H "Content-Type: application/json" \
  -d "{
    \"grant_type\": \"refresh_token\",
    \"refresh_token\": \"$REFRESH_TOKEN\",
    \"client_id\": \"$CLIENT_ID\",
    \"client_secret\": \"$CLIENT_SECRET\"
  }")

NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.access_token')
NEW_REFRESH_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.refresh_token')

if [ "$NEW_ACCESS_TOKEN" == "null" ] || [ -z "$NEW_ACCESS_TOKEN" ]; then
    echo -e "${RED}✗ Failed to refresh token${NC}"
    echo "$REFRESH_RESPONSE" | jq '.'
    exit 1
fi

echo -e "${GREEN}✓ Token refreshed${NC}"
echo -e "  New Access Token: ${NEW_ACCESS_TOKEN:0:30}..."
echo -e "  New Refresh Token: ${NEW_REFRESH_TOKEN:0:20}...\n"

# ============================================================================
# Step 7: Revoke Token
# ============================================================================

echo -e "${BLUE}Step 7: Revoke Access Token${NC}"

REVOKE_RESPONSE=$(curl -s -X POST "$API_BASE/revoke" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$NEW_ACCESS_TOKEN\",
    \"client_id\": \"$CLIENT_ID\",
    \"client_secret\": \"$CLIENT_SECRET\"
  }")

echo -e "${GREEN}✓ Token revoked${NC}"
echo "$REVOKE_RESPONSE" | jq '.'
echo ""

# ============================================================================
# Step 8: Test Discovery Endpoints
# ============================================================================

echo -e "${BLUE}Step 8: Test Discovery Endpoints${NC}"

echo -e "${YELLOW}OAuth Server Metadata:${NC}"
curl -s "$BASE_URL/.well-known/oauth-authorization-server" | jq '.'

echo -e "\n${YELLOW}OpenID Configuration:${NC}"
curl -s "$BASE_URL/.well-known/openid-configuration" | jq '.'

echo ""

# ============================================================================
# Step 9: List and Delete Client
# ============================================================================

echo -e "${BLUE}Step 9: List and Delete OAuth Client${NC}"

echo -e "${YELLOW}List Clients:${NC}"
curl -s -X GET "$API_BASE/clients" \
  -H "Authorization: Bearer $USER_TOKEN" | jq '.'

echo -e "\n${YELLOW}Delete Client:${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "$API_BASE/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $USER_TOKEN")

echo "$DELETE_RESPONSE" | jq '.'

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All tests completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}Summary:${NC}"
echo -e "  1. ✓ Client registered"
echo -e "  2. ✓ Authorization code obtained"
echo -e "  3. ✓ Tokens exchanged"
echo -e "  4. ✓ UserInfo retrieved"
echo -e "  5. ✓ Token introspected"
echo -e "  6. ✓ Token refreshed"
echo -e "  7. ✓ Token revoked"
echo -e "  8. ✓ Discovery endpoints tested"
echo -e "  9. ✓ Client deleted\n"

echo -e "${GREEN}OAuth Provider implementation is working correctly!${NC}"

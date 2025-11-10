#!/bin/bash

# OAuth Integration Test Script
# Tests the complete OAuth flow with Google provider
# Usage: ./scripts/test-oauth.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
REDIRECT_URI="${REDIRECT_URI:-http://localhost:3001/auth/callback/google}"

echo "=========================================="
echo "Truxe OAuth Integration Tests"
echo "=========================================="
echo ""

# Function to print test results
test_passed() {
  echo -e "${GREEN}✓${NC} $1"
}

test_failed() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

test_info() {
  echo -e "${YELLOW}ℹ${NC} $1"
}

# Test 1: Check API is running
echo "Test 1: API Health Check"
if curl -s "${API_URL}/health" > /dev/null 2>&1; then
  test_passed "API is running at ${API_URL}"
else
  test_failed "API is not responding at ${API_URL}"
fi
echo ""

# Test 2: Check OAuth providers endpoint
echo "Test 2: OAuth Providers"
PROVIDERS_RESPONSE=$(curl -s "${API_URL}/oauth/providers")
if echo "${PROVIDERS_RESPONSE}" | jq -e '.providers[] | select(.id == "google")' > /dev/null 2>&1; then
  test_passed "Google OAuth provider is registered"
  echo "${PROVIDERS_RESPONSE}" | jq '.providers[] | select(.id == "google")'
else
  test_failed "Google OAuth provider not found"
fi
echo ""

# Test 3: Generate authorization URL
echo "Test 3: Authorization Request"
AUTH_RESPONSE=$(curl -s -X POST "${API_URL}/oauth/google/start" \
  -H "Content-Type: application/json" \
  -d "{\"redirectUri\": \"${REDIRECT_URI}\"}")

if echo "${AUTH_RESPONSE}" | jq -e '.success' > /dev/null 2>&1; then
  test_passed "Authorization request created successfully"

  # Extract state and URL
  STATE=$(echo "${AUTH_RESPONSE}" | jq -r '.state')
  AUTH_URL=$(echo "${AUTH_RESPONSE}" | jq -r '.authorizationUrl')

  test_info "State: ${STATE}"
  echo ""

  # Verify URL structure
  if echo "${AUTH_URL}" | grep -q "accounts.google.com"; then
    test_passed "Authorization URL is valid Google OAuth URL"
  else
    test_failed "Authorization URL is invalid"
  fi

  if echo "${AUTH_URL}" | grep -q "state=${STATE}"; then
    test_passed "State parameter included in URL"
  else
    test_failed "State parameter missing from URL"
  fi

  if echo "${AUTH_URL}" | grep -q "scope=openid"; then
    test_passed "OpenID Connect scope included"
  else
    test_failed "OpenID Connect scope missing"
  fi

  if echo "${AUTH_URL}" | grep -q "access_type=offline"; then
    test_passed "Offline access requested (for refresh tokens)"
  else
    test_failed "Offline access not requested"
  fi

else
  test_failed "Authorization request failed"
  echo "${AUTH_RESPONSE}" | jq '.'
fi
echo ""

# Test 4: Check Redis state storage (if redis-cli available)
if command -v redis-cli &> /dev/null; then
  echo "Test 4: State Storage in Redis"

  STATE_ID=$(echo "${STATE}" | cut -d'.' -f1)
  REDIS_KEY="oauth:state:${STATE_ID}"

  if redis-cli EXISTS "${REDIS_KEY}" | grep -q "1"; then
    test_passed "State stored in Redis"
    test_info "Redis key: ${REDIS_KEY}"

    # Check TTL
    TTL=$(redis-cli TTL "${REDIS_KEY}")
    if [ "${TTL}" -gt 0 ]; then
      test_passed "State has TTL: ${TTL} seconds"
    else
      test_failed "State TTL not set correctly"
    fi
  else
    test_failed "State not found in Redis"
  fi
  echo ""
else
  test_info "redis-cli not available, skipping Redis state check"
  echo ""
fi

# Test 5: Test error handling - missing redirect URI
echo "Test 5: Error Handling - Missing Redirect URI"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/oauth/google/start" \
  -H "Content-Type: application/json" \
  -d '{}')

if echo "${ERROR_RESPONSE}" | jq -e '.error' > /dev/null 2>&1; then
  test_passed "Validation error returned for missing redirect URI"
else
  test_failed "Validation error not returned"
fi
echo ""

# Test 6: Test error handling - invalid provider
echo "Test 6: Error Handling - Invalid Provider"
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/oauth/invalid/start" \
  -H "Content-Type: application/json" \
  -d "{\"redirectUri\": \"${REDIRECT_URI}\"}")

HTTP_CODE=$(echo "${INVALID_RESPONSE}" | tail -n1)
RESPONSE_BODY=$(echo "${INVALID_RESPONSE}" | head -n-1)

if [ "${HTTP_CODE}" -eq 404 ]; then
  test_passed "404 returned for invalid provider"
else
  test_failed "Expected 404, got ${HTTP_CODE}"
fi
echo ""

# Test 7: Check database schema
if command -v psql &> /dev/null; then
  echo "Test 7: Database Schema"

  # Check if oauth_accounts table exists
  if psql "${DATABASE_URL:-postgresql://localhost/truxe}" -c "\dt oauth_accounts" > /dev/null 2>&1; then
    test_passed "oauth_accounts table exists"

    # Check columns
    COLUMNS=$(psql "${DATABASE_URL:-postgresql://localhost/truxe}" -t -c "
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'oauth_accounts'
      ORDER BY ordinal_position;
    ")

    if echo "${COLUMNS}" | grep -q "access_token"; then
      test_passed "access_token column exists"
    fi

    if echo "${COLUMNS}" | grep -q "refresh_token"; then
      test_passed "refresh_token column exists"
    fi

    if echo "${COLUMNS}" | grep -q "id_token"; then
      test_passed "id_token column exists"
    fi

  else
    test_failed "oauth_accounts table does not exist"
    test_info "Run: npm run migrate"
  fi
  echo ""
else
  test_info "psql not available, skipping database schema check"
  echo ""
fi

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""
test_passed "All automated tests passed!"
echo ""
echo "Manual Testing:"
echo "1. Open the authorization URL in your browser:"
echo "   ${AUTH_URL}"
echo ""
echo "2. Sign in with Google and authorize"
echo ""
echo "3. After redirect, check server logs for:"
echo "   - Token exchange"
echo "   - ID token verification"
echo "   - User profile retrieval"
echo "   - OAuth account creation"
echo ""
echo "For more details, see: docs/05-guides/oauth-testing-guide.md"
echo ""

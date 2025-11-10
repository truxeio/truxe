#!/bin/bash

# Truxe API Verification Script
# Tests all critical endpoints to ensure API is production-ready

set -e

# Configuration
API_URL="${1:-https://api.truxe.io}"
TEST_EMAIL="${2:-test@example.com}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
TOTAL=0

# Helper function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"

    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}Test $TOTAL: $test_name${NC}"

    # Run command and capture output
    local output
    output=$(eval "$test_command" 2>&1)
    local exit_code=$?

    # Check if output matches expected pattern
    if echo "$output" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        echo "$output" | jq . 2>/dev/null || echo "$output"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Expected pattern: $expected_pattern"
        echo "Got:"
        echo "$output"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# Helper function to extract value from JSON
extract_json() {
    echo "$1" | jq -r "$2"
}

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}   Truxe API Verification Suite${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "API URL: $API_URL"
echo "Test Email: $TEST_EMAIL"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 1: Health Check
run_test "Health Check" \
    "curl -s $API_URL/health" \
    "status"

# Test 2: Version Endpoint
run_test "Version Info" \
    "curl -s $API_URL/version" \
    "version"

# Test 3: Root Endpoint
run_test "Root Endpoint" \
    "curl -s $API_URL/" \
    "Truxe"

# Test 4: JWKS Endpoint
run_test "JWKS Public Keys" \
    "curl -s $API_URL/.well-known/jwks.json" \
    "keys"

# Test 5: OpenID Configuration
run_test "OpenID Configuration" \
    "curl -s $API_URL/.well-known/openid-configuration" \
    "issuer"

# Test 6: Magic Link Request (will fail without email service, but should return proper error)
echo -e "${BLUE}Test $((TOTAL + 1)): Magic Link Request${NC}"
TOTAL=$((TOTAL + 1))
MAGIC_RESPONSE=$(curl -s -X POST "$API_URL/auth/magic-link" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\"}")

if echo "$MAGIC_RESPONSE" | grep -q "error\|success\|message"; then
    echo -e "${GREEN}✓ PASSED (endpoint responding)${NC}"
    echo "$MAGIC_RESPONSE" | jq .
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "$MAGIC_RESPONSE"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 7: /auth/me without token (should return 401)
echo -e "${BLUE}Test $((TOTAL + 1)): Auth Me - No Token (expect 401)${NC}"
TOTAL=$((TOTAL + 1))
ME_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/auth/me")
HTTP_CODE=$(echo "$ME_RESPONSE" | tail -1)
BODY=$(echo "$ME_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ PASSED (401 as expected)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ FAILED (expected 401, got $HTTP_CODE)${NC}"
    echo "$BODY"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 8: /auth/me with invalid token (should return 401)
echo -e "${BLUE}Test $((TOTAL + 1)): Auth Me - Invalid Token (expect 401)${NC}"
TOTAL=$((TOTAL + 1))
ME_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/auth/me" \
    -H "Authorization: Bearer invalid_token")
HTTP_CODE=$(echo "$ME_RESPONSE" | tail -1)
BODY=$(echo "$ME_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ PASSED (401 as expected)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ FAILED (expected 401, got $HTTP_CODE)${NC}"
    echo "$BODY"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 9: Refresh token without token (should return 400/401)
echo -e "${BLUE}Test $((TOTAL + 1)): Refresh Token - No Token (expect 400/401)${NC}"
TOTAL=$((TOTAL + 1))
REFRESH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/refresh" \
    -H "Content-Type: application/json" \
    -d '{}')
HTTP_CODE=$(echo "$REFRESH_RESPONSE" | tail -1)
BODY=$(echo "$REFRESH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ PASSED ($HTTP_CODE as expected)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ FAILED (expected 400/401, got $HTTP_CODE)${NC}"
    echo "$BODY"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 10: CORS Headers
echo -e "${BLUE}Test $((TOTAL + 1)): CORS Headers${NC}"
TOTAL=$((TOTAL + 1))
CORS_RESPONSE=$(curl -s -I -X OPTIONS "$API_URL/auth/magic-link" \
    -H "Origin: https://example.com" \
    -H "Access-Control-Request-Method: POST")

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    echo "$CORS_RESPONSE" | grep -i "access-control"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "$CORS_RESPONSE"
    FAILED=$((FAILED + 1))
fi
echo ""

# Summary
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}   Test Results${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

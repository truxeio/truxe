#!/bin/bash
# Complete MFA Flow Test Script
# Tests TOTP enrollment, verification, login with MFA challenge, and backup codes

set -e

API_URL="${API_URL:-http://localhost:3001}"
TEST_EMAIL="mfa-test-$(date +%s)@example.com"

echo "=========================================="
echo "🔐 MFA FLOW COMPLETE TEST"
echo "=========================================="
echo ""
echo "Test Email: $TEST_EMAIL"
echo "API URL: $API_URL"
echo ""

# Step 1: Request magic link
echo "Step 1: Requesting magic link for $TEST_EMAIL..."
MAGIC_RESPONSE=$(curl -s -X POST "$API_URL/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

echo "Response: $MAGIC_RESPONSE"
echo ""

# Extract token from magic_link_challenges table (dev only)
echo "Step 2: Extracting magic link token from database..."
TOKEN=$(psql "postgresql://truxe.io_password_change_me@localhost:21432/truxe.io" -t -c \
  "SELECT code FROM magic_link_challenges WHERE email='$TEST_EMAIL' ORDER BY created_at DESC LIMIT 1" | xargs)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to extract token"
  exit 1
fi

echo "✅ Token extracted: ${TOKEN:0:20}..."
echo ""

# Step 3: Verify magic link and get access token
echo "Step 3: Verifying magic link..."
VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/auth/verify" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$TOKEN\",\"email\":\"$TEST_EMAIL\"}")
echo "Response: $VERIFY_RESPONSE"
echo ""

# Extract access token
ACCESS_TOKEN=$(echo "$VERIFY_RESPONSE" | jq -r '.accessToken // .tokens.accessToken')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo "❌ Failed to get access token"
  exit 1
fi

echo "✅ Access token obtained: ${ACCESS_TOKEN:0:50}..."
echo ""

# Step 4: Check MFA status (should be disabled)
echo "Step 4: Checking MFA status (should be disabled)..."
STATUS_RESPONSE=$(curl -s -X GET "$API_URL/auth/mfa/status" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $STATUS_RESPONSE"
ENABLED=$(echo "$STATUS_RESPONSE" | jq -r '.enabled')

if [ "$ENABLED" = "true" ]; then
  echo "❌ MFA should be disabled initially"
  exit 1
fi

echo "✅ MFA status is disabled as expected"
echo ""

# Step 5: Setup MFA (get QR code)
echo "Step 5: Setting up MFA (generating secret and QR code)..."
SETUP_RESPONSE=$(curl -s -X POST "$API_URL/auth/mfa/setup" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Setup response length: $(echo "$SETUP_RESPONSE" | wc -c) bytes"

SECRET=$(echo "$SETUP_RESPONSE" | jq -r '.secret')
QR_CODE=$(echo "$SETUP_RESPONSE" | jq -r '.qrCode')
MANUAL_CODE=$(echo "$SETUP_RESPONSE" | jq -r '.manualEntryCode')

if [ -z "$SECRET" ] || [ "$SECRET" = "null" ]; then
  echo "❌ Failed to get TOTP secret"
  echo "Response: $SETUP_RESPONSE"
  exit 1
fi

echo "✅ TOTP secret generated"
echo "   Secret: $SECRET"
echo "   Manual entry code: $MANUAL_CODE"
echo "   QR code data URL length: $(echo "$QR_CODE" | wc -c) bytes"
echo ""

# Step 6: Generate TOTP token using oathtool (if available)
echo "Step 6: Generating TOTP token..."

if command -v oathtool &> /dev/null; then
  TOTP_TOKEN=$(oathtool --totp -b "$SECRET")
  echo "✅ TOTP token generated using oathtool: $TOTP_TOKEN"
else
  echo "⚠️  oathtool not found. Install with: brew install oath-toolkit"
  echo "   Please enter TOTP code from your authenticator app:"
  read -r TOTP_TOKEN
fi

echo ""

# Step 7: Enable MFA by verifying TOTP
echo "Step 7: Enabling MFA with TOTP verification..."
ENABLE_RESPONSE=$(curl -s -X POST "$API_URL/auth/mfa/enable" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOTP_TOKEN\"}")

echo "Response: $ENABLE_RESPONSE"

SUCCESS=$(echo "$ENABLE_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" != "true" ]; then
  echo "❌ Failed to enable MFA"
  exit 1
fi

BACKUP_CODES=$(echo "$ENABLE_RESPONSE" | jq -r '.backupCodes[]')
BACKUP_CODES_ARRAY=($(echo "$ENABLE_RESPONSE" | jq -r '.backupCodes[]'))

echo "✅ MFA enabled successfully!"
echo "   Backup codes (save these!):"
echo "$BACKUP_CODES" | nl
echo ""

# Step 8: Verify MFA status (should be enabled now)
echo "Step 8: Verifying MFA status (should be enabled)..."
STATUS_RESPONSE=$(curl -s -X GET "$API_URL/auth/mfa/status" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $STATUS_RESPONSE"
ENABLED=$(echo "$STATUS_RESPONSE" | jq -r '.enabled')
BACKUP_COUNT=$(echo "$STATUS_RESPONSE" | jq -r '.backupCodesRemaining')

if [ "$ENABLED" != "true" ]; then
  echo "❌ MFA should be enabled"
  exit 1
fi

echo "✅ MFA is enabled with $BACKUP_COUNT backup codes"
echo ""

# Step 9: Test MFA login flow
echo "Step 9: Testing MFA login flow..."
echo "   Requesting new magic link..."

MAGIC_RESPONSE2=$(curl -s -X POST "$API_URL/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

TOKEN2=$(psql "postgresql://truxe.io_password_change_me@localhost:21432/truxe.io" -t -c \
  "SELECT code FROM magic_link_challenges WHERE email='$TEST_EMAIL' ORDER BY created_at DESC LIMIT 1" | xargs)

echo "   Verifying magic link (should return MFA challenge)..."
VERIFY_RESPONSE2=$(curl -s -X POST "$API_URL/auth/verify" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$TOKEN2\",\"email\":\"$TEST_EMAIL\"}")

echo "Response: $VERIFY_RESPONSE2"

MFA_REQUIRED=$(echo "$VERIFY_RESPONSE2" | jq -r '.mfaRequired')
CHALLENGE_ID=$(echo "$VERIFY_RESPONSE2" | jq -r '.challengeId // .mfaChallengeToken')

if [ "$MFA_REQUIRED" != "true" ] || [ -z "$CHALLENGE_ID" ] || [ "$CHALLENGE_ID" = "null" ]; then
  echo "❌ Expected MFA challenge"
  echo "   mfaRequired: $MFA_REQUIRED"
  echo "   challengeId: $CHALLENGE_ID"
  exit 1
fi

echo "✅ MFA challenge received"
echo "   Challenge ID: ${CHALLENGE_ID:0:30}..."
echo ""

# Step 10: Complete MFA challenge with TOTP
echo "Step 10: Completing MFA challenge with TOTP..."

if command -v oathtool &> /dev/null; then
  TOTP_TOKEN2=$(oathtool --totp -b "$SECRET")
  echo "   TOTP token: $TOTP_TOKEN2"
else
  echo "   Please enter new TOTP code:"
  read -r TOTP_TOKEN2
fi

CHALLENGE_RESPONSE=$(curl -s -X POST "$API_URL/auth/mfa/challenge/verify" \
  -H "Content-Type: application/json" \
  -d "{\"challengeId\":\"$CHALLENGE_ID\",\"token\":\"$TOTP_TOKEN2\"}")

echo "Response: $CHALLENGE_RESPONSE"

SUCCESS2=$(echo "$CHALLENGE_RESPONSE" | jq -r '.success')
NEW_ACCESS_TOKEN=$(echo "$CHALLENGE_RESPONSE" | jq -r '.tokens.accessToken')

if [ "$SUCCESS2" != "true" ] || [ -z "$NEW_ACCESS_TOKEN" ] || [ "$NEW_ACCESS_TOKEN" = "null" ]; then
  echo "❌ Failed to complete MFA challenge"
  exit 1
fi

echo "✅ MFA challenge completed successfully!"
echo "   New access token: ${NEW_ACCESS_TOKEN:0:50}..."
echo ""

# Step 11: Test backup code verification
echo "Step 11: Testing backup code flow..."
echo "   Using first backup code: ${BACKUP_CODES_ARRAY[0]}"

# Request new magic link for backup code test
MAGIC_RESPONSE3=$(curl -s -X POST "$API_URL/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

TOKEN3=$(psql "postgresql://truxe.io_password_change_me@localhost:21432/truxe.io" -t -c \
  "SELECT code FROM magic_link_challenges WHERE email='$TEST_EMAIL' ORDER BY created_at DESC LIMIT 1" | xargs)

VERIFY_RESPONSE3=$(curl -s -X POST "$API_URL/auth/verify" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$TOKEN3\",\"email\":\"$TEST_EMAIL\"}")
CHALLENGE_ID2=$(echo "$VERIFY_RESPONSE3" | jq -r '.challengeId // .mfaChallengeToken')

BACKUP_RESPONSE=$(curl -s -X POST "$API_URL/auth/mfa/challenge/verify" \
  -H "Content-Type: application/json" \
  -d "{\"challengeId\":\"$CHALLENGE_ID2\",\"backupCode\":\"${BACKUP_CODES_ARRAY[0]}\"}")

echo "Response: $BACKUP_RESPONSE"

SUCCESS3=$(echo "$BACKUP_RESPONSE" | jq -r '.success')

if [ "$SUCCESS3" != "true" ]; then
  echo "❌ Failed to verify backup code"
  exit 1
fi

echo "✅ Backup code verified successfully!"
echo ""

# Step 12: Verify backup code was consumed
echo "Step 12: Verifying backup code consumption..."
STATUS_FINAL=$(curl -s -X GET "$API_URL/auth/mfa/status" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN")

BACKUP_COUNT_FINAL=$(echo "$STATUS_FINAL" | jq -r '.backupCodesRemaining')

if [ "$BACKUP_COUNT_FINAL" != "9" ]; then
  echo "❌ Expected 9 backup codes remaining, got $BACKUP_COUNT_FINAL"
  exit 1
fi

echo "✅ Backup code consumed (9 remaining)"
echo ""

# Final Summary
echo "=========================================="
echo "✅ ALL MFA TESTS PASSED!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✅ Magic link authentication"
echo "  ✅ MFA setup (secret + QR code generation)"
echo "  ✅ TOTP verification and enablement"
echo "  ✅ Backup codes generation (10 codes)"
echo "  ✅ MFA status tracking"
echo "  ✅ Login flow with MFA challenge"
echo "  ✅ TOTP verification during login"
echo "  ✅ Backup code verification"
echo "  ✅ Backup code consumption tracking"
echo ""
echo "Test Email: $TEST_EMAIL"
echo "TOTP Secret: $SECRET"
echo "Remaining Backup Codes: 9"
echo ""

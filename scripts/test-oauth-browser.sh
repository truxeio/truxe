#!/bin/bash

# OAuth Browser Test Script
# This script helps you test the OAuth flow in a browser

API_URL="${API_URL:-https://api.truxe.io}"
REDIRECT_URI="${REDIRECT_URI:-https://app.truxe.io/auth/callback}"

echo "========================================="
echo "OAuth Browser Test"
echo "========================================="
echo ""
echo "Step 1: Getting authorization URL from API..."
echo ""

# Call the OAuth start endpoint
RESPONSE=$(curl -s -X POST "${API_URL}/auth/oauth/google/start" \
  -H "Content-Type: application/json" \
  -d "{\"redirectUri\": \"${REDIRECT_URI}\"}")

# Check if request was successful
if [ $? -ne 0 ]; then
  echo "❌ Error: Failed to connect to API"
  exit 1
fi

# Extract authorization URL
AUTH_URL=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('authorizationUrl', ''))" 2>/dev/null)

if [ -z "$AUTH_URL" ]; then
  echo "❌ Error: Failed to get authorization URL"
  echo "Response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

echo "✅ Authorization URL received!"
echo ""
echo "========================================="
echo "Step 2: Open this URL in your browser:"
echo "========================================="
echo ""
echo "$AUTH_URL"
echo ""
echo "========================================="
echo "What will happen:"
echo "========================================="
echo ""
echo "1. You'll be redirected to Google login"
echo "2. After login, Google will redirect to:"
echo "   ${API_URL}/auth/oauth/callback/google"
echo ""
echo "3. Our backend will process the callback"
echo "4. You should see a JSON response with:"
echo "   - success: true"
echo "   - profile: your Google profile"
echo "   - tokenMetadata: OAuth token info"
echo ""
echo "========================================="
echo ""

# Try to open in browser (macOS)
read -p "Open URL in browser automatically? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  if command -v open &> /dev/null; then
    open "$AUTH_URL"
    echo "✅ Opened in browser!"
  else
    echo "⚠️  Could not auto-open. Please copy the URL above manually."
  fi
fi

echo ""
echo "Press Ctrl+C to exit..."
echo ""

# Optional: Monitor API logs
read -p "Monitor API logs? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Monitoring API logs (Ctrl+C to stop)..."
  ssh deployer@truxe.io "docker logs -f truxe-api-1 2>&1 | grep -i oauth"
fi

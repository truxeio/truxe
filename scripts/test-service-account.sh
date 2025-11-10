#!/bin/bash

echo "=== Service Account Authentication Test ==="
echo ""

echo "1. Getting token..."
TOKEN_RESPONSE=$(curl -s -X POST https://api.truxe.io/api/service-accounts/token \
  -H "Content-Type: application/json" \
  -d '{"clientId":"hippoc-backend-prod","clientSecret":"Pjzj+MW7pgCOXNGVLP7WcUrk1DYx7SLeubAGyXi74ew="}')

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import json, sys; print(json.load(sys.stdin)['accessToken'])")

echo "Token received!"
echo ""

echo "2. Testing /me endpoint..."
ME_RESPONSE=$(curl -s "https://api.truxe.io/api/service-accounts/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$ME_RESPONSE" | python3 -m json.tool 2>/dev/null; then
    echo ""
    echo "✅ Test Complete - SUCCESS!"
else
    echo "Response: $ME_RESPONSE"
    echo ""
    echo "❌ Test Complete - FAILED (Invalid JSON response)"
fi

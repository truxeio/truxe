#!/bin/bash

# Quick Alert Test Script
# Tests alert notification system

set -e

echo "🔔 Testing Alert Notifications..."
echo "=================================="

# Check if API is running
API_PORT=${TRUXE_API_PORT:-87001}
if ! curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
    echo "❌ API not running on port $API_PORT"
    echo ""
    echo "Start with:"
    echo "  cd api && npm start"
    exit 1
fi

echo "✅ API is running"

# Check if worker is running
if ! pgrep -f "worker.js" > /dev/null; then
    echo "⚠️  Worker not running"
    echo ""
    echo "Start with:"
    echo "  cd api && npm run worker"
fi

# Check if Slack webhook configured
SLACK_URL=$(grep ALERT_SLACK_WEBHOOK_URL api/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "")

if [ -z "$SLACK_URL" ] || [ "$SLACK_URL" == "https://hooks.slack.com/services/XXX/YYY/ZZZ" ]; then
    echo "❌ Slack webhook not configured"
    echo ""
    echo "Configure in api/.env:"
    echo "  ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
    echo ""
    echo "Get webhook from: https://api.slack.com/messaging/webhooks"
    exit 1
fi

echo "✅ Slack webhook configured"

# Get admin token
echo ""
echo "Admin token needed for testing..."
read -p "Enter admin token (or press Enter to skip): " ADMIN_TOKEN

if [ -z "$ADMIN_TOKEN" ]; then
    echo "⚠️  No token provided, skipping API test"
    echo ""
    echo "Testing Slack webhook directly..."

    # Test Slack directly
    RESPONSE=$(curl -s -X POST "$SLACK_URL" \
      -H "Content-Type: application/json" \
      -d '{
        "text": "🧪 Test from Truxe Alert System",
        "attachments": [{
          "color": "#36a64f",
          "title": "Alert Test",
          "text": "If you see this, Slack integration is working! ✅",
          "footer": "Truxe Alerts",
          "ts": '$(date +%s)'
        }]
      }')

    if [ "$RESPONSE" == "ok" ]; then
        echo "✅ Slack test message sent!"
        echo ""
        echo "Check your Slack #alerts channel"
    else
        echo "❌ Slack test failed: $RESPONSE"
    fi

    exit 0
fi

# Test via API
echo ""
echo "Testing via Truxe API..."

RESPONSE=$(curl -s -X POST http://localhost:$API_PORT/api/admin/alerts/test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

# Check response
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Alert test successful!"
    echo ""
    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    echo ""
    echo "Check your Slack #alerts channel for the test notification"
    echo "Check your email if configured"
else
    echo "❌ Alert test failed"
    echo ""
    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    echo ""
    echo "Common issues:"
    echo "  - Admin token invalid"
    echo "  - Worker not running"
    echo "  - Slack webhook incorrect"
fi

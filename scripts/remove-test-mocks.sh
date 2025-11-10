#!/bin/bash

# Token Service Test - Mock Removal Script
# This script removes all undefined mock references from the test file

FILE="/Users/ozanoke/Projects/Truxe/api/tests/unit/oauth-provider/token-service.test.js"

echo "🔧 Removing mock references from token-service.test.js..."

# Backup the file first
cp "$FILE" "$FILE.backup"
echo "✅ Backup created: $FILE.backup"

# Remove lines starting with mockClientService
sed -i '' '/^[[:space:]]*mockClientService\./d' "$FILE"
echo "✅ Removed mockClientService lines"

# Remove lines starting with mockPool.query
sed -i '' '/^[[:space:]]*mockPool\.query/d' "$FILE"
echo "✅ Removed mockPool.query setup lines"

# Remove lines starting with expect(mockPool
sed -i '' '/^[[:space:]]*expect(mockPool/d' "$FILE"
echo "✅ Removed mockPool expectations"

# Replace testUserInfo with getUserInfo()
sed -i '' 's/testUserInfo/getUserInfo()/g' "$FILE"
echo "✅ Replaced testUserInfo with getUserInfo()"

# Remove multiline mock chains (lines ending with specific patterns)
sed -i '' '/\.mockResolvedValue.*$/d' "$FILE"
sed -i '' '/\.mockResolvedValueOnce.*$/d' "$FILE"
sed -i '' '/\.mockRejectedValue.*$/d' "$FILE"
echo "✅ Removed mock value chains"

echo ""
echo "🎉 Mock removal complete!"
echo ""
echo "📊 Check the changes:"
echo "   diff $FILE.backup $FILE"
echo ""
echo "🧪 Run tests:"
echo "   cd /Users/ozanoke/Projects/Truxe/api"
echo "   npm test tests/unit/oauth-provider/token-service.test.js"
echo ""
echo "♻️  Restore backup if needed:"
echo "   mv $FILE.backup $FILE"

# Token Service Test - Manual Mock Removal Instructions

## ⚠️ Important Note

The automated script removal had syntax issues. The safest approach is to use **VS Code's built-in Find & Replace** feature, which you can control and verify step-by-step.

##  Step-by-Step Instructions

### 1. Open the File in VS Code
```
/Users/ozanoke/Projects/Truxe/api/tests/unit/oauth-provider/token-service.test.js
```

### 2. Press `⌘ + H` (Find & Replace)

### 3. Execute These Replacements in Order

#### Replace 1: Fix testUserInfo in async function arguments
- **Find:** `testUserInfo`
- **Replace:** `getUserInfo()`
- **Options:** Match Case: OFF, Match Whole Word: OFF, Use Regex: OFF
- **Action:** Click "Replace All" (should find ~19 matches)
- **Verify:** Check that function calls now use `getUserInfo()` instead of `testUserInfo`

#### Replace 2: Remove mockClientService lines
- **Find:** `^\s*mockClientService\..*$\n`
- **Replace:** `` (leave empty)
- **Options:** Use Regex: ON
- **Action:** Click "Replace All" (should find ~10 matches)
- **Verify:** No lines starting with `mockClientService` remain

#### Replace 3: Remove mockPool.query mockResolvedValue lines  
- **Find:** `^\s*mockPool\.query\.mockResolved.*$\n`
- **Replace:** `` (leave empty)
- **Options:** Use Regex: ON
- **Action:** Click "Replace All" (should find ~40 matches)
- **Verify:** No lines with `mockPool.query.mockResolvedValue` remain

#### Replace 4: Remove mockPool.query mockRejectedValue lines
- **Find:** `^\s*mockPool\.query\.mockRejected.*$\n`
- **Replace:** `` (leave empty)
- **Options:** Use Regex: ON
- **Action:** Click "Replace All" (should find ~3 matches)

#### Replace 5: Remove mockPool.query multiline chains (Part 1)
- **Find:** `^\s*mockPool\.query$\n`
- **Replace:** `` (leave empty)
- **Options:** Use Regex: ON
- **Action:** Click "Replace All"

#### Replace 6: Remove mockPool.query multiline chains (Part 2)
- **Find:** `^\s*\.mockResolved.*$\n`
- **Replace:** `` (leave empty)
- **Options:** Use Regex: ON
- **Action:** Click "Replace All"

#### Replace 7: Remove expect(mockPool...) assertions
- **Find:** `^\s*expect\(mockPool\.query\)\.toHaveBeenCalled.*$\n`
- **Replace:** `` (leave empty)
- **Options:** Use Regex: ON
- **Action:** Click "Replace All" (should find ~10 matches)

### 4. Manual Cleanup (if needed)

After the replacements, search for:
- `mockPool` - should find 0 matches
- `mockClientService` - should find 0 matches
- `testUserInfo` - should find 0 matches

If any remain, manually review and delete them.

### 5. Remove Empty Lines (Optional)

After mock removal, you may have consecutive empty lines:

- **Find:** `^\s*$\n^\s*$\n`
- **Replace:** `\n`
- **Options:** Use Regex: ON
- **Action:** Click "Replace All" multiple times until no more matches

### 6. Save and Test

```bash
cd /Users/ozanoke/Projects/Truxe/api
npm test tests/unit/oauth-provider/token-service.test.js
```

## Expected Results

### Before Fixes
- ❌ Tests fail with "mockClientService is not defined"
- ❌ Tests fail with "mockPool is not defined"
- ❌ Tests fail with "testUserInfo is not defined"

### After Fixes
- ✅ All tests run against real database
- ✅ 61 tests total (removed 1 implementation detail test earlier)
- ✅ Tests use `getUserInfo()` for user data
- ✅ No mock references remain

## Verification Commands

```bash
# Check for remaining mocks
grep -n "mockPool" /Users/ozanoke/Projects/Truxe/api/tests/unit/oauth-provider/token-service.test.js
grep -n "mockClientService" /Users/ozanoke/Projects/Truxe/api/tests/unit/oauth-provider/token-service.test.js
grep -n "testUserInfo" /Users/ozanoke/Projects/Truxe/api/tests/unit/oauth-provider/token-service.test.js

# Should all return: no matches found
```

## If Something Goes Wrong

The original file is backed up at:
```
/Users/ozanoke/Projects/Truxe/api/tests/unit/oauth-provider/token-service.test.js.backup
```

Restore it with:
```bash
cp /Users/ozanoke/Projects/Truxe/api/tests/unit/oauth-provider/token-service.test.js.backup \
   /Users/ozanoke/Projects/Truxe/api/tests/unit/oauth-provider/token-service.test.js
```

## Alternative: Let Me Continue Manually

If you prefer, I can continue fixing tests one-by-one using the `replace_string_in_file` tool. This will take ~40 operations but will be guaranteed to work correctly.

Let me know your preference!


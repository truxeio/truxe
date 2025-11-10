# Token Service Test - Mock Removal Plan

## Issues Found

### 1. Undefined Mock Objects
- `mockClientService` - doesn't exist
- `mockPool` - doesn't exist  
- `testUserInfo` - doesn't exist

### 2. Pattern to Follow (Working Tests)
Lines 150-192 show the correct pattern:
- ✅ No mock setup
- ✅ Direct calls to `tokenService.generateTokenPair()`
- ✅ Use real `testClientId`, `testUserId`, `testScope`
- ✅ Use `getUserInfo()` for user data

### 3. Tests That Need Fixing

**Token Generation (7 broken tests):**
- Line 194: "should generate valid JWT access token"
- Line 217: "should include email claims when email scope granted"
- Line 234: "should include profile claims when profile scope granted"  
- Line 252: "should generate refresh token with correct format"
- Line 267: "should generate unique JTI for each token"
- Line 291: "should store token metadata in database" 
- Line 316: "should set correct token expiration times"

**Refresh Token Flow (10 broken tests):**
- Lines 358-375: "should refresh token successfully"
- Lines 377-386: "should reject non-existent refresh token"
- Lines 397-409: "should reject expired refresh token"
- Lines 413-425: "should reject revoked refresh token"
- Lines 429-439: "should reject client ID mismatch"
- Lines 440-455: "should allow scope reduction during refresh"
- Lines 459-470: "should reject scope expansion during refresh"
- Lines 471-487: "should revoke old refresh token after successful refresh"
- Lines 491-508: "should maintain original scope if not specified"

**JWT Tests (8 broken tests):**
- Lines 516-532: "should sign JWT with RS256 algorithm"
- Lines 535-551: "should include key ID (kid) in JWT header"
- Lines 553-569: "should verify JWT signature with public key"
- Lines 600-615: "should validate all required JWT claims"
- Lines 626-640: "should fail when JWT_PRIVATE_KEY not configured"

**All other test categories have similar issues**

### 4. Fix Strategy

For each broken test:
1. **REMOVE** all lines starting with `mock`
2. **REPLACE** `testUserInfo` with `getUserInfo()`
3. **KEEP** the actual test logic and assertions

### 5. What to Keep

```javascript
// ✅ KEEP - Real service calls
const result = await tokenService.generateTokenPair({
  clientId: testClientId,
  userId: testUserId,
  scope: testScope,
  userInfo: getUserInfo(),
});

// ✅ KEEP - Real assertions  
expect(result).toHaveProperty('access_token');
const decoded = jwt.decode(result.access_token);
expect(decoded).toHaveProperty('sub', testUserId);
```

### 6. What to Remove

```javascript
// ❌ REMOVE - Undefined mocks
mockClientService.getClientById.mockResolvedValue(testClient);
mockPool.query.mockResolvedValue({ rows: [{ id: 'token-id' }] });
mockPool.query.mockResolvedValueOnce(...);
mockClientService.getClientById.mockResolvedValue(...);
expect(mockPool.query).toHaveBeenCalledWith(...);
```

### 7. Special Cases

**Database assertion tests** (lines 291-314):
- Test "should store token metadata in database" makes assertions about database calls
- This test should be REMOVED entirely (it's testing implementation details, not behavior)

**Cleanup tests** (lines 1271-1306):
- These have mock expectations - need to verify actual database state instead
- Replace mock assertions with real database queries

## Execution Plan

1. Remove all mock setup lines from Token Generation tests
2. Replace testUserInfo with getUserInfo() 
3. Remove implementation detail tests (mock call assertions)
4. Apply same fixes to all test categories
5. Run tests to verify they pass


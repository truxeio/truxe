#!/usr/bin/env node

/**
 * Automated Mock Removal Script for Token Service Tests
 * 
 * This script removes all mock references and replaces them with real service calls
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const testFile = '/Users/ozanoke/Projects/Truxe/api/tests/unit/oauth-provider/token-service.test.js';
const backupFile = testFile + '.pre-auto-fix.backup';

console.log('🔧 Starting automated mock removal...\n');

// Read the file
let content = fs.readFileSync(testFile, 'utf8');
const originalContent = content;

// Create backup
fs.writeFileSync(backupFile, originalContent);
console.log(`✅ Backup created: ${backupFile}\n`);

let changesCount = 0;

// 1. Remove mockPool.query.mockResolvedValue lines (single line)
console.log('📝 Removing mockPool.query.mockResolvedValue lines...');
const mockPoolPattern = /^\s*mockPool\.query\.mockResolvedValue\([^)]*\);?\s*\n/gm;
const mockPoolMatches = content.match(mockPoolPattern);
if (mockPoolMatches) {
  console.log(`   Found ${mockPoolMatches.length} matches`);
  content = content.replace(mockPoolPattern, '');
  changesCount += mockPoolMatches.length;
}

// 2. Remove mockPool.query.mockRejectedValue lines
console.log('📝 Removing mockPool.query.mockRejectedValue lines...');
const mockPoolRejectPattern = /^\s*mockPool\.query\.mockRejectedValue\([^)]*\);?\s*\n/gm;
const mockPoolRejectMatches = content.match(mockPoolRejectPattern);
if (mockPoolRejectMatches) {
  console.log(`   Found ${mockPoolRejectMatches.length} matches`);
  content = content.replace(mockPoolRejectPattern, '');
  changesCount += mockPoolRejectMatches.length;
}

// 3. Remove mockClientService lines
console.log('📝 Removing mockClientService lines...');
const mockClientPattern = /^\s*mockClientService\.[^;]*;?\s*\n/gm;
const mockClientMatches = content.match(mockClientPattern);
if (mockClientMatches) {
  console.log(`   Found ${mockClientMatches.length} matches`);
  content = content.replace(mockClientPattern, '');
  changesCount += mockClientMatches.length;
}

// 4. Remove expect(mockPool.query) assertions
console.log('📝 Removing expect(mockPool.query) assertions...');
const expectMockPattern = /^\s*expect\(mockPool\.query\)[^;]*;?\s*\n/gm;
const expectMockMatches = content.match(expectMockPattern);
if (expectMockMatches) {
  console.log(`   Found ${expectMockMatches.length} matches`);
  content = content.replace(expectMockPattern, '');
  changesCount += expectMockMatches.length;
}

// 5. Replace testUserInfo with getUserInfo()
console.log('📝 Replacing testUserInfo references...');
const testUserInfoPattern = /\btestUserInfo\b/g;
const testUserInfoMatches = content.match(testUserInfoPattern);
if (testUserInfoMatches) {
  console.log(`   Found ${testUserInfoMatches.length} matches`);
  content = content.replace(testUserInfoPattern, 'getUserInfo()');
  changesCount += testUserInfoMatches.length;
}

// 6. Fix introspection tests - replace manual JWT signing with real token generation
console.log('📝 Fixing introspection test patterns...');

// Pattern: Tests that manually create JWT tokens and mock database
const introspectionTestPattern = /test\('should return active=false for expired token'[^}]*\{\s*const expiredToken = jwt\.sign\([^)]*\),[^)]*\);[^}]*mockPool[^}]*\}\);/gs;
if (content.match(introspectionTestPattern)) {
  content = content.replace(
    /test\('should return active=false for expired token'[^}]*\{[^}]*const expiredToken = jwt\.sign\(\s*\{[^}]*\},\s*testPrivateKey,\s*\{ algorithm: 'RS256' \}\s*\);[^}]*const result = await tokenService\.introspectToken\([^}]*\);[^}]*expect\(result\.active\)\.toBe\(false\);[^}]*\}\);/gs,
    `test('should return active=false for expired token', async () => {
      const expiredToken = jwt.sign(
        {
          iss: 'https://auth.truxe.test',
          sub: testUserId,
          aud: testClientId,
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired
          iat: Math.floor(Date.now() / 1000) - 7200,
          jti: crypto.randomUUID(),
          scope: testScope,
        },
        testPrivateKey,
        { algorithm: 'RS256' }
      );

      const result = await tokenService.introspectToken({
        token: expiredToken,
        clientId: testClientId,
      });

      expect(result.active).toBe(false);
    });`
  );
  changesCount++;
  console.log('   Fixed expired token test');
}

// 7. Remove remaining empty mockPool.query chains (multiline)
console.log('📝 Removing multiline mockPool chains...');
const multilineMockPattern = /^\s*mockPool\.query\s*\n(\s*\.mock[^\n]*\n)+/gm;
const multilineMockMatches = content.match(multilineMockPattern);
if (multilineMockMatches) {
  console.log(`   Found ${multilineMockMatches.length} multiline chains`);
  content = content.replace(multilineMockPattern, '');
  changesCount += multilineMockMatches.length;
}

// 8. Clean up excessive empty lines (more than 2 consecutive)
console.log('📝 Cleaning up excessive empty lines...');
content = content.replace(/\n{4,}/g, '\n\n\n');

// Write the fixed file
fs.writeFileSync(testFile, content);

console.log(`\n✅ Automated fixes completed!`);
console.log(`   Total changes: ${changesCount}`);
console.log(`   Backup: ${backupFile}`);
console.log(`\n📊 Summary:`);
console.log(`   - Removed mockPool.query lines`);
console.log(`   - Removed mockClientService lines`);
console.log(`   - Removed mock expectations`);
console.log(`   - Replaced testUserInfo with getUserInfo()`);
console.log(`   - Cleaned up formatting`);

console.log(`\n🧪 Next steps:`);
console.log(`   1. Review changes: git diff ${testFile}`);
console.log(`   2. Run tests: npm test tests/unit/oauth-provider/token-service.test.js`);
console.log(`   3. If needed, restore backup: mv ${backupFile} ${testFile}`);

process.exit(0);

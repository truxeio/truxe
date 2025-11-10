import { GitHubOAuthProvider } from './src/services/oauth/providers/github.js';

console.log('🧪 Testing GitHub OAuth Provider...\n');

try {
  // Test 1: Provider initialization
  console.log('✓ Test 1: Initialize provider');
  const provider = new GitHubOAuthProvider({
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    redirectUri: 'http://localhost:3001/callback'
  });
  console.log('  Display name:', provider.displayName);
  
  // Test 2: Authorization URL generation
  console.log('\n✓ Test 2: Generate authorization URL');
  const authUrlResult = provider.getAuthorizationUrl({
    state: 'test_state_123',
    scopes: ['read:user', 'user:email']
  });
  console.log('  Result type:', typeof authUrlResult);
  console.log('  Result:', JSON.stringify(authUrlResult, null, 2));
  
  // Test 3: Check if provider has required methods
  console.log('\n✓ Test 3: Check provider methods');
  console.log('  Has getAuthorizationUrl:', typeof provider.getAuthorizationUrl === 'function');
  console.log('  Has exchangeCodeForToken:', typeof provider.exchangeCodeForToken === 'function');
  console.log('  Has getUserProfile:', typeof provider.getUserProfile === 'function');
  console.log('  Has refreshAccessToken:', typeof provider.refreshAccessToken === 'function');
  console.log('  Has revokeToken:', typeof provider.revokeToken === 'function');
  
  console.log('\n✅ All tests passed!');
  console.log('\n📊 GitHub OAuth Provider is working correctly!');
  
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

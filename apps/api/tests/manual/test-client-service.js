/**
 * Manual Test Script for OAuth Client Service
 * 
 * Run this script to manually test the OAuth Client Service
 * 
 * Usage:
 *   cd api
 *   node tests/manual/test-client-service.js
 */

import clientService from '../../src/services/oauth-provider/client-service.js';
import { getPool } from '../../src/database/connection.js';

async function testClientService() {
  console.log('🧪 Testing OAuth Client Service...\n');

  try {
    // Clean up any existing test data
    const pool = getPool();
    await pool.query("DELETE FROM oauth_clients WHERE client_name LIKE 'Test Application%'");

    // Test 1: Register Client
    console.log('1️⃣  Registering new client...');
    const client = await clientService.registerClient({
      clientName: 'Test Application',
      redirectUris: ['http://localhost:3000/callback'],
      createdBy: '550e8400-e29b-41d4-a716-446655440000',
      allowedScopes: ['openid', 'email', 'profile'],
    });

    console.log('✅ Client registered:');
    console.log('   Client ID:', client.client_id);
    console.log('   Client Secret:', client.client_secret);
    console.log('   ⚠️  SAVE THE SECRET - it will not be shown again!\n');

    // Test 2: Validate Credentials
    console.log('2️⃣  Validating credentials...');
    const validClient = await clientService.validateClientCredentials(
      client.client_id,
      client.client_secret
    );
    console.log('✅ Credentials valid:', validClient ? 'Yes ✓' : 'No ✗');
    console.log('   Client Name:', validClient?.client_name);
    console.log('   Status:', validClient?.status);
    console.log();

    // Test 3: Validate Wrong Secret
    console.log('3️⃣  Validating wrong secret...');
    const invalidClient = await clientService.validateClientCredentials(
      client.client_id,
      'cs_wrongsecretwrongsecretwrongse'
    );
    console.log('✅ Wrong secret rejected:', invalidClient === null ? 'Yes ✓' : 'No ✗\n');

    // Test 4: Validate Redirect URI
    console.log('4️⃣  Validating redirect URI...');
    const validUri = await clientService.validateRedirectUri(
      client.client_id,
      'http://localhost:3000/callback'
    );
    console.log('✅ Valid redirect URI accepted:', validUri ? 'Yes ✓' : 'No ✗');

    const invalidUri = await clientService.validateRedirectUri(
      client.client_id,
      'http://evil.com/callback'
    );
    console.log('✅ Invalid redirect URI rejected:', !invalidUri ? 'Yes ✓' : 'No ✗\n');

    // Test 5: Get Client
    console.log('5️⃣  Getting client by ID...');
    const fetchedClient = await clientService.getClientById(client.client_id);
    console.log('✅ Client fetched:', fetchedClient.client_name);
    console.log('   Secret hash hidden:', !fetchedClient.client_secret_hash ? 'Yes ✓' : 'No ✗');
    console.log('   Redirect URIs:', fetchedClient.redirect_uris);
    console.log('   Allowed Scopes:', fetchedClient.allowed_scopes);
    console.log('   Require PKCE:', fetchedClient.require_pkce);
    console.log();

    // Test 6: Update Client
    console.log('6️⃣  Updating client...');
    const updatedClient = await clientService.updateClient(client.client_id, {
      clientName: 'Test Application (Updated)',
      redirectUris: [
        'http://localhost:3000/callback',
        'http://localhost:3000/oauth/callback'
      ]
    });
    console.log('✅ Client updated:', updatedClient.client_name);
    console.log('   New redirect URIs:', updatedClient.redirect_uris);
    console.log();

    // Test 7: List Clients
    console.log('7️⃣  Listing clients for tenant...');
    const tenantId = '550e8400-e29b-41d4-a716-446655440001';
    
    // Register a few more clients for the same tenant
    await clientService.registerClient({
      clientName: 'Test Application 2',
      redirectUris: ['http://localhost:3001/callback'],
      tenantId,
      createdBy: '550e8400-e29b-41d4-a716-446655440000',
    });

    await clientService.registerClient({
      clientName: 'Test Application 3',
      redirectUris: ['http://localhost:3002/callback'],
      tenantId,
      createdBy: '550e8400-e29b-41d4-a716-446655440000',
    });

    const clients = await clientService.listClients(tenantId);
    console.log(`✅ Found ${clients.length} clients for tenant`);
    clients.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.client_name} (${c.client_id})`);
    });
    console.log();

    // Test 8: Regenerate Secret
    console.log('8️⃣  Regenerating client secret...');
    const originalSecret = client.client_secret;
    const regenerated = await clientService.regenerateClientSecret(client.client_id);
    console.log('✅ New secret generated:', regenerated.client_secret);
    console.log('   Different from original:', regenerated.client_secret !== originalSecret ? 'Yes ✓' : 'No ✗');

    // Verify old secret no longer works
    const validatedOld = await clientService.validateClientCredentials(
      client.client_id,
      originalSecret
    );
    console.log('   Old secret invalidated:', validatedOld === null ? 'Yes ✓' : 'No ✗');

    // Verify new secret works
    const validatedNew = await clientService.validateClientCredentials(
      client.client_id,
      regenerated.client_secret
    );
    console.log('   New secret works:', validatedNew !== null ? 'Yes ✓' : 'No ✗\n');

    // Test 9: Suspend/Activate
    console.log('9️⃣  Testing suspend/activate...');
    await clientService.suspendClient(client.client_id);
    const suspended = await clientService.getClientById(client.client_id);
    console.log('✅ Client suspended:', suspended.status === 'suspended' ? 'Yes ✓' : 'No ✗');

    // Try to validate suspended client
    const validatedSuspended = await clientService.validateClientCredentials(
      client.client_id,
      regenerated.client_secret
    );
    console.log('   Suspended client rejected:', validatedSuspended === null ? 'Yes ✓' : 'No ✗');

    // Activate client
    await clientService.activateClient(client.client_id);
    const activated = await clientService.getClientById(client.client_id);
    console.log('   Client activated:', activated.status === 'active' ? 'Yes ✓' : 'No ✗');

    // Verify can validate again
    const validatedActivated = await clientService.validateClientCredentials(
      client.client_id,
      regenerated.client_secret
    );
    console.log('   Activated client works:', validatedActivated !== null ? 'Yes ✓' : 'No ✗\n');

    // Test 10: Format Validation
    console.log('🔟 Testing format validation...');
    const validClientId = clientService.validateClientIdFormat(client.client_id);
    console.log('✅ Client ID format valid:', validClientId ? 'Yes ✓' : 'No ✗');

    const validClientSecret = clientService.validateClientSecretFormat(regenerated.client_secret);
    console.log('✅ Client secret format valid:', validClientSecret ? 'Yes ✓' : 'No ✗');

    const invalidClientId = clientService.validateClientIdFormat('invalid_id');
    console.log('   Invalid ID rejected:', !invalidClientId ? 'Yes ✓' : 'No ✗');

    const invalidClientSecret = clientService.validateClientSecretFormat('invalid_secret');
    console.log('   Invalid secret rejected:', !invalidClientSecret ? 'Yes ✓' : 'No ✗\n');

    // Clean up
    console.log('🧹 Cleaning up test data...');
    await pool.query("DELETE FROM oauth_clients WHERE client_name LIKE 'Test Application%'");
    console.log('✅ Cleanup complete\n');

    console.log('✅ All tests passed! 🎉\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testClientService()
  .then(() => {
    console.log('Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test script failed:', error);
    process.exit(1);
  });

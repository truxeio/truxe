/**
 * Script to create a test service account and API key
 * Usage: node scripts/create-test-api-key.js
 */

import { ApiKeyService } from '../src/services/api-key.js';
import { getPool } from '../src/database/connection.js';

async function createTestApiKey() {
  const apiKeyService = new ApiKeyService();

  try {
    // First, get or create a test organization
    const pool = getPool();

    let orgResult = await pool.query(`
      SELECT id FROM organizations WHERE name = 'Test Organization' LIMIT 1
    `);

    let orgId;
    if (orgResult.rows.length === 0) {
      console.log('Creating test organization...');
      const newOrg = await pool.query(`
        INSERT INTO organizations (name, slug)
        VALUES ('Test Organization', 'test-org')
        RETURNING id
      `);
      orgId = newOrg.rows[0].id;
    } else {
      orgId = orgResult.rows[0].id;
    }

    // Get or create a test user
    let userResult = await pool.query(`
      SELECT id FROM users WHERE email = 'test@truxe.io' LIMIT 1
    `);

    let userId;
    if (userResult.rows.length === 0) {
      console.log('Creating test user...');
      const newUser = await pool.query(`
        INSERT INTO users (email, email_verified)
        VALUES ('test@truxe.io', true)
        RETURNING id
      `);
      userId = newUser.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }

    console.log(`\n📋 Creating test service account...`);
    console.log(`   Organization ID: ${orgId}`);
    console.log(`   User ID: ${userId}`);

    // Create service account with API key
    const result = await apiKeyService.createServiceAccount({
      organizationId: orgId,
      name: 'Test Backend Service',
      description: 'Test service account for E2E testing',
      createdBy: userId,
      permissions: ['users:read', 'users:write', 'organizations:read'],
      environment: 'test'
    });

    console.log(`\n✅ Service account created successfully!`);
    console.log(`\n📊 Service Account Details:`);
    console.log(`   ID: ${result.serviceAccount.id}`);
    console.log(`   Name: ${result.serviceAccount.name}`);
    console.log(`   Organization: ${orgId}`);
    console.log(`\n🔑 API Key (SAVE THIS - IT WON'T BE SHOWN AGAIN):`);
    console.log(`\n   ${result.apiKey.fullKey}\n`);
    console.log(`\n📝 Test the API key with:`);
    console.log(`\n   curl -H "Authorization: Bearer ${result.apiKey.fullKey}" http://localhost:3001/api/api-keys/test\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test API key:', error);
    process.exit(1);
  }
}

createTestApiKey();

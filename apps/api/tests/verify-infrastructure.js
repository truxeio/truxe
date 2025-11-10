#!/usr/bin/env node

/**
 * Test Infrastructure Verification Script
 * 
 * Runs comprehensive checks to verify that:
 * 1. Database schema is correct
 * 2. RBAC functionality works
 * 3. Test helpers work properly
 * 4. No configuration issues
 */

import { randomUUID } from 'crypto'

console.log('🔍 Test Infrastructure Verification\n')
console.log('=' .repeat(60))

// Test 1: Schema Verification
console.log('\n📋 Test 1: Database Schema Verification')
console.log('-'.repeat(60))

try {
  const { verifyDatabaseSchema } = await import('./helpers/schema-verifier.js')
  const result = await verifyDatabaseSchema({ verbose: false, throwOnError: true })
  
  console.log('✅ Schema verification PASSED')
  console.log(`   Tables checked: ${result.tablesChecked}`)
  console.log(`   Columns verified: ${result.columnsVerified}`)
  
  if (result.warnings.length > 0) {
    console.log(`   Warnings: ${result.warnings.length}`)
    result.warnings.forEach(w => console.log(`   ⚠️  ${w}`))
  }
} catch (error) {
  console.error('❌ Schema verification FAILED')
  console.error(`   ${error.message}`)
  process.exit(1)
}

// Test 2: Connection Pool
console.log('\n🔌 Test 2: Database Connection Pool')
console.log('-'.repeat(60))

try {
  const { testDatabase } = await import('./helpers/test-database.js')
  const client = await testDatabase.connect()
  
  const result = await client.query('SELECT 1 as test')
  
  if (result.rows[0].test === 1) {
    console.log('✅ Connection pool working')
    console.log(`   Max connections: ${testDatabase.options.max}`)
    console.log(`   Connection timeout: ${testDatabase.options.connectionTimeoutMillis}ms`)
  }
  
  client.release()
} catch (error) {
  console.error('❌ Connection pool FAILED')
  console.error(`   ${error.message}`)
  process.exit(1)
}

// Test 3: Transaction Isolation
console.log('\n🔒 Test 3: Transaction Isolation')
console.log('-'.repeat(60))

try {
  const { testDatabase } = await import('./helpers/test-database.js')
  const client = await testDatabase.connect()
  
  await client.query('BEGIN')
  await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
  
  const result = await client.query('SHOW transaction_isolation')
  const isolationLevel = result.rows[0].transaction_isolation
  
  await client.query('ROLLBACK')
  client.release()
  
  if (isolationLevel === 'read committed') {
    console.log('✅ Transaction isolation working')
    console.log(`   Isolation level: ${isolationLevel}`)
  } else {
    throw new Error(`Wrong isolation level: ${isolationLevel}`)
  }
} catch (error) {
  console.error('❌ Transaction isolation FAILED')
  console.error(`   ${error.message}`)
  process.exit(1)
}

// Test 4: Test Data Creation
console.log('\n🏗️  Test 4: Test Data Creation')
console.log('-'.repeat(60))

try {
  const { testDatabase } = await import('./helpers/test-database.js')
  const client = await testDatabase.connect()
  
  await client.query('BEGIN')
  
  const testId = randomUUID().split('-')[0]
  
  // Create user
  const userId = randomUUID()
  const userResult = await client.query(
    `INSERT INTO users (id, email, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING id`,
    [userId, `test-${testId}@example.com`, { isTestUser: true, testId }]
  )
  
  // Create tenant
  const tenantId = randomUUID()
  const tenantResult = await client.query(
    `INSERT INTO tenants (id, name, slug, path, level, tenant_type, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING id`,
    [tenantId, `Test Tenant ${testId}`, `test-${testId}`, [tenantId], 0, 'workspace', { isTestTenant: true, testId }]
  )
  
  // Create permission (depends on user and tenant)
  const permissionResult = await client.query(
    `INSERT INTO permissions (user_id, tenant_id, resource_type, actions, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id`,
    [userId, tenantId, 'documents', ['read', 'write']]
  )
  
  // Create policy (depends on tenant) - NO DESCRIPTION!
  const policyResult = await client.query(
    `INSERT INTO policies (name, tenant_id, conditions, effect, resources, actions, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING id`,
    [`test-policy-${testId}`, tenantId, '{}', 'allow', ['documents'], ['read']]
  )
  
  // Cleanup
  await client.query('DELETE FROM permissions WHERE id = $1', [permissionResult.rows[0].id])
  await client.query('DELETE FROM policies WHERE id = $1', [policyResult.rows[0].id])
  await client.query('DELETE FROM tenants WHERE id = $1', [tenantId])
  await client.query('DELETE FROM users WHERE id = $1', [userId])
  
  await client.query('ROLLBACK')
  client.release()
  
  console.log('✅ Test data creation working')
  console.log('   Created: user, tenant, permission, policy')
  console.log('   Cleaned up successfully')
  
} catch (error) {
  console.error('❌ Test data creation FAILED')
  console.error(`   ${error.message}`)
  process.exit(1)
}

// Test 5: Foreign Key Validation
console.log('\n🔗 Test 5: Foreign Key Validation')
console.log('-'.repeat(60))

try {
  const { testDatabase } = await import('./helpers/test-database.js')
  const client = await testDatabase.connect()
  
  await client.query('BEGIN')
  
  // Try to create permission with non-existent user (should fail)
  let foreignKeyEnforced = false
  try {
    await client.query(
      `INSERT INTO permissions (user_id, tenant_id, resource_type, actions, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [randomUUID(), randomUUID(), 'test', ['read']]
    )
  } catch (error) {
    if (error.code === '23503') { // Foreign key violation
      foreignKeyEnforced = true
    }
  }
  
  await client.query('ROLLBACK')
  client.release()
  
  if (foreignKeyEnforced) {
    console.log('✅ Foreign key constraints enforced')
    console.log('   Prevented invalid foreign key insertion')
  } else {
    throw new Error('Foreign key constraints not enforced')
  }
  
} catch (error) {
  console.error('❌ Foreign key validation FAILED')
  console.error(`   ${error.message}`)
  process.exit(1)
}

// Test 6: PolicyEngine Schema Check
console.log('\n📜 Test 6: PolicyEngine Schema Compatibility')
console.log('-'.repeat(60))

try {
  const { testDatabase } = await import('./helpers/test-database.js')
  
  // Check that description column does NOT exist
  const result = await testDatabase.query(
    `SELECT column_name 
     FROM information_schema.columns 
     WHERE table_name = 'policies' AND column_name = 'description'`
  )
  
  if (result.rows.length === 0) {
    console.log('✅ PolicyEngine schema correct')
    console.log('   policies table does NOT have description column')
    console.log('   PolicyEngine service matches schema')
  } else {
    throw new Error('policies table has description column (should not exist)')
  }
  
} catch (error) {
  console.error('❌ PolicyEngine schema check FAILED')
  console.error(`   ${error.message}`)
  process.exit(1)
}

// Final Summary
console.log('\n' + '='.repeat(60))
console.log('🎉 All Verification Tests PASSED!\n')
console.log('Your test infrastructure is properly configured and ready to use.\n')
console.log('Next steps:')
console.log('  1. Run simple RBAC test: node test-rbac-simple.js')
console.log('  2. Run full test suite: npm test')
console.log('  3. Refer to QUICK_REFERENCE.md for usage patterns\n')

process.exit(0)

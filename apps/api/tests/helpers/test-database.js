/**
 * Test Database Helper
 * 
 * Utilities for setting up test data and managing test database
 * 
 * Best Practices Applied:
 * - Proper foreign key constraint ordering
 * - Transaction isolation for concurrent test safety
 * - Comprehensive validation before insertion
 * - Deadlock prevention through consistent ordering
 * - Schema verification on startup
 */

import pg from 'pg'
import { randomBytes, randomUUID } from 'crypto'

const { Pool } = pg

// Test database configuration with optimized settings - using new 87XXX port range
export const testDatabase = new Pool({
  host: process.env.TEST_DB_HOST || 'localhost',
  port: process.env.TEST_DB_PORT || parseInt(process.env.TRUXE_DB_PORT) || 87032,
  database: process.env.TEST_DB_NAME || 'truxe.io',
  user: process.env.TEST_DB_USER || 'heimdall',
  password: process.env.TEST_DB_PASSWORD || 'dev_password_change_me',
  max: 20,  // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Optimize for test environment
  statement_timeout: 10000,  // 10 second query timeout
  query_timeout: 10000,
  application_name: 'truxe_test_suite'
})

// Schema verification cache
let schemaVerified = false

/**
 * Verify database schema is ready for tests
 */
async function verifyDatabaseSchema() {
  if (schemaVerified) return

  try {
    // Use the comprehensive schema verifier
    const { verifyDatabaseSchema: verify } = await import('./schema-verifier.js')
    await verify({ verbose: true, throwOnError: true })
    
    schemaVerified = true
  } catch (error) {
    console.error('❌ Database schema verification failed!')
    console.error('Please run database migrations before running tests.')
    throw error
  }
}

/**
 * Validate test data before insertion
 */
function validateTestData(type, data) {
  const errors = []

  switch (type) {
    case 'user':
      if (!data.id || typeof data.id !== 'string') errors.push('Invalid user ID')
      if (!data.email || !data.email.includes('@')) errors.push('Invalid email')
      break
    
    case 'tenant':
      if (!data.id || typeof data.id !== 'string') errors.push('Invalid tenant ID')
      if (!data.name || data.name.length < 1) errors.push('Invalid tenant name')
      if (data.level < 0 || data.level > 10) errors.push('Invalid tenant level')
      break
    
    case 'permission':
      if (!data.userId) errors.push('Permission requires userId')
      if (!data.tenantId) errors.push('Permission requires tenantId')
      if (!data.resourceType) errors.push('Permission requires resourceType')
      if (!Array.isArray(data.actions) || data.actions.length === 0) {
        errors.push('Permission requires non-empty actions array')
      }
      break
    
    case 'policy':
      if (!data.tenantId) errors.push('Policy requires tenantId')
      if (!data.name) errors.push('Policy requires name')
      if (!['allow', 'deny'].includes(data.effect)) errors.push('Policy effect must be allow or deny')
      break
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed for ${type}: ${errors.join(', ')}`)
  }
}

/**
 * Setup basic test data for integration tests with proper transaction isolation
 */
export async function setupTestData() {
  // Verify schema first
  await verifyDatabaseSchema()

  const testId = randomBytes(8).toString('hex')
  const client = await testDatabase.connect()
  
  try {
    // Use transaction for atomicity and isolation
    await client.query('BEGIN')
    await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    
    // Step 1: Create users FIRST (no dependencies)
    const users = {
      alice: await createTestUser(randomUUID(), `alice-${testId}@example.com`, testId, client),
      bob: await createTestUser(randomUUID(), `bob-${testId}@example.com`, testId, client),
      charlie: await createTestUser(randomUUID(), `charlie-${testId}@example.com`, testId, client),
      admin: await createTestUser(randomUUID(), `admin-${testId}@example.com`, testId, client)
    }
    
    // Step 2: Create tenant hierarchy (depends on nothing, but parent->child order matters)
    const tenants = {
      root: await createTestTenant(randomUUID(), `Root Tenant ${testId}`, null, testId, client),
      parent: null,
      child: null
    }
    
    tenants.parent = await createTestTenant(
      randomUUID(),
      `Parent Tenant ${testId}`,
      tenants.root.id,
      testId,
      client
    )
    
    tenants.child = await createTestTenant(
      randomUUID(),
      `Child Tenant ${testId}`,
      tenants.parent.id,
      testId,
      client
    )
    
    // Step 3: Create permissions (depends on users and tenants)
    const permissions = await setupTestPermissions(users, tenants, client)
    
    // Step 4: Create policies (depends on tenants)
    const policies = await setupTestPolicies(tenants, client)
    
    await client.query('COMMIT')
    
    return {
      testId,
      users,
      tenants,
      permissions,
      policies
    }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to setup test data:', error.message)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Setup large test dataset for performance testing with transaction isolation
 */
export async function setupLargeTestData(config = {}) {
  await verifyDatabaseSchema()

  const {
    users: userCount = 100,
    tenants: tenantCount = 50,
    permissions: permissionCount = 1000,
    policies: policyCount = 100
  } = config
  
  const testId = randomBytes(8).toString('hex')
  const users = []
  const tenants = []
  const permissions = []
  const policies = []
  
  const client = await testDatabase.connect()
  
  try {
    await client.query('BEGIN')
    await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    
    // Create users with UUIDs (batch for performance)
    for (let i = 0; i < userCount; i++) {
      users.push(await createTestUser(
        randomUUID(),
        `user${i}-${testId}@example.com`,
        testId,
        client
      ))
    }
  
    // Create tenant hierarchy
    const rootTenant = await createTestTenant(randomUUID(), `Root Tenant ${testId}`, null, testId, client)
    tenants.push(rootTenant)
    
    // Create deep hierarchy for testing (limit to 3 levels to avoid constraint)
    const deepTenants = [rootTenant]
    for (let depth = 1; depth <= 3; depth++) {
      const parent = deepTenants[depth - 1]
      const deepTenant = await createTestTenant(
        randomUUID(),
        `Deep Tenant Level ${depth} ${testId}`,
        parent.id,
        testId,
        client
      )
      deepTenants.push(deepTenant)
      tenants.push(deepTenant)
    }
    
    // Create remaining tenants (avoid deep hierarchies to prevent constraint violations)
    for (let i = deepTenants.length; i < tenantCount; i++) {
      // Only attach to root or first level tenants to avoid max depth issues
      const parentIndex = Math.floor(Math.random() * Math.min(tenants.length, 2))
      tenants.push(await createTestTenant(
        randomUUID(),
        `Tenant ${i} ${testId}`,
        tenants[parentIndex].id,
        testId,
        client
      ))
    }
    
    // Create permissions (depends on users and tenants existing)
    for (let i = 0; i < permissionCount; i++) {
      const user = users[Math.floor(Math.random() * users.length)]
      const tenant = tenants[Math.floor(Math.random() * tenants.length)]
      const resourceTypes = ['documents', 'projects', 'settings', 'integrations']
      const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)]
      const actions = ['read', 'write', 'delete', 'admin', 'share', 'invite', 'manage']
      const actionCount = Math.floor(Math.random() * 3) + 1
      const selectedActions = actions.slice(0, actionCount)
      
      permissions.push(await createTestPermission(
        user.id,
        tenant.id,
        resourceType,
        selectedActions,
        client
      ))
    }
    
    // Create policies (depends on tenants existing)
    for (let i = 0; i < policyCount; i++) {
      const tenant = tenants[Math.floor(Math.random() * tenants.length)]
      policies.push(await createTestPolicy(tenant.id, `policy-${testId}-${i}`, client))
    }
    
    await client.query('COMMIT')
    
    return {
      testId,
      users,
      tenants,
      permissions,
      policies,
      deepTenants
    }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to setup large test data:', error.message)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Clean up all test data with proper foreign key ordering
 */
export async function cleanupTestData(testId = null) {
  const client = await testDatabase.connect()
  
  try {
    await client.query('BEGIN')
    await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    
    if (testId) {
      // Clean up specific test data by metadata
      // Order matters: delete from child tables first, then parent tables
      
      // 1. Delete permissions (references users and tenants)
      await client.query(
        `DELETE FROM permissions WHERE user_id IN (
          SELECT id FROM users WHERE metadata->>'testId' = $1
        )`,
        [testId]
      )
      
      // 2. Delete policies (references tenants)
      await client.query(
        `DELETE FROM policies WHERE tenant_id IN (
          SELECT id FROM tenants WHERE metadata->>'testId' = $1
        )`,
        [testId]
      )
      
      // 3. Delete user_roles (references users and roles)
      await client.query(
        `DELETE FROM user_roles WHERE user_id IN (
          SELECT id FROM users WHERE metadata->>'testId' = $1
        )`,
        [testId]
      )
      
      // 4. Delete tenant_members (references users and tenants)
      await client.query(
        `DELETE FROM tenant_members WHERE user_id IN (
          SELECT id FROM users WHERE metadata->>'testId' = $1
        ) OR tenant_id IN (
          SELECT id FROM tenants WHERE metadata->>'testId' = $1
        )`,
        [testId]
      )
      
      // 5. Delete tenants (CASCADE will handle children)
      await client.query(
        `DELETE FROM tenants WHERE metadata->>'testId' = $1`,
        [testId]
      )
      
      // 6. Delete users last
      await client.query(
        `DELETE FROM users WHERE metadata->>'testId' = $1`,
        [testId]
      )
    } else {
      // Clean up all test data - same ordering
      await client.query(`
        DELETE FROM permissions WHERE user_id IN (
          SELECT id FROM users WHERE metadata->>'isTestUser' = 'true'
        )
      `)
      await client.query(`
        DELETE FROM policies WHERE tenant_id IN (
          SELECT id FROM tenants WHERE metadata->>'isTestTenant' = 'true'
        )
      `)
      await client.query(`
        DELETE FROM user_roles WHERE user_id IN (
          SELECT id FROM users WHERE metadata->>'isTestUser' = 'true'
        )
      `)
      await client.query(`
        DELETE FROM tenant_members WHERE user_id IN (
          SELECT id FROM users WHERE metadata->>'isTestUser' = 'true'
        ) OR tenant_id IN (
          SELECT id FROM tenants WHERE metadata->>'isTestTenant' = 'true'
        )
      `)
      await client.query(`
        DELETE FROM tenants WHERE metadata->>'isTestTenant' = 'true'
      `)
      await client.query(`
        DELETE FROM users WHERE metadata->>'isTestUser' = 'true'
      `)
    }
    
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to cleanup test data:', error.message)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Create a test user with validation
 */
async function createTestUser(id, email, testId = null, client = null) {
  const metadata = { isTestUser: true, testEmail: email }
  if (testId) {
    metadata.testId = testId
  }
  
  // Validate before insertion
  validateTestData('user', { id, email })
  
  const db = client || testDatabase
  const result = await db.query(
    `INSERT INTO users (id, email, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET metadata = EXCLUDED.metadata
     RETURNING *`,
    [id, email, metadata]
  )
  
  return result.rows[0]
}

/**
 * Create a test tenant with proper hierarchy validation
 */
async function createTestTenant(id, name, parentId, testId = null, client = null) {
  const db = client || testDatabase
  
  // Build path for materialized path
  let path = [id]
  let level = 0
  
  if (parentId) {
    // Verify parent exists first (foreign key validation)
    const parentResult = await db.query(
      'SELECT path, level FROM tenants WHERE id = $1',
      [parentId]
    )
    
    if (parentResult.rows.length === 0) {
      throw new Error(`Parent tenant not found: ${parentId}`)
    }
    
    path = [...parentResult.rows[0].path, id]
    level = parentResult.rows[0].level + 1
    
    // Validate hierarchy depth
    if (level > 5) {
      throw new Error(`Tenant hierarchy too deep: level ${level} exceeds maximum of 5`)
    }
  }
  
  const metadata = { isTestTenant: true, testName: name }
  if (testId) {
    metadata.testId = testId
  }
  
  // Validate before insertion
  validateTestData('tenant', { id, name, level })
  
  const result = await db.query(
    `INSERT INTO tenants (id, name, slug, parent_tenant_id, path, level, tenant_type, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
     RETURNING *`,
    [
      id, 
      name, 
      name.toLowerCase().replace(/\s+/g, '-'), 
      parentId, 
      path, 
      level,
      'workspace',
      metadata
    ]
  )
  
  return result.rows[0]
}

/**
 * Create a test permission with foreign key validation
 */
async function createTestPermission(userId, tenantId, resourceType, actions, client = null) {
  const db = client || testDatabase
  
  // Validate before insertion
  validateTestData('permission', { userId, tenantId, resourceType, actions })
  
  // Verify foreign keys exist
  const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId])
  if (userCheck.rows.length === 0) {
    throw new Error(`Cannot create permission: user ${userId} does not exist`)
  }
  
  const tenantCheck = await db.query('SELECT id FROM tenants WHERE id = $1', [tenantId])
  if (tenantCheck.rows.length === 0) {
    throw new Error(`Cannot create permission: tenant ${tenantId} does not exist`)
  }
  
  const result = await db.query(
    `INSERT INTO permissions (user_id, tenant_id, resource_type, actions, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING *`,
    [userId, tenantId, resourceType, actions]
  )
  
  return result.rows[0]
}

/**
 * Create a test policy with foreign key validation (NO description column)
 */
async function createTestPolicy(tenantId, name, client = null) {
  const db = client || testDatabase
  
  const conditions = {
    timeRange: {
      start: '09:00',
      end: '17:00',
      timezone: 'UTC'
    }
  }
  
  // Validate before insertion
  validateTestData('policy', { tenantId, name, effect: 'allow' })
  
  // Verify tenant exists
  const tenantCheck = await db.query('SELECT id FROM tenants WHERE id = $1', [tenantId])
  if (tenantCheck.rows.length === 0) {
    throw new Error(`Cannot create policy: tenant ${tenantId} does not exist`)
  }
  
  // NOTE: policies table does NOT have a description column - only name, tenant_id, conditions, effect, resources, actions
  const result = await db.query(
    `INSERT INTO policies (name, tenant_id, conditions, effect, resources, actions, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING *`,
    [name, tenantId, JSON.stringify(conditions), 'allow', ['documents'], ['read']]
  )
  
  return result.rows[0]
}

/**
 * Setup basic permissions for integration tests
 */
async function setupTestPermissions(users, tenants, client = null) {
  const permissions = []
  
  // Grant admin permissions to admin user
  permissions.push(await createTestPermission(
    users.admin.id,
    tenants.root.id,
    'tenants',
    ['admin'],
    client
  ))
  
  // Grant document permissions to Alice
  permissions.push(await createTestPermission(
    users.alice.id,
    tenants.parent.id,
    'documents',
    ['read', 'write'],
    client
  ))
  
  // Grant project permissions to Bob (using valid actions)
  permissions.push(await createTestPermission(
    users.bob.id,
    tenants.child.id,
    'projects',
    ['read', 'manage'],
    client
  ))
  
  return permissions
}

/**
 * Setup basic policies for integration tests
 */
async function setupTestPolicies(tenants, client = null) {
  const policies = []
  
  // Time-based policy
  policies.push(await createTestPolicy(
    tenants.child.id,
    'business-hours-only',
    client
  ))
  
  return policies
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const start = Date.now()
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Measure execution time
 */
export async function measureTime(fn) {
  const start = process.hrtime.bigint()
  const result = await fn()
  const end = process.hrtime.bigint()
  
  return {
    result,
    timeMs: Number(end - start) / 1000000
  }
}

/**
 * Enhanced test database interface with convenience methods
 */
const testDatabaseInterface = {
  // Database connection
  pool: testDatabase,
  
  // Connect and disconnect
  connect: async () => {
    await verifyDatabaseSchema()
    return testDatabase
  },
  
  disconnect: async () => {
    await testDatabase.end()
  },
  
  // Query methods
  query: async (text, params) => {
    return testDatabase.query(text, params)
  },
  
  // Truncate tables for OAuth tests
  truncate: async (tables) => {
    const client = await testDatabase.connect()
    try {
      await client.query('BEGIN')
      
      // Disable triggers for faster truncation
      for (const table of tables) {
        await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)
      }
      
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
  
  // Create test user
  createUser: async (userData) => {
    const id = userData.id || randomUUID()
    const email = userData.email || `test-${Date.now()}@example.com`
    const emailVerified = userData.email_verified !== undefined ? userData.email_verified : true
    const status = userData.status || 'active'
    const metadata = userData.metadata || { isTestUser: true }
    
    const result = await testDatabase.query(
      `INSERT INTO users (id, email, email_verified, status, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET 
         email_verified = EXCLUDED.email_verified,
         status = EXCLUDED.status,
         metadata = EXCLUDED.metadata
       RETURNING *`,
      [id, email, emailVerified, status, metadata]
    )
    
    return result.rows[0]
  },
  
  // Create test tenant
  createTenant: async (tenantData) => {
    const id = tenantData.id || randomUUID()
    const name = tenantData.name || `Test Tenant ${Date.now()}`
    const slug = tenantData.slug || name.toLowerCase().replace(/\s+/g, '-')
    
    const result = await testDatabase.query(
      `INSERT INTO tenants (id, name, slug, tenant_type, level, path, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, 'workspace', 0, ARRAY[$1::uuid], $4, NOW(), NOW())
       RETURNING *`,
      [id, name, slug, { isTestTenant: true }]
    )
    
    return result.rows[0]
  },
  
  // Setup and cleanup
  setupTestData,
  setupLargeTestData,
  cleanupTestData,
  
  // Utilities
  waitFor,
  measureTime
}

export default testDatabaseInterface
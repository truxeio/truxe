# Quick Reference: Test Database Best Practices

## TL;DR - Critical Rules

1. **Always use transactions for test setup**
2. **Create parents before children**
3. **Validate foreign keys before inserting**
4. **Pass the database client through helper functions**
5. **Clean up in reverse order of creation**

## Database Schema Reference

### Policies Table (IMPORTANT!)
```sql
-- ✅ CORRECT Schema
CREATE TABLE policies (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conditions JSONB DEFAULT '{}'::jsonb,
  effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
  resources TEXT[] NOT NULL,
  actions TEXT[] NOT NULL,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id)
);

-- ❌ NO description column!
```

## Correct Test Data Creation Order

```javascript
// 1. Users (no dependencies)
const users = await createUsers(client)

// 2. Tenants (parent before child)
const rootTenant = await createTenant(null, client)
const childTenant = await createTenant(rootTenant.id, client)

// 3. Roles (depends on tenants)
const roles = await createRoles(tenants, client)

// 4. Permissions (depends on users + tenants)
const permissions = await createPermissions(users, tenants, client)

// 5. User Roles (depends on users + roles + tenants)
const userRoles = await assignRoles(users, roles, tenants, client)

// 6. Policies (depends on tenants)
const policies = await createPolicies(tenants, client)

// 7. Tenant Members (depends on users + tenants)
const members = await addMembers(users, tenants, client)
```

## Transaction Template

```javascript
export async function setupTestData() {
  const client = await testDatabase.connect()
  
  try {
    await client.query('BEGIN')
    await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    
    // Your test data creation here
    const data = await createData(client)
    
    await client.query('COMMIT')
    return data
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Setup failed:', error.message)
    throw error
  } finally {
    client.release()
  }
}
```

## Helper Function Template

```javascript
async function createTestPermission(userId, tenantId, resourceType, actions, client = null) {
  const db = client || testDatabase
  
  // 1. Validate input
  validateTestData('permission', { userId, tenantId, resourceType, actions })
  
  // 2. Check foreign keys exist
  const userExists = await db.query('SELECT id FROM users WHERE id = $1', [userId])
  if (userExists.rows.length === 0) {
    throw new Error(`User ${userId} does not exist`)
  }
  
  const tenantExists = await db.query('SELECT id FROM tenants WHERE id = $1', [tenantId])
  if (tenantExists.rows.length === 0) {
    throw new Error(`Tenant ${tenantId} does not exist`)
  }
  
  // 3. Insert
  const result = await db.query(
    `INSERT INTO permissions (user_id, tenant_id, resource_type, actions, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING *`,
    [userId, tenantId, resourceType, actions]
  )
  
  return result.rows[0]
}
```

## Common Mistakes to Avoid

### ❌ Creating Children Before Parents
```javascript
// WRONG
await createPermission(userId, tenantId, ...)
await createUser(userId, ...)  // Too late!
```

### ❌ Not Using Transactions
```javascript
// WRONG - Concurrent tests will conflict
await testDatabase.query('INSERT INTO users ...')
await testDatabase.query('INSERT INTO permissions ...')
```

### ❌ Not Passing Client Through
```javascript
// WRONG - Creates new connection, breaks transaction
async function helper(userId) {
  await testDatabase.query('INSERT ...')  // Outside transaction!
}
```

### ❌ Using Description in Policies
```javascript
// WRONG - description column doesn't exist
await db.query(
  'INSERT INTO policies (name, tenant_id, description, ...) VALUES ...'
)
```

### ✅ Correct Patterns

```javascript
// RIGHT - Parents first
await createUser(userId, client)
await createPermission(userId, tenantId, client)

// RIGHT - Use transactions
const client = await testDatabase.connect()
try {
  await client.query('BEGIN')
  await createData(client)
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
}

// RIGHT - Pass client through
async function helper(userId, client) {
  await client.query('INSERT ...')  // Uses transaction!
}

// RIGHT - No description in policies
await db.query(
  'INSERT INTO policies (name, tenant_id, conditions, effect, resources, actions, ...) VALUES ...'
)
```

## Cleanup Order

```javascript
// Delete in REVERSE order of creation
async function cleanupTestData(testId, client) {
  // 7. Tenant Members
  await client.query('DELETE FROM tenant_members WHERE ...')
  
  // 6. Policies
  await client.query('DELETE FROM policies WHERE ...')
  
  // 5. User Roles
  await client.query('DELETE FROM user_roles WHERE ...')
  
  // 4. Permissions
  await client.query('DELETE FROM permissions WHERE ...')
  
  // 3. Roles
  await client.query('DELETE FROM roles WHERE ...')
  
  // 2. Tenants (CASCADE handles children)
  await client.query('DELETE FROM tenants WHERE ...')
  
  // 1. Users
  await client.query('DELETE FROM users WHERE ...')
}
```

## Verification Commands

```bash
# Verify schema
node -e "import('./tests/helpers/schema-verifier.js').then(m => m.verifyDatabaseSchema({ verbose: true }))"

# Run simple test
node test-rbac-simple.js

# Run full tests
npm test
```

## When to Use What

| Scenario | Tool/Approach |
|----------|---------------|
| Setup test data | `setupTestData()` with transaction |
| Create single record | Helper function with client param |
| Validate schema | `schema-verifier.js` |
| Check foreign keys | Pre-flight SELECT queries |
| Clean up data | `cleanupTestData()` with transaction |
| Run tests | Jest with proper setup/teardown |

## Key Files

- `/api/tests/helpers/test-database.js` - Main test helper
- `/api/tests/helpers/schema-verifier.js` - Schema verification
- `/api/src/services/rbac/policy-engine.js` - Policy service (no description!)
- `/database/migrations/031_rbac_schema.sql` - RBAC schema definition

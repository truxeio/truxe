/**
 * Enhanced Test Setup Configuration
 * 
 * Global test setup for RBAC tests with database, Redis, and service mocking.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { testDatabase, cleanupTestData } from './helpers/test-database.js'

// Set test environment
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'silent'

// Mock configuration for testing - using new 87XXX port range
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://truxe.io_password_change_me@localhost:87032/truxe.io'
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:87079/1'
process.env.JWT_ISSUER = 'https://test.truxe.io'
process.env.JWT_ALGORITHM = 'RS256'
process.env.EMAIL_PROVIDER = 'smtp'
process.env.ENABLE_RATE_LIMITING = 'false'
process.env.ENABLE_SWAGGER = 'false'

// OAuth configuration for testing
process.env.OAUTH_STATE_SECRET = 'test-state-secret-32-characters!!'
process.env.OAUTH_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef'

// Test RSA keys (for testing only - never use in production)
process.env.JWT_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA1Ib5ier5CM/QGkKdcYsZKRBc/E1bi/bZiL16N7H2jbbtpKUz
LhxC1QkCiLjHdQdMoM/Oim9Ga/2jExg3Z3a4gjQQbGMl0kle/unpq0Yr+B67WdxQ
MxK+JvM6BUGZ5VDqSTCbzmVFYaCEg1T3aVMijRuO/LmThpYZ6rf+l5LzKfgOLaw9
YqsENT5bgRIzOAPvf1aPn41njMn3qWw4PFXc6tufGyGfyJ0iQ0XOYUQR50eCt3Xi
cMVOW3v84h7iqy+h4IezSYTePtX40RnUzo466Gs8zxCN+tZ+YW2P8vWMkw6I77jq
TKIfy4Xm72YKv3c0cjnl/rDhruS6Yt7dDeySjQIDAQABAoIBACA6P4jsessdSD9T
LrDTGQOjGZag3GsDCcW0hd4APJUM0kiPTI2Hd5L6hMnay1QxwSr5mCZh7Vne4mW4
3F3yINSNtJfbCRc0TRV2vxpbz7sWXe6oe/jitLcPVxMI+Z9Of9iNaHMJ5FWDk9Se
g84S70Bal3o3YemcxV1UfWTawcjxL+OAAMORZ2CzQO5ZkodKNB44j/jZVcemQM2O
OCw2SQ07mcUhlT55BwDDLu+4dxuMn9YvwMKmuAEUwKk7cqwfJoWQE61YYe21Q1et
kZItlzNFj0Cjw/vzmTJGoJNQnFEq6IKeW+ZA0zdgvKBxFDT0INpQgXu2KnqQX+0o
kGRpjvkCgYEA7hanMAV8GyuCKCvSKzecJleKR8kjQA/98+x98UA84liX7yXmSrRw
nXbtEAxImxj7iVZzrabkj/D9fNyBQLPc5uZUD4o6XLJ2UrtJ4QPEjXND63eI6KWa
pzqEKrH1H6gUsK67hZXsStBnCU2cKQMA0At+SRsLlRLgvBx6RBje3D8CgYEA5IQJ
oXEd76E8zXAUKmTz1K9T+lDk6KjyvtyJkFZZCVF82Rpk2OpieRvWGRX9TCW7bSx4
KUoSVxK8sM+sD4HqO3/7c5dp2Ttn6pTwU2sweY4sJaX3vGvCLGt9FGvjBHE0OXuz
FszysKeOqauIidfctvm7+ovDOiWM61PuEBi0zjMCgYEA40MyUU9a+KBePDQgCGqr
nZm//+fJwxPAx/489XTo6PHCDV/y4+o6+MOVY9Ul1Q5Sw/SGtQJyd8eEX5QnuHg3
axv+r1q1fNhIw43M5oFvM8oL0g6m29N/vRLJJ+v4XEBXh5Myoj/KblthjurLHgak
1vGxmNy9AI4lgMn6F1haGocCgYEArD3x3GQcwmBwKhFOwd2yBB/bVpPe1pdx0Pb+
IXNUTTfEuQex9+ZDLzISIHp4oArYySN5tvWD+WnAHC2MbWvpF8wRxkDcocarPx/g
PaBPu2+0SvRcVQOMKlsivl/Lj6+cQ6+/f3Ifg5Pobm9CzVONo8V9MQ5jqtJe84oh
qLRWpA0CgYEApEvinfQR8E57A+ZS+Az+WVuZwQpWI41zZKi6oNyQMSyGreL1JpLl
kNcYrvnGqlZW3m2NWE1y1m7ZqFID+LKeTtMKBJXhleyUQ/ax4FjYBYcZclAg8uhy
wRcJIUcVNh+VG6wN3wEvP3b5pAcwibneaVIbLdmh5OCOaVe6J+I1z+8=
-----END RSA PRIVATE KEY-----`

process.env.JWT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1Ib5ier5CM/QGkKdcYsZ
KRBc/E1bi/bZiL16N7H2jbbtpKUzLhxC1QkCiLjHdQdMoM/Oim9Ga/2jExg3Z3a4
gjQQbGMl0kle/unpq0Yr+B67WdxQMxK+JvM6BUGZ5VDqSTCbzmVFYaCEg1T3aVMi
jRuO/LmThpYZ6rf+l5LzKfgOLaw9YqsENT5bgRIzOAPvf1aPn41njMn3qWw4PFXc
6tufGyGfyJ0iQ0XOYUQR50eCt3XicMVOW3v84h7iqy+h4IezSYTePtX40RnUzo46
6Gs8zxCN+tZ+YW2P8vWMkw6I77jqTKIfy4Xm72YKv3c0cjnl/rDhruS6Yt7dDeyS
jQIDAQAB
-----END PUBLIC KEY-----`

// Global test timeout
jest.setTimeout(30000)

// Setup test database before all tests
beforeAll(async () => {
  try {
    // Verify database connection
    await testDatabase.query('SELECT 1')
    console.log('✅ Test database connected successfully')
    
    // Initialize test schema if needed
    await setupTestSchema()
    
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error.message)
    throw new Error('Test database setup failed')
  }
})

// Cleanup after all tests
afterAll(async () => {
  try {
    await cleanupTestData()
    await testDatabase.end()
    console.log('✅ Test database cleanup completed')
  } catch (error) {
    console.error('❌ Test cleanup failed:', error.message)
  }
})

// Clean up between tests
afterEach(async () => {
  try {
    // Clean up any test data that might affect other tests
    await testDatabase.query(`
      DELETE FROM permissions 
      WHERE user_id IN (
        SELECT id FROM users WHERE metadata->>'isTestUser' = 'true'
      )
    `)
    
    await testDatabase.query(`
      DELETE FROM policies 
      WHERE tenant_id IN (
        SELECT id FROM tenants WHERE metadata->>'isTestTenant' = 'true'
      )
    `)
    
    await testDatabase.query(`
      DELETE FROM user_roles 
      WHERE user_id IN (
        SELECT id FROM users WHERE metadata->>'isTestUser' = 'true'
      )
    `)
    
  } catch (error) {
    console.warn('⚠️ Test cleanup warning:', error.message)
  }
})

/**
 * Verify test database schema
 */
async function setupTestSchema() {
  const client = await testDatabase.connect()

  try {
    // Verify required tables exist
    const requiredTables = ['users', 'tenants', 'permissions', 'policies', 'roles', 'role_permissions', 'user_roles']

    for (const tableName of requiredTables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )
      `, [tableName])

      if (!result.rows[0].exists) {
        throw new Error(`Required table '${tableName}' does not exist. Please run database migrations.`)
      }
    }

    console.log('✅ Test schema verification completed')

  } catch (error) {
    console.error('❌ Test schema verification failed:', error.message)
    throw error
  } finally {
    client.release()
  }
}

// Mock console methods for cleaner test output
const originalConsole = { ...console }

beforeEach(() => {
  // Suppress console output during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = jest.fn()
    console.info = jest.fn()
    console.warn = jest.fn()
    console.error = jest.fn()
  }
})

afterEach(() => {
  // Restore console methods
  if (!process.env.DEBUG) {
    Object.assign(console, originalConsole)
  }
})

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

export default {
  testDatabase,
  setupTestSchema
}

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

// Mock configuration for testing - using default ports
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:truxe.io_password_change_me@localhost:5432/truxe_test'
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1'
process.env.JWT_ISSUER = 'https://test.truxe.io'
process.env.JWT_ALGORITHM = 'RS256'
process.env.EMAIL_PROVIDER = 'smtp'
process.env.ENABLE_RATE_LIMITING = 'false'
process.env.ENABLE_SWAGGER = 'false'

// OAuth configuration for testing
process.env.OAUTH_STATE_SECRET = 'test-state-secret-32-characters!!'
process.env.OAUTH_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef'

// Test RSA keys (for testing only - never use in production)
// Using PKCS#8 format for compatibility with jose library
process.env.JWT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDUhvmJ6vkIz9Aa
Qp1xixkpEFz8TVuL9tmIvXo3sfaNtu2kpTMuHELVCQKIuMd1B0ygz86Kb0Zr/aMT
GDdndriCNBBsYyXSSV7+6emrRiv4HrtZ3FAzEr4m8zoFQZnlUOpJMJvOZUVhoISD
VPdpUyKNG478uZOGlhnqt/6XkvMp+A4trD1iqwQ1PluBEjM4A+9/Vo+fjWeMyfep
bDg8Vdzq258bIZ/InSJDRc5hRBHnR4K3deJwxU5be/ziHuKrL6Hgh7NJhN4+1fjR
GdTOjjroazzPEI361n5hbY/y9YyTDojvuOpMoh/LhebvZgq/dzRyOeX+sOGu5Lpi
3t0N7JKNAgMBAAECggEAIDo/iOx6yx1IP1MusNMZA6MZlqDcawMJxbSF3gA8lQzS
SI9MjYd3kvqEydrLVDHBKvmYJmHtWd7iZbjcXfIg1I20l9sJFzRNFXa/GlvPuxZd
7qh7+OK0tw9XEwj5n05/2I1ocwnkVYOT1J6DzhLvQFqXejdh6ZzFXVR9ZNrByPEv
44AAw5FnYLNA7lmSh0o0HjiP+NlVx6ZAzY44LDZJDTuZxSGVPnkHAMMu77h3G4yf
1i/Awqa4ARTAqTtyrB8mhZATrVhh7bVDV62Rki2XM0WPQKPD+/OZMkagk1CcUSro
gp5b5kDTN2C8oHEUNPQg2lCBe7YqepBf7SiQZGmO+QKBgQDuFqcwBXwbK4IoK9Ir
N5wmV4pHySNAD/3z7H3xQDziWJfvJeZKtHCddu0QDEibGPuJVnOtpuSP8P183IFA
s9zm5lQPijpcsnZSu0nhA8SNc0Prd4jopZqnOoQqsfUfqBSwrruFlexK0GcJTZwp
AwDQC35JGwuVEuC8HHpEGN7cPwKBgQDkhAmhcR3voTzNcBQqZPPUr1P6UOToqPK+
3ImQVlkJUXzZGmTY6mJ5G9YZFf1MJbttLHgpShJXErywz6wPgeo7f/tzl2nZO2fq
lPBTazB5jiwlpfe8a8Isa30Ua+MEcTQ5e7MWzPKwp46pq4iJ19y2+bv6i8M6JYzr
U+4QGLTOMwKBgQDjQzJRT1r4oF48NCAIaqudmb//58nDE8DH/jz1dOjo8cINX/Lj
6jr4w5Vj1SXVDlLD9Ia1AnJ3x4RflCe4eDdrG/6vWrV82EjDjczmgW8zygvSDqbb
03+9Eskn6/hcQFeHkzKiP8puW2GO6sseBqTW8bGY3L0AjiWAyfoXWFoahwKBgQCs
PfHcZBzCYHAqEU7B3bIEH9tWk97Wl3HQ9v4hc1RNN8S5B7H35kMvMhIgenigCtjJ
I3m29YP5acAcLYxta+kXzBHGQNyhxqs/H+A9oE+7b7RK9FxVA4wqWyK+X8uPr5xD
r79/ch+Dk+hub0LNU42jxX0xDmOq0l7ziiGotFakDQKBgQCkS+Kd9BHwTnsD5lL4
DP5ZW5nBClYjjXNkqLqg3JAxLIat4vUmkuWQ1xiu+caqVlbebY1YTXLWbtmoUgP4
sp5O0woEleGV7JRD9rHgWNgFhxlyUCDy6HLBFwkhRxU2H5UbrA3fAS8/dvmkBzCJ
ud5pUhst2aHk4I5pV7on4jXP7w==
-----END PRIVATE KEY-----`

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
    // Skip cleanup - each test suite handles its own cleanup
    // Just close the database connection
    await testDatabase.end()
    console.log('✅ Test database connection closed')
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

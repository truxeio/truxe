/**
 * Jest Test Setup for Truxe Database Tests
 * 
 * Configures the test environment with proper database connection,
 * test data management, and cleanup procedures.
 */

const { DatabasePool } = require('../connection');

// Global test configuration
global.TEST_CONFIG = {
  retryAttempts: 0,
  healthCheckInterval: 0,
  metricsInterval: 0,
  enableRLS: true,
};

// Global test database pool
let globalPool = null;

// Setup before all tests
beforeAll(async () => {
  // Ensure we're in test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Tests must be run with NODE_ENV=test');
  }

  // Ensure test database URL is set
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('test')) {
    throw new Error('DATABASE_URL must point to a test database');
  }

  // Create global test pool
  globalPool = new DatabasePool(global.TEST_CONFIG);
  
  // Wait for initialization
  await new Promise((resolve) => {
    globalPool.on('initialized', resolve);
  });

  // Store in global for access in tests
  global.testPool = globalPool;
});

// Cleanup after all tests
afterAll(async () => {
  if (globalPool) {
    await globalPool.close();
  }
});

// Setup before each test
beforeEach(async () => {
  // Clear RLS context
  if (globalPool) {
    await globalPool.clearRLSContext();
  }
});

// Global test utilities
global.testUtils = {
  /**
   * Generate unique test identifier
   */
  generateTestId: () => {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Create test user
   */
  createTestUser: async (email = null, status = 'active') => {
    const userEmail = email || `${global.testUtils.generateTestId()}@example.com`;
    const result = await globalPool.query(
      'INSERT INTO users (email, status, email_verified) VALUES ($1, $2, $3) RETURNING *',
      [userEmail, status, true]
    );
    return result.rows[0];
  },

  /**
   * Create test organization
   */
  createTestOrganization: async (slug = null, name = null, parentId = null) => {
    const orgSlug = slug || `org-${global.testUtils.generateTestId()}`;
    const orgName = name || `Test Organization ${orgSlug}`;
    
    const result = await globalPool.query(
      'INSERT INTO organizations (slug, name, parent_org_id) VALUES ($1, $2, $3) RETURNING *',
      [orgSlug, orgName, parentId]
    );
    return result.rows[0];
  },

  /**
   * Create test membership
   */
  createTestMembership: async (orgId, userId, role = 'member', joined = true) => {
    const joinedAt = joined ? new Date() : null;
    const result = await globalPool.query(`
      INSERT INTO memberships (org_id, user_id, role, joined_at) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `, [orgId, userId, role, joinedAt]);
    return result.rows[0];
  },

  /**
   * Create test session
   */
  createTestSession: async (userId, orgId = null, expiresInHours = 24) => {
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const result = await globalPool.query(`
      INSERT INTO sessions (user_id, org_id, expires_at, device_info) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `, [userId, orgId, expiresAt, JSON.stringify({ test: true })]);
    return result.rows[0];
  },

  /**
   * Cleanup test data by pattern
   */
  cleanupTestData: async (pattern = 'test_') => {
    try {
      // Clean up in dependency order
      await globalPool.query(`
        DELETE FROM audit_logs 
        WHERE details @> '{"test": true}' 
        OR actor_user_id IN (
          SELECT id FROM users WHERE email LIKE $1
        )
      `, [`%${pattern}%`]);

      await globalPool.query(`
        DELETE FROM sessions 
        WHERE device_info @> '{"test": true}'
        OR user_id IN (
          SELECT id FROM users WHERE email LIKE $1
        )
      `, [`%${pattern}%`]);

      await globalPool.query(`
        DELETE FROM magic_link_challenges 
        WHERE email LIKE $1
      `, [`%${pattern}%`]);

      await globalPool.query(`
        DELETE FROM memberships 
        WHERE user_id IN (
          SELECT id FROM users WHERE email LIKE $1
        )
        OR org_id IN (
          SELECT id FROM organizations WHERE slug LIKE $1
        )
      `, [`%${pattern}%`]);

      await globalPool.query(`
        DELETE FROM organizations 
        WHERE slug LIKE $1
      `, [`%${pattern}%`]);

      await globalPool.query(`
        DELETE FROM users 
        WHERE email LIKE $1
      `, [`%${pattern}%`]);

    } catch (error) {
      console.warn('Error during test cleanup:', error.message);
    }
  },

  /**
   * Wait for specified time
   */
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Assert RLS is working
   */
  assertRLSBlocks: async (query, params = []) => {
    const result = await globalPool.query(query, params);
    expect(result.rows).toHaveLength(0);
  },

  /**
   * Assert RLS allows access
   */
  assertRLSAllows: async (query, params = [], expectedCount = null) => {
    const result = await globalPool.query(query, params);
    if (expectedCount !== null) {
      expect(result.rows).toHaveLength(expectedCount);
    } else {
      expect(result.rows.length).toBeGreaterThan(0);
    }
    return result.rows;
  },
};

// Custom Jest matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass,
    };
  },

  toBeWithinTimeRange(received, expectedTime, toleranceMs = 1000) {
    const receivedTime = new Date(received).getTime();
    const expectedTimeMs = new Date(expectedTime).getTime();
    const diff = Math.abs(receivedTime - expectedTimeMs);
    const pass = diff <= toleranceMs;
    
    return {
      message: () => `expected ${received} to be within ${toleranceMs}ms of ${expectedTime}`,
      pass,
    };
  },

  toHaveValidTimestamps(received) {
    const pass = received.created_at && 
                 received.updated_at && 
                 new Date(received.created_at) <= new Date(received.updated_at);
    
    return {
      message: () => `expected object to have valid created_at and updated_at timestamps`,
      pass,
    };
  },
});

// Handle uncaught errors in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in test:', error);
});

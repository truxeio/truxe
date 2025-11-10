/**
 * Truxe Database Security Validation Tests
 * 
 * Comprehensive test suite to validate:
 * - Row Level Security (RLS) policies
 * - Multi-tenant data isolation
 * - Cross-tenant access prevention
 * - SQL injection protection
 * - Privilege escalation prevention
 * - Data integrity constraints
 */

const { DatabasePool } = require('../connection');
const crypto = require('crypto');

// Test configuration
const TEST_CONFIG = {
  retryAttempts: 0, // No retries for tests
  healthCheckInterval: 0, // Disable health checks
  metricsInterval: 0, // Disable metrics
};

describe('Database Security Validation', () => {
  let pool;
  let testUsers = [];
  let testOrgs = [];

  beforeAll(async () => {
    // Create test database pool
    pool = new DatabasePool(TEST_CONFIG);
    
    // Wait for pool to initialize
    await new Promise(resolve => {
      pool.on('initialized', resolve);
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await pool.close();
  });

  beforeEach(async () => {
    // Clear any existing RLS context
    await pool.clearRLSContext();
  });

  describe('Row Level Security (RLS) Policies', () => {
    let user1, user2, org1, org2;

    beforeAll(async () => {
      // Create test users and organizations
      [user1, user2] = await createTestUsers(2);
      [org1, org2] = await createTestOrganizations(2);
      
      // Create memberships
      await createMembership(org1.id, user1.id, 'owner');
      await createMembership(org2.id, user2.id, 'owner');
    });

    test('should prevent cross-tenant organization access', async () => {
      // Set RLS context for user1
      await pool.setRLSContext(user1.id);
      
      // User1 should see only their organization
      const result = await pool.query('SELECT id FROM organizations');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(org1.id);
      
      // Clear context and set for user2
      await pool.clearRLSContext();
      await pool.setRLSContext(user2.id);
      
      // User2 should see only their organization
      const result2 = await pool.query('SELECT id FROM organizations');
      expect(result2.rows).toHaveLength(1);
      expect(result2.rows[0].id).toBe(org2.id);
    });

    test('should prevent cross-tenant membership access', async () => {
      await pool.setRLSContext(user1.id);
      
      // User1 should see only memberships in their organization
      const result = await pool.query('SELECT org_id, user_id FROM memberships');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].org_id).toBe(org1.id);
      expect(result.rows[0].user_id).toBe(user1.id);
    });

    test('should prevent cross-tenant session access', async () => {
      // Create sessions for both users
      const session1 = await createTestSession(user1.id, org1.id);
      const session2 = await createTestSession(user2.id, org2.id);
      
      await pool.setRLSContext(user1.id);
      
      // User1 should see only their sessions
      const result = await pool.query('SELECT jti, user_id FROM sessions');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].user_id).toBe(user1.id);
      
      // Cleanup sessions
      await pool.query('DELETE FROM sessions WHERE jti IN ($1, $2)', [session1.jti, session2.jti]);
    });

    test('should prevent cross-tenant audit log access', async () => {
      // Create audit logs for both organizations
      await createTestAuditLog(org1.id, user1.id, 'test.action1');
      await createTestAuditLog(org2.id, user2.id, 'test.action2');
      
      await pool.setRLSContext(user1.id);
      
      // User1 should see only audit logs from their organization
      const result = await pool.query('SELECT org_id, action FROM audit_logs WHERE action LIKE $1', ['test.action%']);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].org_id).toBe(org1.id);
      expect(result.rows[0].action).toBe('test.action1');
    });

    test('should allow hierarchical organization access for admins', async () => {
      // Create parent and child organizations
      const parentOrg = await createTestOrganization('parent-org', 'Parent Org');
      const childOrg = await createTestOrganization('child-org', 'Child Org', parentOrg.id);
      
      // Make user1 admin of parent organization
      await createMembership(parentOrg.id, user1.id, 'admin');
      
      await pool.setRLSContext(user1.id);
      
      // User1 should see both parent and child organizations
      const result = await pool.query('SELECT id, name FROM organizations WHERE id IN ($1, $2)', [parentOrg.id, childOrg.id]);
      expect(result.rows).toHaveLength(2);
      
      // Cleanup
      await pool.query('DELETE FROM organizations WHERE id IN ($1, $2)', [childOrg.id, parentOrg.id]);
    });
  });

  describe('SQL Injection Protection', () => {
    let user, org;

    beforeAll(async () => {
      [user] = await createTestUsers(1);
      [org] = await createTestOrganizations(1);
      await createMembership(org.id, user.id, 'owner');
    });

    test('should prevent SQL injection in organization queries', async () => {
      await pool.setRLSContext(user.id);
      
      // Attempt SQL injection
      const maliciousInput = "'; DROP TABLE users; --";
      
      await expect(
        pool.query('SELECT * FROM organizations WHERE slug = $1', [maliciousInput])
      ).resolves.toBeDefined();
      
      // Verify users table still exists
      const result = await pool.query('SELECT COUNT(*) FROM users');
      expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);
    });

    test('should prevent SQL injection in membership queries', async () => {
      await pool.setRLSContext(user.id);
      
      const maliciousRole = "admin'; UPDATE users SET status = 'blocked'; --";
      
      await expect(
        pool.query('SELECT * FROM memberships WHERE role = $1', [maliciousRole])
      ).resolves.toBeDefined();
      
      // Verify no users were blocked
      const result = await pool.query('SELECT COUNT(*) FROM users WHERE status = $1', ['blocked']);
      expect(parseInt(result.rows[0].count)).toBe(0);
    });

    test('should sanitize JSONB input', async () => {
      await pool.setRLSContext(user.id);
      
      const maliciousMetadata = {
        "'; DROP TABLE sessions; --": "value",
        normal_key: "normal_value"
      };
      
      await expect(
        pool.query('UPDATE users SET metadata = $1 WHERE id = $2', [JSON.stringify(maliciousMetadata), user.id])
      ).resolves.toBeDefined();
      
      // Verify sessions table still exists
      const result = await pool.query('SELECT COUNT(*) FROM sessions');
      expect(result.rows).toBeDefined();
    });
  });

  describe('Data Integrity Constraints', () => {
    test('should enforce email uniqueness', async () => {
      const email = `test-unique-${Date.now()}@example.com`;
      
      // Create first user
      await pool.query('INSERT INTO users (email, status) VALUES ($1, $2)', [email, 'active']);
      
      // Attempt to create duplicate
      await expect(
        pool.query('INSERT INTO users (email, status) VALUES ($1, $2)', [email, 'active'])
      ).rejects.toThrow(/duplicate key value violates unique constraint/);
      
      // Cleanup
      await pool.query('DELETE FROM users WHERE email = $1', [email]);
    });

    test('should enforce organization slug uniqueness', async () => {
      const slug = `test-org-${Date.now()}`;
      
      // Create first organization
      await pool.query('INSERT INTO organizations (slug, name) VALUES ($1, $2)', [slug, 'Test Org']);
      
      // Attempt to create duplicate
      await expect(
        pool.query('INSERT INTO organizations (slug, name) VALUES ($1, $2)', [slug, 'Another Org'])
      ).rejects.toThrow(/duplicate key value violates unique constraint/);
      
      // Cleanup
      await pool.query('DELETE FROM organizations WHERE slug = $1', [slug]);
    });

    test('should prevent circular organization hierarchy', async () => {
      const org1 = await createTestOrganization('circular-1', 'Circular 1');
      const org2 = await createTestOrganization('circular-2', 'Circular 2', org1.id);
      
      // Attempt to create circular reference
      await expect(
        pool.query('UPDATE organizations SET parent_org_id = $1 WHERE id = $2', [org2.id, org1.id])
      ).rejects.toThrow(/Circular reference detected/);
      
      // Cleanup
      await pool.query('DELETE FROM organizations WHERE id IN ($1, $2)', [org1.id, org2.id]);
    });

    test('should enforce membership constraints', async () => {
      const user = await createTestUser();
      const org = await createTestOrganization('constraint-test', 'Constraint Test');
      
      // Test invalid role
      await expect(
        pool.query('INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)', 
          [org.id, user.id, 'invalid_role'])
      ).rejects.toThrow(/invalid input value for enum membership_role/);
      
      // Test self-invitation
      await expect(
        pool.query('INSERT INTO memberships (org_id, user_id, invited_by) VALUES ($1, $2, $2)', 
          [org.id, user.id])
      ).rejects.toThrow(/self_invite_check/);
      
      // Cleanup
      await pool.query('DELETE FROM organizations WHERE id = $1', [org.id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    });

    test('should enforce session constraints', async () => {
      const user = await createTestUser();
      
      // Test expires_at constraint
      await expect(
        pool.query(`
          INSERT INTO sessions (user_id, created_at, expires_at) 
          VALUES ($1, $2, $3)
        `, [user.id, new Date(), new Date(Date.now() - 1000)]) // expires_at in the past
      ).rejects.toThrow(/expires_after_created/);
      
      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    });
  });

  describe('Privilege Escalation Prevention', () => {
    let normalUser, adminUser, ownerUser, org;

    beforeAll(async () => {
      [normalUser, adminUser, ownerUser] = await createTestUsers(3);
      [org] = await createTestOrganizations(1);
      
      await createMembership(org.id, normalUser.id, 'member');
      await createMembership(org.id, adminUser.id, 'admin');
      await createMembership(org.id, ownerUser.id, 'owner');
    });

    test('should prevent normal users from modifying organization settings', async () => {
      await pool.setRLSContext(normalUser.id);
      
      await expect(
        pool.query('UPDATE organizations SET name = $1 WHERE id = $2', ['Hacked Org', org.id])
      ).rejects.toThrow();
    });

    test('should prevent members from inviting other users', async () => {
      const newUser = await createTestUser();
      await pool.setRLSContext(normalUser.id);
      
      await expect(
        pool.query(`
          INSERT INTO memberships (org_id, user_id, role, invited_by) 
          VALUES ($1, $2, $3, $4)
        `, [org.id, newUser.id, 'member', normalUser.id])
      ).rejects.toThrow();
      
      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [newUser.id]);
    });

    test('should prevent users from modifying other users sessions', async () => {
      const session = await createTestSession(adminUser.id, org.id);
      await pool.setRLSContext(normalUser.id);
      
      // Normal user should not be able to revoke admin's session
      const result = await pool.query('UPDATE sessions SET revoked_at = now() WHERE jti = $1', [session.jti]);
      expect(result.rowCount).toBe(0);
      
      // Cleanup
      await pool.query('DELETE FROM sessions WHERE jti = $1', [session.jti]);
    });

    test('should prevent non-admins from viewing audit logs', async () => {
      await createTestAuditLog(org.id, adminUser.id, 'sensitive.action');
      await pool.setRLSContext(normalUser.id);
      
      const result = await pool.query('SELECT * FROM audit_logs WHERE org_id = $1', [org.id]);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Performance and Resource Protection', () => {
    test('should prevent resource exhaustion via large queries', async () => {
      // Test query timeout
      await expect(
        pool.query('SELECT pg_sleep(35)') // Longer than statement_timeout
      ).rejects.toThrow(/canceling statement due to statement timeout/);
    });

    test('should handle connection pool exhaustion gracefully', async () => {
      const maxConnections = pool.pool.options.max;
      const connections = [];
      
      try {
        // Exhaust connection pool
        for (let i = 0; i < maxConnections + 1; i++) {
          connections.push(pool.getClient());
        }
        
        // This should timeout gracefully
        const startTime = Date.now();
        await expect(
          Promise.race([
            pool.query('SELECT 1'),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 5000)
            )
          ])
        ).rejects.toThrow(/Timeout/);
        
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(10000); // Should fail fast
        
      } finally {
        // Release all connections
        for (const connection of connections) {
          try {
            const client = await connection;
            client.release();
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
      }
    });
  });

  // Helper functions
  async function createTestUser(email = null) {
    const userEmail = email || `test-${crypto.randomUUID()}@example.com`;
    const result = await pool.query(
      'INSERT INTO users (email, status, email_verified) VALUES ($1, $2, $3) RETURNING *',
      [userEmail, 'active', true]
    );
    
    const user = result.rows[0];
    testUsers.push(user);
    return user;
  }

  async function createTestUsers(count) {
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push(await createTestUser());
    }
    return users;
  }

  async function createTestOrganization(slug = null, name = null, parentId = null) {
    const orgSlug = slug || `test-org-${crypto.randomUUID().substring(0, 8)}`;
    const orgName = name || `Test Organization ${orgSlug}`;
    
    const result = await pool.query(
      'INSERT INTO organizations (slug, name, parent_org_id) VALUES ($1, $2, $3) RETURNING *',
      [orgSlug, orgName, parentId]
    );
    
    const org = result.rows[0];
    testOrgs.push(org);
    return org;
  }

  async function createTestOrganizations(count) {
    const orgs = [];
    for (let i = 0; i < count; i++) {
      orgs.push(await createTestOrganization());
    }
    return orgs;
  }

  async function createMembership(orgId, userId, role = 'member') {
    await pool.query(`
      INSERT INTO memberships (org_id, user_id, role, joined_at) 
      VALUES ($1, $2, $3, now())
    `, [orgId, userId, role]);
  }

  async function createTestSession(userId, orgId = null) {
    const result = await pool.query(`
      INSERT INTO sessions (user_id, org_id, expires_at, device_info) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `, [
      userId, 
      orgId, 
      new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      JSON.stringify({ test: true })
    ]);
    
    return result.rows[0];
  }

  async function createTestAuditLog(orgId, actorUserId, action) {
    await pool.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, details) 
      VALUES ($1, $2, $3, $4)
    `, [orgId, actorUserId, action, JSON.stringify({ test: true })]);
  }

  async function cleanupTestData() {
    try {
      // Delete in dependency order
      await pool.query('DELETE FROM audit_logs WHERE details @> $1', [JSON.stringify({ test: true })]);
      await pool.query('DELETE FROM sessions WHERE device_info @> $1', [JSON.stringify({ test: true })]);
      await pool.query('DELETE FROM memberships WHERE org_id = ANY($1)', [testOrgs.map(o => o.id)]);
      await pool.query('DELETE FROM organizations WHERE id = ANY($1)', [testOrgs.map(o => o.id)]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [testUsers.map(u => u.id)]);
    } catch (error) {
      console.error('Error during test cleanup:', error.message);
    }
  }
});

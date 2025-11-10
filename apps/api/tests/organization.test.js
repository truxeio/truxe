/**
 * Organization Management Test Suite
 * 
 * Comprehensive tests for organization CRUD operations, member management,
 * role-based access control, and hierarchical organization support.
 */

import { test, describe, beforeEach, afterEach, expect } from '@jest/globals'
import { build } from '../src/app.js'
import { Pool } from 'pg'
import config from '../src/config/index.js'

// Test database connection
const testDb = new Pool({
  connectionString: config.database.testUrl || config.database.url,
  ssl: false,
})

describe('Organization Management', () => {
  let app
  let testUser1, testUser2, testUser3
  let authToken1, authToken2, authToken3

  beforeEach(async () => {
    // Build Fastify app
    app = await build({ logger: false })
    await app.ready()

    // Clean up test data
    await cleanupTestData()

    // Create test users
    const users = await createTestUsers()
    testUser1 = users.user1
    testUser2 = users.user2
    testUser3 = users.user3
    authToken1 = users.token1
    authToken2 = users.token2
    authToken3 = users.token3
  })

  afterEach(async () => {
    await cleanupTestData()
    await app.close()
  })

  describe('Organization CRUD Operations', () => {
    test('should create a new organization', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          name: 'Test Organization',
          slug: 'test-org',
          settings: {
            branding: {
              primaryColor: '#007bff',
            },
          },
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.organization.name).toBe('Test Organization')
      expect(body.organization.slug).toBe('test-org')
      expect(body.organization.settings.branding.primaryColor).toBe('#007bff')
    })

    test('should prevent duplicate organization slugs', async () => {
      // Create first organization
      await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          name: 'First Org',
          slug: 'duplicate-slug',
        },
      })

      // Try to create second organization with same slug
      const response = await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: {
          authorization: `Bearer ${authToken2}`,
        },
        payload: {
          name: 'Second Org',
          slug: 'duplicate-slug',
        },
      })

      expect(response.statusCode).toBe(409)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Conflict')
      expect(body.message).toContain('slug already exists')
    })

    test('should list user organizations', async () => {
      // Create multiple organizations
      const org1 = await createTestOrganization(authToken1, 'Org 1', 'org-1')
      const org2 = await createTestOrganization(authToken1, 'Org 2', 'org-2')

      const response = await app.inject({
        method: 'GET',
        url: '/organizations',
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.organizations).toHaveLength(2)
      expect(body.organizations.map(o => o.name)).toContain('Org 1')
      expect(body.organizations.map(o => o.name)).toContain('Org 2')
    })

    test('should get organization details', async () => {
      const org = await createTestOrganization(authToken1, 'Detail Org', 'detail-org')

      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${org.id}`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.organization.name).toBe('Detail Org')
      expect(body.organization.role).toBe('owner')
    })

    test('should update organization', async () => {
      const org = await createTestOrganization(authToken1, 'Original Name', 'original-slug')

      const response = await app.inject({
        method: 'PUT',
        url: `/organizations/${org.id}`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          name: 'Updated Name',
          slug: 'updated-slug',
          settings: {
            features: {
              sso: true,
            },
          },
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.organization.name).toBe('Updated Name')
      expect(body.organization.slug).toBe('updated-slug')
      expect(body.organization.settings.features.sso).toBe(true)
    })

    test('should delete organization', async () => {
      const org = await createTestOrganization(authToken1, 'Delete Me', 'delete-me')

      const response = await app.inject({
        method: 'DELETE',
        url: `/organizations/${org.id}`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)

      // Verify organization is deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/organizations/${org.id}`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      })
      expect(getResponse.statusCode).toBe(404)
    })
  })

  describe('Member Management', () => {
    let testOrg

    beforeEach(async () => {
      testOrg = await createTestOrganization(authToken1, 'Member Test Org', 'member-test')
    })

    test('should invite member to organization', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${testOrg.id}/invite`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          email: testUser2.email,
          role: 'admin',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.membership.role).toBe('admin')
    })

    test('should prevent duplicate member invitations', async () => {
      // First invitation
      await app.inject({
        method: 'POST',
        url: `/organizations/${testOrg.id}/invite`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          email: testUser2.email,
          role: 'member',
        },
      })

      // Second invitation (should fail)
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${testOrg.id}/invite`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          email: testUser2.email,
          role: 'admin',
        },
      })

      expect(response.statusCode).toBe(409)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('already a member')
    })

    test('should update member role', async () => {
      // Invite member
      await inviteAndAcceptMember(testOrg.id, testUser2.id, 'member', authToken1)

      // Update role
      const response = await app.inject({
        method: 'PUT',
        url: `/organizations/${testOrg.id}/members/${testUser2.id}`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          role: 'admin',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.membership.role).toBe('admin')
    })

    test('should remove member from organization', async () => {
      // Invite and accept member
      await inviteAndAcceptMember(testOrg.id, testUser2.id, 'member', authToken1)

      // Remove member
      const response = await app.inject({
        method: 'DELETE',
        url: `/organizations/${testOrg.id}/members/${testUser2.id}`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)

      // Verify member can't access organization
      const accessResponse = await app.inject({
        method: 'GET',
        url: `/organizations/${testOrg.id}`,
        headers: {
          authorization: `Bearer ${authToken2}`,
        },
      })
      expect(accessResponse.statusCode).toBe(404)
    })
  })

  describe('Role-Based Access Control', () => {
    let testOrg

    beforeEach(async () => {
      testOrg = await createTestOrganization(authToken1, 'RBAC Test Org', 'rbac-test')
      await inviteAndAcceptMember(testOrg.id, testUser2.id, 'member', authToken1)
      await inviteAndAcceptMember(testOrg.id, testUser3.id, 'viewer', authToken1)
    })

    test('should allow owner to perform all actions', async () => {
      // Owner should be able to update organization
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/organizations/${testOrg.id}`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          name: 'Updated by Owner',
        },
      })
      expect(updateResponse.statusCode).toBe(200)

      // Owner should be able to invite members
      const inviteResponse = await app.inject({
        method: 'POST',
        url: `/organizations/${testOrg.id}/invite`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          email: 'new-member@example.com',
          role: 'member',
        },
      })
      expect(inviteResponse.statusCode).toBe(200)
    })

    test('should restrict member actions', async () => {
      // Member should NOT be able to update organization
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/organizations/${testOrg.id}`,
        headers: {
          authorization: `Bearer ${authToken2}`,
        },
        payload: {
          name: 'Updated by Member',
        },
      })
      expect(updateResponse.statusCode).toBe(403)

      // Member should NOT be able to invite other members
      const inviteResponse = await app.inject({
        method: 'POST',
        url: `/organizations/${testOrg.id}/invite`,
        headers: {
          authorization: `Bearer ${authToken2}`,
        },
        payload: {
          email: 'another-member@example.com',
          role: 'member',
        },
      })
      expect(inviteResponse.statusCode).toBe(403)
    })

    test('should restrict viewer actions', async () => {
      // Viewer should be able to read organization
      const readResponse = await app.inject({
        method: 'GET',
        url: `/organizations/${testOrg.id}`,
        headers: {
          authorization: `Bearer ${authToken3}`,
        },
      })
      expect(readResponse.statusCode).toBe(200)

      // Viewer should NOT be able to update organization
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/organizations/${testOrg.id}`,
        headers: {
          authorization: `Bearer ${authToken3}`,
        },
        payload: {
          name: 'Updated by Viewer',
        },
      })
      expect(updateResponse.statusCode).toBe(403)
    })
  })

  describe('Hierarchical Organizations', () => {
    test('should create child organization', async () => {
      const parentOrg = await createTestOrganization(authToken1, 'Parent Org', 'parent-org')

      const response = await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          name: 'Child Org',
          slug: 'child-org',
          parentOrgId: parentOrg.id,
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.organization.parentOrgId).toBe(parentOrg.id)
    })

    test('should get organization hierarchy', async () => {
      const parentOrg = await createTestOrganization(authToken1, 'Parent Org', 'parent-org')
      const childOrg = await createTestOrganization(authToken1, 'Child Org', 'child-org', parentOrg.id)

      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${parentOrg.id}/hierarchy`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.organization.childOrgs).toHaveLength(1)
      expect(body.organization.childOrgs[0].name).toBe('Child Org')
    })

    test('should prevent circular hierarchy', async () => {
      const org1 = await createTestOrganization(authToken1, 'Org 1', 'org-1')
      const org2 = await createTestOrganization(authToken1, 'Org 2', 'org-2', org1.id)

      // Try to make org1 a child of org2 (circular reference)
      const response = await app.inject({
        method: 'PUT',
        url: `/organizations/${org1.id}`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          parentOrgId: org2.id,
        },
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('circular')
    })
  })

  describe('Organization Settings', () => {
    let testOrg

    beforeEach(async () => {
      testOrg = await createTestOrganization(authToken1, 'Settings Test Org', 'settings-test')
    })

    test('should update organization settings', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/organizations/${testOrg.id}/settings`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          settings: {
            branding: {
              logo: 'https://example.com/logo.png',
              primaryColor: '#ff0000',
            },
            features: {
              sso: true,
              auditLogs: true,
            },
            security: {
              requireMfa: true,
              sessionTimeout: 3600,
            },
          },
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.settings.branding.primaryColor).toBe('#ff0000')
      expect(body.settings.features.sso).toBe(true)
      expect(body.settings.security.requireMfa).toBe(true)
    })

    test('should restrict settings updates to authorized users', async () => {
      await inviteAndAcceptMember(testOrg.id, testUser2.id, 'member', authToken1)

      const response = await app.inject({
        method: 'PUT',
        url: `/organizations/${testOrg.id}/settings`,
        headers: {
          authorization: `Bearer ${authToken2}`,
        },
        payload: {
          settings: {
            features: {
              sso: false,
            },
          },
        },
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('Organization Context Switching', () => {
    let org1, org2

    beforeEach(async () => {
      org1 = await createTestOrganization(authToken1, 'Org 1', 'org-1')
      org2 = await createTestOrganization(authToken1, 'Org 2', 'org-2')
    })

    test('should switch organization context', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/switch-org',
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          orgId: org2.id,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.organization.id).toBe(org2.id)
      expect(body.tokens.accessToken).toBeDefined()
    })

    test('should prevent switching to unauthorized organization', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/switch-org',
        headers: {
          authorization: `Bearer ${authToken2}`,
        },
        payload: {
          orgId: org1.id,
        },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  // Helper functions
  async function cleanupTestData() {
    await testDb.query('DELETE FROM audit_logs WHERE actor_user_id IS NOT NULL')
    await testDb.query('DELETE FROM memberships WHERE org_id IS NOT NULL')
    await testDb.query('DELETE FROM organizations WHERE name LIKE \'%Test%\' OR name LIKE \'%Org%\'')
    await testDb.query('DELETE FROM sessions WHERE user_id IS NOT NULL')
    await testDb.query('DELETE FROM users WHERE email LIKE \'%test%\'')
  }

  async function createTestUsers() {
    const user1 = await createUser('test-user-1@example.com')
    const user2 = await createUser('test-user-2@example.com')
    const user3 = await createUser('test-user-3@example.com')

    const token1 = await createAuthToken(user1.id)
    const token2 = await createAuthToken(user2.id)
    const token3 = await createAuthToken(user3.id)

    return { user1, user2, user3, token1, token2, token3 }
  }

  async function createUser(email) {
    const result = await testDb.query(
      'INSERT INTO users (id, email, email_verified, status) VALUES (gen_random_uuid(), $1, true, \'active\') RETURNING *',
      [email]
    )
    return result.rows[0]
  }

  async function createAuthToken(userId) {
    // Create a mock JWT token for testing
    return `test-token-${userId}`
  }

  async function createTestOrganization(authToken, name, slug, parentOrgId = null) {
    const response = await app.inject({
      method: 'POST',
      url: '/organizations',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name,
        slug,
        parentOrgId,
      },
    })

    const body = JSON.parse(response.body)
    return body.organization
  }

  async function inviteAndAcceptMember(orgId, userId, role, inviterToken) {
    // Get user email
    const userResult = await testDb.query('SELECT email FROM users WHERE id = $1', [userId])
    const email = userResult.rows[0].email

    // Invite member
    await app.inject({
      method: 'POST',
      url: `/organizations/${orgId}/invite`,
      headers: {
        authorization: `Bearer ${inviterToken}`,
      },
      payload: {
        email,
        role,
      },
    })

    // Simulate accepting invitation by updating joined_at
    await testDb.query(
      'UPDATE memberships SET joined_at = now() WHERE org_id = $1 AND user_id = $2',
      [orgId, userId]
    )
  }
})

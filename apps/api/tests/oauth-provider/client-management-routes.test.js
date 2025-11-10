/**
 * OAuth Client Management Routes - Integration Tests
 * 
 * Tests for OAuth client CRUD operations and secret management:
 * - Client registration (POST /api/oauth/clients)
 * - List clients (GET /api/oauth/clients)
 * - Get client details (GET /api/oauth/clients/:id)
 * - Update client (PATCH /api/oauth/clients/:id)
 * - Delete client (DELETE /api/oauth/clients/:id)
 * - Regenerate secret (POST /api/oauth/clients/:id/regenerate-secret)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import fastify from 'fastify';
import testDatabaseHelper from '../helpers/test-database.js';
import clientRoutes from '../../src/routes/oauth-provider/clients.js';
import clientService from '../../src/services/oauth-provider/client-service.js';

describe('OAuth Client Management Routes - Integration Tests', () => {
  let app;
  let testUser;
  let testTenant;
  let authToken;

  beforeAll(async () => {
    await testDatabaseHelper.connect();

    // Create Fastify app with authentication mock
    app = fastify();

    // Mock authentication
    app.decorate('authenticate', async (request, reply) => {
      if (!request.headers.authorization) {
        reply.code(401).send({ error: 'unauthorized' });
        return;
      }
      request.user = {
        id: testUser.id,
        tenantId: testTenant.id,
      };
    });

    // Register routes
    app.register(clientRoutes, { prefix: '/api/oauth' });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await testDatabaseHelper.disconnect();
  });

  beforeEach(async () => {
    await testDatabaseHelper.truncate([
      'oauth_clients',
      'oauth_authorization_codes',
      'oauth_provider_tokens',
      'oauth_user_consents',
    ]);

    // Create test user and tenant
    testTenant = await testDatabaseHelper.createTenant({
      name: 'Test Organization',
      slug: 'test-org',
    });

    testUser = await testDatabaseHelper.createUser({
      email: 'oauth-client-test@example.com',
      email_verified: true,
      status: 'active',
    });

    authToken = 'Bearer test-token';
  });

  describe('POST /api/oauth/clients - Register Client', () => {
    it('should create a new OAuth client', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/oauth/clients',
        headers: { authorization: authToken },
        payload: {
          client_name: 'Test Application',
          redirect_uris: ['http://localhost:3000/callback'],
          allowed_scopes: ['openid', 'email', 'profile'],
          require_pkce: true,
          require_consent: true,
          trusted: false,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.client_id).toMatch(/^cl_/);
      expect(body.client_secret).toMatch(/^cs_/);
      expect(body.client_name).toBe('Test Application');
      expect(body.redirect_uris).toEqual(['http://localhost:3000/callback']);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/oauth/clients',
        payload: {
          client_name: 'Test Application',
          redirect_uris: ['http://localhost:3000/callback'],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/oauth/clients',
        headers: { authorization: authToken },
        payload: {
          // Missing client_name and redirect_uris
          allowed_scopes: ['openid'],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/oauth/clients - List Clients', () => {
    beforeEach(async () => {
      // Create test clients
      await clientService.registerClient({
        clientName: 'App 1',
        redirectUris: ['http://localhost:3001/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
      });

      await clientService.registerClient({
        clientName: 'App 2',
        redirectUris: ['http://localhost:3002/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
      });
    });

    it('should list all clients for tenant', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oauth/clients',
        headers: { authorization: authToken },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.clients).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oauth/clients?limit=1&offset=0',
        headers: { authorization: authToken },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.clients).toHaveLength(1);
      expect(body.total).toBe(2);
      expect(body.limit).toBe(1);
      expect(body.offset).toBe(0);
    });
  });

  describe('GET /api/oauth/clients/:id - Get Client Details', () => {
    let testClient;

    beforeEach(async () => {
      testClient = await clientService.registerClient({
        clientName: 'Details Test App',
        redirectUris: ['http://localhost:3000/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
        allowedScopes: ['openid', 'email'],
      });
    });

    it('should get client details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/oauth/clients/${testClient.client_id}`,
        headers: { authorization: authToken },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.client_id).toBe(testClient.client_id);
      expect(body.client_name).toBe('Details Test App');
      expect(body.client_secret).toBeUndefined(); // Secret should not be returned
    });

    it('should return 404 for non-existent client', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oauth/clients/cl_nonexistent',
        headers: { authorization: authToken },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/oauth/clients/:id - Update Client', () => {
    let testClient;

    beforeEach(async () => {
      testClient = await clientService.registerClient({
        clientName: 'Update Test App',
        redirectUris: ['http://localhost:3000/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
      });
    });

    it('should update client name', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/oauth/clients/${testClient.client_id}`,
        headers: { authorization: authToken },
        payload: {
          client_name: 'Updated App Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.client_name).toBe('Updated App Name');
    });

    it('should update redirect URIs', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/oauth/clients/${testClient.client_id}`,
        headers: { authorization: authToken },
        payload: {
          redirect_uris: [
            'http://localhost:3000/callback',
            'http://localhost:3000/auth/callback',
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.redirect_uris).toHaveLength(2);
    });
  });

  describe('DELETE /api/oauth/clients/:id - Delete Client', () => {
    let testClient;

    beforeEach(async () => {
      testClient = await clientService.registerClient({
        clientName: 'Delete Test App',
        redirectUris: ['http://localhost:3000/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
      });
    });

    it('should delete client', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/oauth/clients/${testClient.client_id}`,
        headers: { authorization: authToken },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify client is deleted
      const client = await clientService.getClientById(testClient.client_id);
      expect(client).toBeNull();
    });

    it('should return 404 for non-existent client', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/oauth/clients/cl_nonexistent',
        headers: { authorization: authToken },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/oauth/clients/:id/regenerate-secret - Regenerate Secret', () => {
    let testClient;
    let originalSecret;

    beforeEach(async () => {
      testClient = await clientService.registerClient({
        clientName: 'Secret Regeneration Test',
        redirectUris: ['http://localhost:3000/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
        allowedScopes: ['openid', 'email', 'profile'],
      });
      originalSecret = testClient.client_secret;
    });

    it('should regenerate client secret', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/oauth/clients/${testClient.client_id}/regenerate-secret`,
        headers: { authorization: authToken },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.client_secret).toBeDefined();
      expect(body.client_secret).toMatch(/^cs_/);
      expect(body.client_secret).not.toBe(originalSecret);
      expect(body.message).toContain('regenerated successfully');
      expect(body.warning).toContain('only time');
    });

    it('should invalidate old secret after regeneration', async () => {
      // Regenerate secret
      const response = await app.inject({
        method: 'POST',
        url: `/api/oauth/clients/${testClient.client_id}/regenerate-secret`,
        headers: { authorization: authToken },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const newSecret = body.client_secret;

      // Verify old secret no longer works
      const validWithOld = await clientService.verifyClientSecret(
        testClient.client_id,
        originalSecret
      );
      expect(validWithOld).toBe(false);

      // Verify new secret works
      const validWithNew = await clientService.verifyClientSecret(
        testClient.client_id,
        newSecret
      );
      expect(validWithNew).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/oauth/clients/${testClient.client_id}/regenerate-secret`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent client', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/oauth/clients/cl_nonexistent/regenerate-secret',
        headers: { authorization: authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should prevent unauthorized tenant access', async () => {
      // Create a client for a different tenant
      const otherTenant = await testDatabaseHelper.createTenant({
        name: 'Other Organization',
        slug: 'other-org',
      });

      const otherClient = await clientService.registerClient({
        clientName: 'Other Tenant App',
        redirectUris: ['http://localhost:3000/callback'],
        tenantId: otherTenant.id,
        createdBy: testUser.id,
      });

      // Try to regenerate secret (should fail - different tenant)
      const response = await app.inject({
        method: 'POST',
        url: `/api/oauth/clients/${otherClient.client_id}/regenerate-secret`,
        headers: { authorization: authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should generate unique secrets on each regeneration', async () => {
      // First regeneration
      const response1 = await app.inject({
        method: 'POST',
        url: `/api/oauth/clients/${testClient.client_id}/regenerate-secret`,
        headers: { authorization: authToken },
      });
      const secret1 = JSON.parse(response1.body).client_secret;

      // Second regeneration
      const response2 = await app.inject({
        method: 'POST',
        url: `/api/oauth/clients/${testClient.client_id}/regenerate-secret`,
        headers: { authorization: authToken },
      });
      const secret2 = JSON.parse(response2.body).client_secret;

      expect(secret1).not.toBe(secret2);
      expect(secret1).not.toBe(originalSecret);
      expect(secret2).not.toBe(originalSecret);
    });
  });
});

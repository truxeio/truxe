import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import clientService from '../../../src/services/oauth-provider/client-service.js';
import { getPool } from '../../../src/database/connection.js';
import bcrypt from 'bcrypt';

describe('OAuth Client Service', () => {

  let testUser;
  let testTenant;

  // Setup/Teardown
  beforeEach(async () => {
    const pool = getPool();
    
    // Clear tables
    await pool.query('DELETE FROM oauth_clients');
    await pool.query('DELETE FROM users WHERE email LIKE \'test-oauth-%\'');
    await pool.query('DELETE FROM tenants WHERE slug LIKE \'test-oauth-%\'');

    // Create test tenant
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const tenantResult = await pool.query(`
      INSERT INTO tenants (id, slug, name, tenant_type, path, level, created_at, updated_at)
      VALUES ($1, $2, $3, $4, ARRAY[$1]::uuid[], $5, NOW(), NOW())
      RETURNING id, slug, name
    `, [tenantId, 'test-oauth-tenant', 'Test OAuth Tenant', 'organization', 1]);
    testTenant = tenantResult.rows[0];

    // Create test user
    const userResult = await pool.query(`
      INSERT INTO users (email, created_at, updated_at)
      VALUES ($1, NOW(), NOW())
      RETURNING id, email
    `, ['test-oauth-user@example.com']);
    testUser = userResult.rows[0];
  });

  afterEach(async () => {
    // Cleanup
    const pool = getPool();
    await pool.query('DELETE FROM oauth_clients');
    await pool.query('DELETE FROM users WHERE email LIKE \'test-oauth-%\'');
    await pool.query('DELETE FROM tenants WHERE slug LIKE \'test-oauth-%\'');
  });

  // ============================================================================
  // CLIENT ID/SECRET GENERATION
  // ============================================================================

  describe('generateClientId', () => {
    it('should generate valid client ID with cl_ prefix', () => {
      const clientId = clientService.generateClientId();
      
      expect(clientId).toMatch(/^cl_[a-zA-Z0-9]{16}$/);
      expect(clientId.length).toBe(19); // 'cl_' + 16 chars
    });

    it('should generate unique client IDs', () => {
      const ids = new Set();
      
      for (let i = 0; i < 100; i++) {
        ids.add(clientService.generateClientId());
      }
      
      expect(ids.size).toBe(100); // All unique
    });
  });

  describe('generateClientSecret', () => {
    it('should generate valid client secret with cs_ prefix', () => {
      const clientSecret = clientService.generateClientSecret();
      
      expect(clientSecret).toMatch(/^cs_[a-zA-Z0-9]{32}$/);
      expect(clientSecret.length).toBe(35); // 'cs_' + 32 chars
    });

    it('should generate unique client secrets', () => {
      const secrets = new Set();
      
      for (let i = 0; i < 100; i++) {
        secrets.add(clientService.generateClientSecret());
      }
      
      expect(secrets.size).toBe(100); // All unique
    });
  });

  describe('hashClientSecret', () => {
    it('should hash client secret using bcrypt', async () => {
      const secret = 'cs_testsecrettestsecrettestsecr';
      const hash = await clientService.hashClientSecret(secret);
      
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/); // Bcrypt format
    });

    it('should produce different hashes for same secret', async () => {
      const secret = 'cs_testsecrettestsecrettestsecr';
      const hash1 = await clientService.hashClientSecret(secret);
      const hash2 = await clientService.hashClientSecret(secret);
      
      expect(hash1).not.toBe(hash2); // Different due to salt
      
      // But both should validate against the original
      const valid1 = await bcrypt.compare(secret, hash1);
      const valid2 = await bcrypt.compare(secret, hash2);
      
      expect(valid1).toBe(true);
      expect(valid2).toBe(true);
    });
  });

  // ============================================================================
  // CLIENT REGISTRATION
  // ============================================================================

  describe('registerClient', () => {
    it('should register a new OAuth client successfully', async () => {
      const result = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('client_id');
      expect(result).toHaveProperty('client_secret');
      expect(result.client_id).toMatch(/^cl_[a-zA-Z0-9]{16}$/);
      expect(result.client_secret).toMatch(/^cs_[a-zA-Z0-9]{32}$/);
      expect(result.client_name).toBe('Test Application');
      expect(result.redirect_uris).toEqual(['https://app.example.com/callback']);
      expect(result.status).toBe('active');
    });

    it('should hash client secret in database', async () => {
      const result = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      // Fetch from database directly
      const pool = getPool();
      const query = 'SELECT client_secret_hash FROM oauth_clients WHERE client_id = $1';
      const dbResult = await pool.query(query, [result.client_id]);

      const storedHash = dbResult.rows[0].client_secret_hash;
      
      expect(storedHash).toMatch(/^\$2[aby]\$\d{2}\$/); // Bcrypt format
      expect(storedHash).not.toBe(result.client_secret); // Not plain text
      
      // Verify the hash validates against the plain secret
      const isValid = await bcrypt.compare(result.client_secret, storedHash);
      expect(isValid).toBe(true);
    });

    it('should require clientName', async () => {
      await expect(
        clientService.registerClient({
          redirectUris: ['https://app.example.com/callback'],
          createdBy: testUser.id,
        })
      ).rejects.toThrow('Client name is required');
    });

    it('should require redirectUris', async () => {
      await expect(
        clientService.registerClient({
          clientName: 'Test Application',
          createdBy: testUser.id,
        })
      ).rejects.toThrow('Redirect URIs must be an array');
    });

    it('should require at least one redirect URI', async () => {
      await expect(
        clientService.registerClient({
          clientName: 'Test Application',
          redirectUris: [],
          createdBy: testUser.id,
        })
      ).rejects.toThrow('At least one redirect URI is required');
    });

    it('should validate redirect URIs are valid URLs', async () => {
      await expect(
        clientService.registerClient({
          clientName: 'Test Application',
          redirectUris: ['not-a-url'],
          createdBy: testUser.id,
        })
      ).rejects.toThrow('Invalid redirect URI');
    });

    it('should reject javascript: protocol in redirect URIs', async () => {
      await expect(
        clientService.registerClient({
          clientName: 'Test Application',
          redirectUris: ['javascript:alert(1)'],
          createdBy: testUser.id,
        })
      ).rejects.toThrow('JavaScript protocol is not allowed');
    });

    it('should set default scopes if not provided', async () => {
      const result = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      expect(result.allowed_scopes).toEqual(['openid', 'email', 'profile']);
    });

    it('should set default PKCE requirement to true', async () => {
      const result = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      expect(result.require_pkce).toBe(true);
    });

    it('should allow trusted clients (skip consent)', async () => {
      const result = await clientService.registerClient({
        clientName: 'Trusted Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
        trusted: true,
      });

      expect(result.trusted).toBe(true);
    });
  });

  // ============================================================================
  // CLIENT VALIDATION
  // ============================================================================

  describe('validateClientCredentials', () => {
    it('should validate correct credentials', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const validatedClient = await clientService.validateClientCredentials(
        client.client_id,
        client.client_secret
      );

      expect(validatedClient).not.toBeNull();
      expect(validatedClient.client_id).toBe(client.client_id);
      expect(validatedClient.client_name).toBe('Test Application');
      expect(validatedClient).not.toHaveProperty('client_secret_hash');
    });

    it('should reject incorrect client secret', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const validatedClient = await clientService.validateClientCredentials(
        client.client_id,
        'cs_wrongsecretwrongsecretwrongse'
      );

      expect(validatedClient).toBeNull();
    });

    it('should reject unknown client ID', async () => {
      const validatedClient = await clientService.validateClientCredentials(
        'cl_unknownunknown1',
        'cs_anysecretanysecretanysecretan'
      );

      expect(validatedClient).toBeNull();
    });

    it('should reject suspended clients', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      await clientService.suspendClient(client.client_id);

      const validatedClient = await clientService.validateClientCredentials(
        client.client_id,
        client.client_secret
      );

      expect(validatedClient).toBeNull();
    });

    it('should reject revoked clients', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      await clientService.revokeClient(client.client_id);

      const validatedClient = await clientService.validateClientCredentials(
        client.client_id,
        client.client_secret
      );

      expect(validatedClient).toBeNull();
    });

    it('should update last_used_at on successful validation', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      const beforeValidation = await clientService.getClientById(client.client_id);
      
      await clientService.validateClientCredentials(
        client.client_id,
        client.client_secret
      );

      const afterValidation = await clientService.getClientById(client.client_id);

      expect(afterValidation.last_used_at).not.toBeNull();
      if (beforeValidation.last_used_at) {
        expect(new Date(afterValidation.last_used_at).getTime())
          .toBeGreaterThan(new Date(beforeValidation.last_used_at).getTime());
      }
    });
  });

  describe('validateRedirectUri', () => {
    it('should accept whitelisted redirect URI', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const isValid = await clientService.validateRedirectUri(
        client.client_id,
        'https://app.example.com/callback'
      );

      expect(isValid).toBe(true);
    });

    it('should reject non-whitelisted redirect URI', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const isValid = await clientService.validateRedirectUri(
        client.client_id,
        'https://evil.example.com/callback'
      );

      expect(isValid).toBe(false);
    });

    it('should require exact match (case-sensitive)', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const isValid = await clientService.validateRedirectUri(
        client.client_id,
        'https://app.example.com/Callback' // Different case
      );

      expect(isValid).toBe(false);
    });

    it('should require exact match (no partial match)', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const isValid = await clientService.validateRedirectUri(
        client.client_id,
        'https://app.example.com/callback/extra'
      );

      expect(isValid).toBe(false);
    });
  });

  // ============================================================================
  // CLIENT RETRIEVAL
  // ============================================================================

  describe('getClientById', () => {
    it('should return client by ID', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const fetchedClient = await clientService.getClientById(client.client_id);

      expect(fetchedClient).not.toBeNull();
      expect(fetchedClient.client_id).toBe(client.client_id);
      expect(fetchedClient.client_name).toBe('Test Application');
    });

    it('should not include client_secret_hash in response', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const fetchedClient = await clientService.getClientById(client.client_id);

      expect(fetchedClient).not.toHaveProperty('client_secret_hash');
    });

    it('should return null for non-existent client', async () => {
      const fetchedClient = await clientService.getClientById('cl_nonexistentcli');

      expect(fetchedClient).toBeNull();
    });
  });

  describe('listClients', () => {
    it('should list clients for a tenant', async () => {
      const tenantId = testTenant.id;

      await clientService.registerClient({
        clientName: 'App 1',
        redirectUris: ['https://app1.example.com/callback'],
        tenantId,
        createdBy: testUser.id,
      });

      await clientService.registerClient({
        clientName: 'App 2',
        redirectUris: ['https://app2.example.com/callback'],
        tenantId,
        createdBy: testUser.id,
      });

      await clientService.registerClient({
        clientName: 'App 3',
        redirectUris: ['https://app3.example.com/callback'],
        tenantId,
        createdBy: testUser.id,
      });

      const clients = await clientService.listClients(tenantId);

      expect(clients).toHaveLength(3);
    });

    it('should not include clients from other tenants', async () => {
      const pool = getPool();
      
      // Create two separate tenants
      const tenantAId = '550e8400-e29b-41d4-a716-446655440001';
      const tenantBId = '550e8400-e29b-41d4-a716-446655440002';
      
      const tenantAResult = await pool.query(`
        INSERT INTO tenants (id, slug, name, tenant_type, path, level, created_at, updated_at)
        VALUES ($1, $2, $3, $4, ARRAY[$1]::uuid[], $5, NOW(), NOW())
        RETURNING id
      `, [tenantAId, 'test-oauth-tenant-a', 'Test OAuth Tenant A', 'organization', 1]);
      const tenantA = tenantAResult.rows[0].id;

      const tenantBResult = await pool.query(`
        INSERT INTO tenants (id, slug, name, tenant_type, path, level, created_at, updated_at)
        VALUES ($1, $2, $3, $4, ARRAY[$1]::uuid[], $5, NOW(), NOW())
        RETURNING id
      `, [tenantBId, 'test-oauth-tenant-b', 'Test OAuth Tenant B', 'organization', 1]);
      const tenantB = tenantBResult.rows[0].id;

      await clientService.registerClient({
        clientName: 'Tenant A App',
        redirectUris: ['https://app.example.com/callback'],
        tenantId: tenantA,
        createdBy: testUser.id,
      });

      await clientService.registerClient({
        clientName: 'Tenant B App',
        redirectUris: ['https://app.example.com/callback'],
        tenantId: tenantB,
        createdBy: testUser.id,
      });

      const clientsA = await clientService.listClients(tenantA);

      expect(clientsA).toHaveLength(1);
      expect(clientsA[0].client_name).toBe('Tenant A App');
    });

    it('should support pagination', async () => {
      const tenantId = testTenant.id;

      // Register 10 clients
      for (let i = 1; i <= 10; i++) {
        await clientService.registerClient({
          clientName: `App ${i}`,
          redirectUris: ['https://app.example.com/callback'],
          tenantId,
          createdBy: testUser.id,
        });
      }

      const firstPage = await clientService.listClients(tenantId, { limit: 5, offset: 0 });
      const secondPage = await clientService.listClients(tenantId, { limit: 5, offset: 5 });

      expect(firstPage).toHaveLength(5);
      expect(secondPage).toHaveLength(5);
      
      // Verify no overlap
      const firstPageIds = firstPage.map(c => c.client_id);
      const secondPageIds = secondPage.map(c => c.client_id);
      const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
      
      expect(overlap).toHaveLength(0);
    });

    it('should order by created_at DESC', async () => {
      const tenantId = testTenant.id;

      const client1 = await clientService.registerClient({
        clientName: 'First App',
        redirectUris: ['https://app.example.com/callback'],
        tenantId,
        createdBy: testUser.id,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const client2 = await clientService.registerClient({
        clientName: 'Second App',
        redirectUris: ['https://app.example.com/callback'],
        tenantId,
        createdBy: testUser.id,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const client3 = await clientService.registerClient({
        clientName: 'Third App',
        redirectUris: ['https://app.example.com/callback'],
        tenantId,
        createdBy: testUser.id,
      });

      const clients = await clientService.listClients(tenantId);

      expect(clients[0].client_id).toBe(client3.client_id); // Newest first
      expect(clients[1].client_id).toBe(client2.client_id);
      expect(clients[2].client_id).toBe(client1.client_id);
    });
  });

  // ============================================================================
  // CLIENT MANAGEMENT
  // ============================================================================

  describe('updateClient', () => {
    it('should update client name', async () => {
      const client = await clientService.registerClient({
        clientName: 'Original Name',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const updated = await clientService.updateClient(client.client_id, {
        clientName: 'Updated Name',
      });

      expect(updated.client_name).toBe('Updated Name');
    });

    it('should update redirect URIs', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const updated = await clientService.updateClient(client.client_id, {
        redirectUris: ['https://new.example.com/callback', 'https://app.example.com/oauth'],
      });

      expect(updated.redirect_uris).toHaveLength(2);
      expect(updated.redirect_uris).toContain('https://new.example.com/callback');
      expect(updated.redirect_uris).toContain('https://app.example.com/oauth');
    });

    it('should not allow empty redirect URIs', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      await expect(
        clientService.updateClient(client.client_id, {
          redirectUris: [],
        })
      ).rejects.toThrow('At least one redirect URI is required');
    });

    it('should throw error when no valid fields provided', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      await expect(
        clientService.updateClient(client.client_id, {})
      ).rejects.toThrow('No valid fields to update');
    });
  });

  describe('regenerateClientSecret', () => {
    it('should generate new client secret', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const originalSecret = client.client_secret;

      const regenerated = await clientService.regenerateClientSecret(client.client_id);

      expect(regenerated.client_id).toBe(client.client_id);
      expect(regenerated.client_secret).toMatch(/^cs_[a-zA-Z0-9]{32}$/);
      expect(regenerated.client_secret).not.toBe(originalSecret);
    });

    it('should invalidate old client secret', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const originalSecret = client.client_secret;

      await clientService.regenerateClientSecret(client.client_id);

      const validatedWithOld = await clientService.validateClientCredentials(
        client.client_id,
        originalSecret
      );

      expect(validatedWithOld).toBeNull();
    });

    it('should work with new client secret', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      const regenerated = await clientService.regenerateClientSecret(client.client_id);

      const validatedWithNew = await clientService.validateClientCredentials(
        client.client_id,
        regenerated.client_secret
      );

      expect(validatedWithNew).not.toBeNull();
      expect(validatedWithNew.client_id).toBe(client.client_id);
    });
  });

  describe('suspendClient', () => {
    it('should suspend active client', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      await clientService.suspendClient(client.client_id);

      const suspended = await clientService.getClientById(client.client_id);

      expect(suspended.status).toBe('suspended');
    });

    it('should reject suspended client credentials', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      await clientService.suspendClient(client.client_id);

      const validated = await clientService.validateClientCredentials(
        client.client_id,
        client.client_secret
      );

      expect(validated).toBeNull();
    });
  });

  describe('activateClient', () => {
    it('should activate suspended client', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      await clientService.suspendClient(client.client_id);
      await clientService.activateClient(client.client_id);

      const activated = await clientService.getClientById(client.client_id);

      expect(activated.status).toBe('active');
    });

    it('should allow suspended client to authenticate after activation', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      await clientService.suspendClient(client.client_id);
      await clientService.activateClient(client.client_id);

      const validated = await clientService.validateClientCredentials(
        client.client_id,
        client.client_secret
      );

      expect(validated).not.toBeNull();
      expect(validated.client_id).toBe(client.client_id);
    });
  });

  describe('revokeClient', () => {
    it('should permanently revoke client', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      await clientService.revokeClient(client.client_id);

      const revoked = await clientService.getClientById(client.client_id);

      expect(revoked.status).toBe('revoked');
    });
  });

  describe('deleteClient', () => {
    it('should hard delete client', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test Application',
        redirectUris: ['https://app.example.com/callback'],
        createdBy: testUser.id,
      });

      await clientService.deleteClient(client.client_id);

      const deleted = await clientService.getClientById(client.client_id);

      expect(deleted).toBeNull();
    });
  });

  // ============================================================================
  // FORMAT VALIDATION
  // ============================================================================

  describe('validateClientIdFormat', () => {
    it('should accept valid client ID', () => {
      const isValid = clientService.validateClientIdFormat('cl_a1b2c3d4e5f6g7h8');

      expect(isValid).toBe(true);
    });

    it('should reject invalid prefix', () => {
      const isValid = clientService.validateClientIdFormat('cs_a1b2c3d4e5f6g7h8');

      expect(isValid).toBe(false);
    });

    it('should reject wrong length', () => {
      const isValid = clientService.validateClientIdFormat('cl_short');

      expect(isValid).toBe(false);
    });

    it('should reject special characters', () => {
      const isValid = clientService.validateClientIdFormat('cl_a1b2c3d4e5f6g7!@');

      expect(isValid).toBe(false);
    });
  });

  describe('validateClientSecretFormat', () => {
    it('should accept valid client secret', () => {
      const isValid = clientService.validateClientSecretFormat('cs_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6');

      expect(isValid).toBe(true);
    });

    it('should reject invalid prefix', () => {
      const isValid = clientService.validateClientSecretFormat('cl_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6');

      expect(isValid).toBe(false);
    });

    it('should reject wrong length', () => {
      const isValid = clientService.validateClientSecretFormat('cs_short');

      expect(isValid).toBe(false);
    });

    it('should reject special characters', () => {
      const isValid = clientService.validateClientSecretFormat('cs_a1b2c3d4e5f6g7h8i9j0k1l2m3n4!@#$');

      expect(isValid).toBe(false);
    });
  });
});

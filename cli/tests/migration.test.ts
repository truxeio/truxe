/**
 * Migration Tools Tests
 */

import { MigrationValidator } from '../src/utils/migration-validator';
import { MigrationProgressTracker } from '../src/utils/migration-progress-tracker';

describe('Migration Validator', () => {
  let validator: MigrationValidator;

  beforeEach(() => {
    validator = new MigrationValidator('clerk');
  });

  describe('Clerk Data Validation', () => {
    test('should validate valid Clerk data', async () => {
      const validData = {
        users: [
          {
            id: 'user_123',
            email_addresses: [
              {
                id: 'email_123',
                email_address: 'test@example.com',
                verification: { status: 'verified', strategy: 'email_code' }
              }
            ],
            first_name: 'John',
            last_name: 'Doe',
            created_at: Date.now(),
            updated_at: Date.now(),
            banned: false,
            locked: false,
            public_metadata: {},
            private_metadata: {},
            unsafe_metadata: {}
          }
        ],
        organizations: [
          {
            id: 'org_123',
            name: 'Test Organization',
            slug: 'test-org',
            created_at: Date.now(),
            updated_at: Date.now(),
            public_metadata: {},
            private_metadata: {}
          }
        ],
        exportedAt: new Date().toISOString()
      };

      const result = await validator.validateClerkData(validData);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.totalUsers).toBe(1);
      expect(result.stats.totalOrganizations).toBe(1);
      expect(result.stats.validUsers).toBe(1);
      expect(result.stats.verifiedUsers).toBe(1);
    });

    test('should detect invalid email addresses', async () => {
      const invalidData = {
        users: [
          {
            id: 'user_123',
            email_addresses: [
              {
                id: 'email_123',
                email_address: 'invalid-email',
                verification: { status: 'verified', strategy: 'email_code' }
              }
            ],
            created_at: Date.now(),
            updated_at: Date.now(),
            banned: false,
            locked: false,
            public_metadata: {},
            private_metadata: {},
            unsafe_metadata: {}
          }
        ],
        exportedAt: new Date().toISOString()
      };

      const result = await validator.validateClerkData(invalidData);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toContain('email_address');
      expect(result.errors[0].message).toContain('Invalid email format');
    });

    test('should detect missing required fields', async () => {
      const invalidData = {
        users: [
          {
            id: 'user_123',
            email_addresses: [],
            created_at: Date.now(),
            updated_at: Date.now(),
            banned: false,
            locked: false,
            public_metadata: {},
            private_metadata: {},
            unsafe_metadata: {}
          }
        ],
        exportedAt: new Date().toISOString()
      };

      const result = await validator.validateClerkData(invalidData);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toContain('email_addresses');
      expect(result.errors[0].message).toContain('At least one email address is required');
    });

    test('should detect duplicate emails', async () => {
      const invalidData = {
        users: [
          {
            id: 'user_123',
            email_addresses: [
              {
                id: 'email_123',
                email_address: 'test@example.com',
                verification: { status: 'verified', strategy: 'email_code' }
              }
            ],
            created_at: Date.now(),
            updated_at: Date.now(),
            banned: false,
            locked: false,
            public_metadata: {},
            private_metadata: {},
            unsafe_metadata: {}
          },
          {
            id: 'user_456',
            email_addresses: [
              {
                id: 'email_456',
                email_address: 'test@example.com', // Duplicate email
                verification: { status: 'verified', strategy: 'email_code' }
              }
            ],
            created_at: Date.now(),
            updated_at: Date.now(),
            banned: false,
            locked: false,
            public_metadata: {},
            private_metadata: {},
            unsafe_metadata: {}
          }
        ],
        exportedAt: new Date().toISOString()
      };

      const result = await validator.validateClerkData(invalidData);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Duplicate email address');
    });

    test('should flag unverified emails as warnings', async () => {
      const dataWithWarnings = {
        users: [
          {
            id: 'user_123',
            email_addresses: [
              {
                id: 'email_123',
                email_address: 'test@example.com',
                verification: { status: 'unverified', strategy: 'email_code' }
              }
            ],
            created_at: Date.now(),
            updated_at: Date.now(),
            banned: false,
            locked: false,
            public_metadata: {},
            private_metadata: {},
            unsafe_metadata: {}
          }
        ],
        exportedAt: new Date().toISOString()
      };

      const result = await validator.validateClerkData(dataWithWarnings);
      
      expect(result.valid).toBe(true); // Still valid, just warnings
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('unverified email');
      expect(result.stats.unverifiedUsers).toBe(1);
    });
  });
});

describe('Auth0 Data Validation', () => {
  let validator: MigrationValidator;

  beforeEach(() => {
    validator = new MigrationValidator('auth0');
  });

  test('should validate valid Auth0 data', async () => {
    const validData = {
      users: [
        {
          user_id: 'auth0|123456',
          email: 'test@example.com',
          email_verified: true,
          name: 'John Doe',
          given_name: 'John',
          family_name: 'Doe',
          picture: 'https://example.com/avatar.jpg',
          identities: [
            {
              provider: 'auth0',
              user_id: '123456',
              connection: 'Username-Password-Authentication',
              isSocial: false
            }
          ],
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
          logins_count: 5,
          blocked: false,
          user_metadata: {},
          app_metadata: {}
        }
      ],
      organizations: [
        {
          id: 'org_123',
          name: 'test-org',
          display_name: 'Test Organization',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
          metadata: {}
        }
      ],
      exportedAt: new Date().toISOString(),
      domain: 'test.auth0.com'
    };

    const result = await validator.validateAuth0Data(validData);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.stats.totalUsers).toBe(1);
    expect(result.stats.totalOrganizations).toBe(1);
    expect(result.stats.validUsers).toBe(1);
    expect(result.stats.verifiedUsers).toBe(1);
  });

  test('should detect missing required fields', async () => {
    const invalidData = {
      users: [
        {
          user_id: 'auth0|123456',
          // email missing
          email_verified: true,
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
          logins_count: 5,
          blocked: false
        }
      ],
      exportedAt: new Date().toISOString(),
      domain: 'test.auth0.com'
    };

    const result = await validator.validateAuth0Data(invalidData);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toContain('email');
    expect(result.errors[0].message).toContain('Email is required');
  });
});

describe('Migration Progress Tracker', () => {
  let tracker: MigrationProgressTracker;

  beforeEach(() => {
    tracker = new MigrationProgressTracker();
  });

  test('should start tracking a migration', async () => {
    const migrationId = await tracker.startMigration('clerk', {
      dataPath: './test-data.json',
      batchSize: 100,
      dryRun: false,
      validateOnly: false
    });

    expect(migrationId).toMatch(/^clerk_\d+_[a-z0-9]+$/);

    const migration = await tracker.getMigration(migrationId);
    expect(migration).toBeTruthy();
    expect(migration!.source).toBe('clerk');
    expect(migration!.status).toBe('started');
    expect(migration!.options.batchSize).toBe(100);
  });

  test('should update migration status', async () => {
    const migrationId = await tracker.startMigration('auth0', {
      configPath: './auth0-config.json',
      batchSize: 50,
      dryRun: true,
      validateOnly: false
    });

    await tracker.updateMigration(migrationId, {
      status: 'completed',
      result: {
        usersMigrated: 100,
        organizationsCreated: 5,
        failedUsers: [],
        failedOrganizations: []
      }
    });

    const migration = await tracker.getMigration(migrationId);
    expect(migration!.status).toBe('completed');
    expect(migration!.result!.usersMigrated).toBe(100);
    expect(migration!.completedAt).toBeTruthy();
  });

  test('should track migration progress', async () => {
    const migrationId = await tracker.startMigration('clerk', {
      dataPath: './test-data.json',
      batchSize: 100,
      dryRun: false,
      validateOnly: false
    });

    await tracker.updateProgress(migrationId, {
      total: 1000,
      completed: 250,
      percentage: 25,
      currentItem: 'user@example.com'
    });

    const migration = await tracker.getMigration(migrationId);
    expect(migration!.progress).toBeTruthy();
    expect(migration!.progress!.total).toBe(1000);
    expect(migration!.progress!.completed).toBe(250);
    expect(migration!.progress!.percentage).toBe(25);
  });

  test('should get migration statistics', async () => {
    // Create a few test migrations
    const migration1 = await tracker.startMigration('clerk', {
      dataPath: './test1.json',
      batchSize: 100,
      dryRun: false,
      validateOnly: false
    });

    const migration2 = await tracker.startMigration('auth0', {
      configPath: './auth0.json',
      batchSize: 50,
      dryRun: false,
      validateOnly: false
    });

    await tracker.updateMigration(migration1, {
      status: 'completed',
      result: { usersMigrated: 100, organizationsCreated: 2 }
    });

    await tracker.updateMigration(migration2, {
      status: 'completed',
      result: { usersMigrated: 50, organizationsCreated: 1 }
    });

    const stats = await tracker.getMigrationStats();
    
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(stats.bySource.clerk).toBeGreaterThanOrEqual(1);
    expect(stats.bySource.auth0).toBeGreaterThanOrEqual(1);
    expect(stats.byStatus.completed).toBeGreaterThanOrEqual(2);
    expect(stats.totalUsersMigrated).toBeGreaterThanOrEqual(150);
    expect(stats.totalOrganizationsCreated).toBeGreaterThanOrEqual(3);
  });
});

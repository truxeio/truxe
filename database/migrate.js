#!/usr/bin/env node

/**
 * Truxe Database Migration Runner
 * 
 * Handles forward and rollback migrations with comprehensive error handling,
 * logging, and validation.
 * 
 * Usage:
 *   node migrate.js up [target_version]     # Apply migrations up to target
 *   node migrate.js down [target_version]   # Rollback to target version
 *   node migrate.js status                  # Show migration status
 *   node migrate.js validate                # Validate migration integrity
 *   node migrate.js create <description>    # Create new migration template
 * 
 * Environment Variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   NODE_ENV - Environment (development, production, test)
 *   MIGRATION_LOCK_TIMEOUT - Lock timeout in seconds (default: 300)
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

// Configuration
const CONFIG = {
  migrationsDir: path.join(__dirname, 'migrations'),
  lockTimeout: parseInt(process.env.MIGRATION_LOCK_TIMEOUT) || 300, // 5 minutes
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};

// Database connection pool with optimized settings
const createPool = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return new Pool({
    connectionString: databaseUrl,
    // Connection pool settings optimized for migrations
    min: 1,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    acquireTimeoutMillis: 30000,
    
    // Migration-specific settings
    application_name: 'truxe_migrations',
    
    // SSL configuration
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
};

// Logging utility
const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
  success: (msg, ...args) => console.log(`[SUCCESS] ${msg}`, ...args),
};

// Migration file utilities
class MigrationFile {
  constructor(version, description, filePath) {
    this.version = version;
    this.description = description;
    this.filePath = filePath;
    this.rollbackPath = filePath.replace('.sql', '_rollback.sql');
  }

  async getChecksum() {
    const content = await fs.readFile(this.filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async exists() {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  async rollbackExists() {
    try {
      await fs.access(this.rollbackPath);
      return true;
    } catch {
      return false;
    }
  }

  async getContent() {
    return await fs.readFile(this.filePath, 'utf8');
  }

  async getRollbackContent() {
    return await fs.readFile(this.rollbackPath, 'utf8');
  }
}

// Migration discovery and validation
class MigrationDiscovery {
  static async discoverMigrations() {
    try {
      const files = await fs.readdir(CONFIG.migrationsDir);
      const migrations = [];

      for (const file of files) {
        if (!file.endsWith('.sql') || file.includes('_rollback')) {
          continue;
        }

        const match = file.match(/^(\d{3})_(.+)\.sql$/);
        if (!match) {
          logger.warn(`Skipping invalid migration file: ${file}`);
          continue;
        }

        const [, version, description] = match;
        const filePath = path.join(CONFIG.migrationsDir, file);
        
        migrations.push(new MigrationFile(
          version,
          description.replace(/_/g, ' '),
          filePath
        ));
      }

      return migrations.sort((a, b) => a.version.localeCompare(b.version));
    } catch (error) {
      throw new Error(`Failed to discover migrations: ${error.message}`);
    }
  }

  static validateMigrationSequence(migrations) {
    const versions = migrations.map(m => parseInt(m.version));
    const expectedVersions = Array.from({ length: versions.length }, (_, i) => i);
    
    const missing = expectedVersions.filter(v => !versions.includes(v));
    if (missing.length > 0) {
      throw new Error(`Missing migration versions: ${missing.join(', ')}`);
    }

    const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate migration versions: ${duplicates.join(', ')}`);
    }
  }
}

// Database operations
class DatabaseOperations {
  constructor(pool) {
    this.pool = pool;
  }

  async withTransaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async acquireLock(client, lockId = 12345) {
    const result = await client.query(
      'SELECT pg_try_advisory_lock($1) as acquired',
      [lockId]
    );
    
    if (!result.rows[0].acquired) {
      throw new Error('Could not acquire migration lock. Another migration may be running.');
    }

    // Set lock timeout
    await client.query(`SET lock_timeout = '${CONFIG.lockTimeout}s'`);
    
    logger.info('Migration lock acquired');
  }

  async releaseLock(client, lockId = 12345) {
    await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
    logger.info('Migration lock released');
  }

  async initializeMigrationSystem(client) {
    // Check if migration system is initialized
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'schema_migrations'
      )
    `);

    if (!result.rows[0].exists) {
      logger.info('Initializing migration system...');
      const initScript = await fs.readFile(
        path.join(CONFIG.migrationsDir, '000_migration_system.sql'),
        'utf8'
      );
      await client.query(initScript);
      logger.success('Migration system initialized');
    }
  }

  async getAppliedMigrations(client) {
    const result = await client.query(`
      SELECT version, description, checksum, applied_at, execution_time_ms
      FROM schema_migrations
      ORDER BY version
    `);
    return result.rows;
  }

  async isMigrationApplied(client, version) {
    const result = await client.query(
      'SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)',
      [version]
    );
    return result.rows[0].exists;
  }

  async recordMigration(client, migration, executionTimeMs) {
    const checksum = await migration.getChecksum();
    await client.query(`
      INSERT INTO schema_migrations (version, description, checksum, execution_time_ms)
      VALUES ($1, $2, $3, $4)
    `, [migration.version, migration.description, checksum, executionTimeMs]);
  }

  async removeMigrationRecord(client, version) {
    await client.query(
      'DELETE FROM schema_migrations WHERE version = $1',
      [version]
    );
  }

  async logMigrationStart(client, version, operation) {
    const result = await client.query(`
      SELECT log_migration_start($1, $2) as log_id
    `, [version, operation]);
    return result.rows[0].log_id;
  }

  async logMigrationCompletion(client, logId, status, errorMessage = null) {
    await client.query(`
      SELECT log_migration_completion($1, $2, $3)
    `, [logId, status, errorMessage]);
  }

  async executeMigration(client, migration) {
    const content = await migration.getContent();
    const startTime = Date.now();

    try {
      // Log migration start
      const logId = await this.logMigrationStart(client, migration.version, 'up');

      // Execute migration
      await client.query(content);
      
      const executionTime = Date.now() - startTime;
      
      // Record successful migration
      await this.recordMigration(client, migration, executionTime);
      await this.logMigrationCompletion(client, logId, 'completed');
      
      logger.success(`Applied migration ${migration.version}: ${migration.description} (${executionTime}ms)`);
      
      return { success: true, executionTime };
    } catch (error) {
      const logId = await this.logMigrationStart(client, migration.version, 'up');
      await this.logMigrationCompletion(client, logId, 'failed', error.message);
      throw error;
    }
  }

  async executeRollback(client, migration) {
    if (!(await migration.rollbackExists())) {
      throw new Error(`No rollback file found for migration ${migration.version}`);
    }

    const content = await migration.getRollbackContent();
    const startTime = Date.now();

    try {
      // Log rollback start
      const logId = await this.logMigrationStart(client, migration.version, 'down');

      // Execute rollback
      await client.query(content);
      
      const executionTime = Date.now() - startTime;
      
      // Remove migration record
      await this.removeMigrationRecord(client, migration.version);
      await this.logMigrationCompletion(client, logId, 'completed');
      
      logger.success(`Rolled back migration ${migration.version}: ${migration.description} (${executionTime}ms)`);
      
      return { success: true, executionTime };
    } catch (error) {
      const logId = await this.logMigrationStart(client, migration.version, 'down');
      await this.logMigrationCompletion(client, logId, 'failed', error.message);
      throw error;
    }
  }

  async validateIntegrity(client) {
    const result = await client.query('SELECT * FROM validate_migration_integrity()');
    return result.rows;
  }
}

// Main migration runner
class MigrationRunner {
  constructor() {
    this.pool = createPool();
    this.db = new DatabaseOperations(this.pool);
  }

  async close() {
    await this.pool.end();
  }

  async up(targetVersion = null) {
    logger.info('Starting migration up...');
    
    const migrations = await MigrationDiscovery.discoverMigrations();
    MigrationDiscovery.validateMigrationSequence(migrations);

    await this.db.withTransaction(async (client) => {
      await this.db.acquireLock(client);
      
      try {
        await this.db.initializeMigrationSystem(client);
        const appliedMigrations = await this.db.getAppliedMigrations(client);
        const appliedVersions = new Set(appliedMigrations.map(m => m.version));

        let migrationsToApply = migrations.filter(m => !appliedVersions.has(m.version));
        
        if (targetVersion) {
          migrationsToApply = migrationsToApply.filter(m => m.version <= targetVersion);
        }

        if (migrationsToApply.length === 0) {
          logger.info('No migrations to apply');
          return;
        }

        logger.info(`Applying ${migrationsToApply.length} migrations...`);
        
        for (const migration of migrationsToApply) {
          await this.db.executeMigration(client, migration);
        }

        logger.success(`Successfully applied ${migrationsToApply.length} migrations`);
      } finally {
        await this.db.releaseLock(client);
      }
    });
  }

  async down(targetVersion = null) {
    logger.info('Starting migration rollback...');
    
    const migrations = await MigrationDiscovery.discoverMigrations();
    
    await this.db.withTransaction(async (client) => {
      await this.db.acquireLock(client);
      
      try {
        const appliedMigrations = await this.db.getAppliedMigrations(client);
        
        let migrationsToRollback = appliedMigrations
          .sort((a, b) => b.version.localeCompare(a.version)) // Reverse order
          .map(am => migrations.find(m => m.version === am.version))
          .filter(Boolean);

        if (targetVersion) {
          migrationsToRollback = migrationsToRollback.filter(m => m.version > targetVersion);
        }

        if (migrationsToRollback.length === 0) {
          logger.info('No migrations to rollback');
          return;
        }

        logger.info(`Rolling back ${migrationsToRollback.length} migrations...`);
        
        for (const migration of migrationsToRollback) {
          await this.db.executeRollback(client, migration);
        }

        logger.success(`Successfully rolled back ${migrationsToRollback.length} migrations`);
      } finally {
        await this.db.releaseLock(client);
      }
    });
  }

  async status() {
    const migrations = await MigrationDiscovery.discoverMigrations();
    
    await this.db.withTransaction(async (client) => {
      await this.db.initializeMigrationSystem(client);
      const appliedMigrations = await this.db.getAppliedMigrations(client);
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));

      console.log('\n=== Migration Status ===\n');
      console.log('Version | Status    | Description                    | Applied At');
      console.log('--------|-----------|--------------------------------|-------------------');

      for (const migration of migrations) {
        const applied = appliedVersions.has(migration.version);
        const appliedInfo = applied 
          ? appliedMigrations.find(m => m.version === migration.version)
          : null;
        
        const status = applied ? 'APPLIED  ' : 'PENDING  ';
        const appliedAt = appliedInfo 
          ? appliedInfo.applied_at.toISOString().substring(0, 16).replace('T', ' ')
          : '                  ';
        
        console.log(`${migration.version.padEnd(7)} | ${status} | ${migration.description.padEnd(30)} | ${appliedAt}`);
      }

      const pendingCount = migrations.length - appliedMigrations.length;
      console.log(`\nTotal: ${migrations.length} migrations, ${appliedMigrations.length} applied, ${pendingCount} pending\n`);
    });
  }

  async validate() {
    logger.info('Validating migration integrity...');
    
    await this.db.withTransaction(async (client) => {
      const issues = await this.db.validateIntegrity(client);
      
      if (issues.length === 0) {
        logger.success('Migration integrity validation passed');
      } else {
        logger.error('Migration integrity issues found:');
        for (const issue of issues) {
          logger.error(`  ${issue.version}: ${issue.issue}`);
        }
        process.exit(1);
      }
    });
  }

  async create(description) {
    if (!description) {
      throw new Error('Migration description is required');
    }

    const migrations = await MigrationDiscovery.discoverMigrations();
    const nextVersion = String(migrations.length).padStart(3, '0');
    const safeName = description.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    const filename = `${nextVersion}_${safeName}.sql`;
    const rollbackFilename = `${nextVersion}_${safeName}_rollback.sql`;
    
    const migrationPath = path.join(CONFIG.migrationsDir, filename);
    const rollbackPath = path.join(CONFIG.migrationsDir, rollbackFilename);

    const template = `-- Migration: ${filename}
-- Description: ${description}
-- Author: Wundam LLC
-- Date: ${new Date().toISOString().substring(0, 10)}

-- Add your migration SQL here

-- Migration metadata
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('${nextVersion}', '${description}', now())
ON CONFLICT (version) DO NOTHING;
`;

    const rollbackTemplate = `-- Rollback Migration: ${rollbackFilename}
-- Description: Rollback ${description}
-- Author: Wundam LLC
-- Date: ${new Date().toISOString().substring(0, 10)}

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '${nextVersion}';

-- Add your rollback SQL here (in reverse order of migration)

-- Log rollback completion
DO $$
BEGIN
  RAISE NOTICE 'Migration ${nextVersion} rollback completed successfully at %', now();
END $$;
`;

    await fs.writeFile(migrationPath, template);
    await fs.writeFile(rollbackPath, rollbackTemplate);

    logger.success(`Created migration files:`);
    logger.info(`  ${migrationPath}`);
    logger.info(`  ${rollbackPath}`);
  }
}

// CLI interface
async function main() {
  const [,, command, ...args] = process.argv;
  
  if (!command) {
    console.log(`
Truxe Database Migration Runner

Usage:
  node migrate.js up [target_version]     # Apply migrations up to target
  node migrate.js down [target_version]   # Rollback to target version
  node migrate.js status                  # Show migration status
  node migrate.js validate                # Validate migration integrity
  node migrate.js create <description>    # Create new migration template

Examples:
  node migrate.js up                      # Apply all pending migrations
  node migrate.js up 005                 # Apply migrations up to version 005
  node migrate.js down 003               # Rollback to version 003
  node migrate.js create "add user roles" # Create new migration
`);
    process.exit(1);
  }

  const runner = new MigrationRunner();
  
  try {
    switch (command) {
      case 'up':
        await runner.up(args[0]);
        break;
      case 'down':
        await runner.down(args[0]);
        break;
      case 'status':
        await runner.status();
        break;
      case 'validate':
        await runner.validate();
        break;
      case 'create':
        await runner.create(args.join(' '));
        break;
      default:
        logger.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = { MigrationRunner, DatabaseOperations, MigrationDiscovery };

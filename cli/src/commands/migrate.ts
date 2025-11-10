import { Command } from 'commander';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { Logger } from '../utils/logger';
import { ErrorHandler, TruxeError } from '../utils/error-handler';
import { ConfigManager } from '../utils/config';
import { MigrateOptions } from '../types';
import { Auth0Migrator } from '../utils/auth0-migrator';
import { ClerkMigrator } from '../utils/clerk-migrator';
import { MigrationValidator } from '../utils/migration-validator';
import { MigrationProgressTracker } from '../utils/migration-progress-tracker';

export function migrateCommand(program: Command): void {
  const migrate = program
    .command('migrate')
    .description('Run database migrations');

  // Main migrate command (defaults to up)
  migrate
    .argument('[action]', 'Migration action (up|down|status)', 'up')
    .option('--env <environment>', 'Environment (development|production|staging)', 'development')
    .option('--steps <number>', 'Number of migration steps', '1')
    .option('--create <name>', 'Create a new migration file')
    .option('--dry-run', 'Show what would be migrated without executing')
    .action(async (action: string, options: MigrateOptions & { dryRun?: boolean; create?: string }) => {
      const logger = new Logger();
      
      try {
        logger.header('🗄️  Truxe Database Migrations');
        logger.blank();
        
        // Validate project
        if (!ConfigManager.isTruxeProject()) {
          throw ErrorHandler.invalidProject();
        }
        
        // Handle create migration
        if (options.create) {
          await createMigration(options.create, options);
          return;
        }
        
        // Handle migration actions
        switch (action.toLowerCase()) {
          case 'up':
            await runMigrations('up', options);
            break;
          case 'down':
            await runMigrations('down', options);
            break;
          case 'status':
            await showMigrationStatus(options);
            break;
          default:
            throw new TruxeError(
              `Unknown migration action: ${action}`,
              'INVALID_MIGRATION_ACTION',
              ['Valid actions: up, down, status']
            );
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Database Migration');
      }
    });

  // Convenience subcommands
  migrate
    .command('up')
    .description('Apply pending migrations')
    .option('--env <environment>', 'Environment', 'development')
    .option('--dry-run', 'Show what would be migrated')
    .action(async (options) => {
      await runMigrations('up', options);
    });

  migrate
    .command('down')
    .description('Rollback migrations')
    .option('--env <environment>', 'Environment', 'development')
    .option('--steps <number>', 'Number of steps to rollback', '1')
    .option('--dry-run', 'Show what would be rolled back')
    .action(async (options) => {
      await runMigrations('down', options);
    });

  migrate
    .command('status')
    .description('Show migration status')
    .option('--env <environment>', 'Environment', 'development')
    .action(async (options) => {
      await showMigrationStatus(options);
    });

  migrate
    .command('create <name>')
    .description('Create a new migration file')
    .action(async (name: string) => {
      await createMigration(name, {});
    });

  // Auth0/Clerk Migration Commands
  migrate
    .command('from-auth0')
    .description('Migrate from Auth0 to Truxe')
    .option('--config <path>', 'Path to Auth0 export configuration file')
    .option('--data <path>', 'Path to Auth0 exported data file')
    .option('--dry-run', 'Preview migration without making changes')
    .option('--batch-size <number>', 'Number of users to migrate per batch', '100')
    .option('--validate-only', 'Only validate data without migrating')
    .action(async (options) => {
      await migrateFromAuth0(options);
    });

  migrate
    .command('from-clerk')
    .description('Migrate from Clerk to Truxe')
    .option('--data <path>', 'Path to Clerk exported data file')
    .option('--api-key <key>', 'Clerk API key for live data export')
    .option('--dry-run', 'Preview migration without making changes')
    .option('--batch-size <number>', 'Number of users to migrate per batch', '100')
    .option('--validate-only', 'Only validate data without migrating')
    .action(async (options) => {
      await migrateFromClerk(options);
    });

  migrate
    .command('validate')
    .description('Validate migration data and configuration')
    .option('--source <source>', 'Source system (auth0|clerk)', 'auth0')
    .option('--config <path>', 'Path to migration configuration file')
    .option('--data <path>', 'Path to exported data file')
    .action(async (options) => {
      await validateMigration(options);
    });

  migrate
    .command('status')
    .description('Show migration status and progress')
    .option('--migration-id <id>', 'Specific migration ID to check')
    .option('--all', 'Show all migration statuses')
    .action(async (options) => {
      await showMigrationStatus(options);
    });

  migrate
    .command('rollback')
    .description('Rollback a migration')
    .option('--migration-id <id>', 'Migration ID to rollback', true)
    .option('--confirm', 'Confirm rollback without prompting')
    .action(async (options) => {
      await rollbackMigration(options);
    });
}

async function runMigrations(direction: 'up' | 'down', options: MigrateOptions & { dryRun?: boolean }): Promise<void> {
  const logger = new Logger();
  
  // Load configuration
  const config = ConfigManager.loadConfig();
  
  // Find database migration runner
  const migrationRunner = await findMigrationRunner();
  
  if (!migrationRunner) {
    throw ErrorHandler.missingDependency(
      'Database migration system',
      'npm install @truxe/database'
    );
  }
  
  logger.info(`${direction === 'up' ? 'Applying' : 'Rolling back'} migrations...`);
  
  if (options.dryRun) {
    logger.warning('🔍 Dry run mode - no changes will be made');
  }
  
  logger.blank();
  
  try {
    const result = await executeMigrations(migrationRunner, direction, options, config);
    
    if (result.migrations.length === 0) {
      logger.info(`No migrations to ${direction === 'up' ? 'apply' : 'rollback'}`);
    } else {
      logger.success(`${direction === 'up' ? 'Applied' : 'Rolled back'} ${result.migrations.length} migration(s)`);
      
      result.migrations.forEach(migration => {
        logger.bullet(`${migration.name} ${direction === 'up' ? '✓' : '↺'}`);
      });
    }
    
  } catch (error) {
    throw ErrorHandler.databaseError(
      `Migration failed: ${(error as Error).message}`,
      [
        'Check your database connection',
        'Verify migration files are not corrupted',
        'Check database permissions',
        'Run `truxe status --check-db` to diagnose'
      ]
    );
  }
}

async function showMigrationStatus(_options: MigrateOptions): Promise<void> {
  const logger = new Logger();
  
  // Load configuration
  const config = ConfigManager.loadConfig();
  
  // Find migration runner
  const migrationRunner = await findMigrationRunner();
  
  if (!migrationRunner) {
    throw ErrorHandler.missingDependency(
      'Database migration system',
      'npm install @truxe/database'
    );
  }
  
  try {
    const status = await getMigrationStatus(migrationRunner, config);
    
    logger.subheader('📊 Migration Status:');
    logger.blank();
    
    if (status.migrations.length === 0) {
      logger.info('No migrations found');
      return;
    }
    
    // Show migration table
    const tableData = status.migrations.map(migration => ({
      key: migration.name,
      value: migration.appliedAt ? 
        `Applied ${new Date(migration.appliedAt).toLocaleDateString()}` : 
        'Pending',
      status: migration.appliedAt ? 'success' as const : 'warning' as const
    }));
    
    logger.table(tableData);
    logger.blank();
    
    const appliedCount = status.migrations.filter(m => m.appliedAt).length;
    const pendingCount = status.migrations.length - appliedCount;
    
    logger.info(`Applied: ${chalk.green(appliedCount)} | Pending: ${chalk.yellow(pendingCount)}`);
    
  } catch (error) {
    throw ErrorHandler.databaseError(
      `Failed to get migration status: ${(error as Error).message}`
    );
  }
}

async function createMigration(name: string, _options: MigrateOptions): Promise<void> {
  const logger = new Logger();
  
  // Validate migration name
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new TruxeError(
      'Invalid migration name',
      'INVALID_MIGRATION_NAME',
      [
        'Use only letters, numbers, hyphens, and underscores',
        'Example: add_user_preferences',
        'Example: create-organizations-table'
      ]
    );
  }
  
  // Find migration directory
  const migrationDir = findMigrationDirectory();
  
  if (!migrationDir) {
    throw new TruxeError(
      'Migration directory not found',
      'MIGRATION_DIR_NOT_FOUND',
      [
        'Make sure you\'re in a Truxe project directory',
        'Check if database migrations are set up',
        'Run `truxe init` to create a new project'
      ]
    );
  }
  
  // Generate migration files
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const migrationName = `${timestamp}_${name}`;
  
  const upFile = join(migrationDir, `${migrationName}.sql`);
  const downFile = join(migrationDir, `${migrationName}_rollback.sql`);
  
  const upContent = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP DEFAULT NOW()
-- );
`;

  const downContent = `-- Rollback: ${name}
-- Created: ${new Date().toISOString()}

-- Add your rollback SQL here
-- Example:
-- DROP TABLE IF EXISTS example;
`;
  
  try {
    const { writeFileSync } = require('fs');
    
    writeFileSync(upFile, upContent);
    writeFileSync(downFile, downContent);
    
    logger.success('Created migration files:');
    logger.bullet(chalk.cyan(upFile));
    logger.bullet(chalk.cyan(downFile));
    logger.blank();
    
    logger.info('💡 Next steps:');
    logger.bullet('Edit the migration files with your SQL');
    logger.bullet('Run `truxe migrate up` to apply the migration');
    
  } catch (error) {
    throw new TruxeError(
      `Failed to create migration files: ${(error as Error).message}`,
      'MIGRATION_CREATE_FAILED'
    );
  }
}

async function findMigrationRunner(): Promise<string | null> {
  const possiblePaths = [
    join(process.cwd(), 'node_modules', '@truxe', 'database', 'migrate.js'),
    join(process.cwd(), '..', 'database', 'migrate.js'), // Monorepo
    join(__dirname, '..', '..', '..', 'database', 'migrate.js') // CLI dev
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  return null;
}

function findMigrationDirectory(): string | null {
  const possibleDirs = [
    join(process.cwd(), 'migrations'),
    join(process.cwd(), 'database', 'migrations'),
    join(process.cwd(), 'db', 'migrations')
  ];
  
  for (const dir of possibleDirs) {
    if (existsSync(dir)) {
      return dir;
    }
  }
  
  return null;
}

async function executeMigrations(
  migrationRunner: string,
  direction: 'up' | 'down',
  options: MigrateOptions & { dryRun?: boolean },
  config: any
): Promise<{ migrations: Array<{ name: string; appliedAt?: string }> }> {
  return new Promise((resolve, reject) => {
    const args = [migrationRunner];
    
    if (direction === 'down') {
      args.push('--down');
      if (options.steps) {
        args.push('--steps', options.steps.toString());
      }
    }
    
    if (options.dryRun) {
      args.push('--dry-run');
    }
    
    const env = {
      ...process.env,
      NODE_ENV: options.env || 'development',
      DATABASE_URL: config.database?.url
    };
    
    const child = spawn('node', args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        // Parse migration results from stdout
        try {
          const result = JSON.parse(stdout.trim()) || { migrations: [] };
          resolve(result);
        } catch {
          resolve({ migrations: [] });
        }
      } else {
        reject(new Error(stderr || `Migration process exited with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function getMigrationStatus(migrationRunner: string, config: any): Promise<{ migrations: Array<{ name: string; appliedAt?: string }> }> {
  return new Promise((resolve, reject) => {
    const args = [migrationRunner, '--status'];
    
    const env = {
      ...process.env,
      DATABASE_URL: config.database?.url
    };
    
    const child = spawn('node', args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch {
          resolve({ migrations: [] });
        }
      } else {
        reject(new Error(stderr || `Status check failed with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

// ============================================================================
// AUTH0/CLERK MIGRATION FUNCTIONS
// ============================================================================

async function migrateFromAuth0(options: any): Promise<void> {
  const logger = new Logger();
  
  try {
    logger.header('🔄 Auth0 to Truxe Migration');
    logger.blank();
    
    // Validate project
    if (!ConfigManager.isTruxeProject()) {
      throw ErrorHandler.invalidProject();
    }
    
    const config = ConfigManager.loadConfig();
    const migrator = new Auth0Migrator(config);
    const validator = new MigrationValidator('auth0');
    const progressTracker = new MigrationProgressTracker();
    
    // Start migration process
    const migrationId = await progressTracker.startMigration('auth0', {
      configPath: options.config,
      dataPath: options.data,
      batchSize: parseInt(options.batchSize || '100'),
      dryRun: options.dryRun || false,
      validateOnly: options.validateOnly || false,
    });
    
    logger.info(`Migration ID: ${chalk.cyan(migrationId)}`);
    logger.blank();
    
    // Load and validate data
    const spinner = ora('Loading Auth0 data...').start();
    
    let migrationData;
    if (options.data) {
      // Load from file
      if (!existsSync(options.data)) {
        spinner.fail();
        throw new TruxeError(
          `Data file not found: ${options.data}`,
          'DATA_FILE_NOT_FOUND',
          ['Check the file path', 'Ensure the file exists and is readable']
        );
      }
      migrationData = JSON.parse(readFileSync(options.data, 'utf-8'));
    } else if (options.config) {
      // Export from Auth0 API
      if (!existsSync(options.config)) {
        spinner.fail();
        throw new TruxeError(
          `Config file not found: ${options.config}`,
          'CONFIG_FILE_NOT_FOUND',
          ['Check the file path', 'Ensure the config file exists']
        );
      }
      const auth0Config = JSON.parse(readFileSync(options.config, 'utf-8'));
      migrationData = await migrator.exportFromAuth0(auth0Config);
      
      // Save exported data
      const exportPath = `./auth0-export-${Date.now()}.json`;
      writeFileSync(exportPath, JSON.stringify(migrationData, null, 2));
      logger.info(`Data exported to: ${chalk.cyan(exportPath)}`);
    } else {
      spinner.fail();
      throw new TruxeError(
        'Either --data or --config must be provided',
        'MISSING_DATA_SOURCE',
        ['Use --data to provide exported data file', 'Use --config to export from Auth0 API']
      );
    }
    
    spinner.succeed('Auth0 data loaded successfully');
    
    // Validate data
    const validationSpinner = ora('Validating migration data...').start();
    const validationResult = await validator.validateAuth0Data(migrationData);
    
    if (!validationResult.valid) {
      validationSpinner.fail();
      await progressTracker.updateMigration(migrationId, {
        status: 'failed',
        error: 'Data validation failed',
        validationErrors: validationResult.errors,
      });
      
      logger.error('❌ Data validation failed:');
      logger.blank();
      validationResult.errors.forEach(error => {
        logger.bullet(`${error.field}: ${error.message}`);
      });
      
      throw new TruxeError('Migration data validation failed', 'VALIDATION_FAILED');
    }
    
    validationSpinner.succeed(`Validation passed (${validationResult.stats.totalUsers} users, ${validationResult.stats.totalOrganizations} organizations)`);
    
    // Stop here if validate-only
    if (options.validateOnly) {
      await progressTracker.updateMigration(migrationId, {
        status: 'validated',
        validationStats: validationResult.stats,
      });
      
      logger.success('✅ Validation completed successfully');
      logger.blank();
      logger.table([
        { key: 'Users', value: validationResult.stats.totalUsers.toString(), status: 'info' },
        { key: 'Organizations', value: validationResult.stats.totalOrganizations.toString(), status: 'info' },
        { key: 'Connections', value: validationResult.stats.totalConnections.toString(), status: 'info' },
        { key: 'Rules', value: validationResult.stats.totalRules.toString(), status: 'warning' },
      ]);
      return;
    }
    
    // Perform migration
    const migrationSpinner = ora('Starting migration...').start();
    
    if (options.dryRun) {
      migrationSpinner.text = 'Running dry-run migration...';
      const dryRunResult = await migrator.performDryRun(migrationData, {
        batchSize: parseInt(options.batchSize || '100'),
        onProgress: (progress) => {
          migrationSpinner.text = `Dry-run: ${progress.completed}/${progress.total} users processed`;
          progressTracker.updateProgress(migrationId, progress);
        },
      });
      
      migrationSpinner.succeed('Dry-run completed');
      
      logger.success('✅ Dry-run migration completed');
      logger.blank();
      logger.table([
        { key: 'Users to migrate', value: dryRunResult.usersToMigrate.toString(), status: 'info' },
        { key: 'Organizations to create', value: dryRunResult.organizationsToCreate.toString(), status: 'info' },
        { key: 'Potential issues', value: dryRunResult.issues.length.toString(), status: dryRunResult.issues.length > 0 ? 'warning' : 'success' },
      ]);
      
      if (dryRunResult.issues.length > 0) {
        logger.blank();
        logger.warning('⚠️  Potential issues found:');
        dryRunResult.issues.forEach(issue => {
          logger.bullet(`${issue.type}: ${issue.message}`);
        });
      }
      
      await progressTracker.updateMigration(migrationId, {
        status: 'dry_run_completed',
        dryRunResult,
      });
      
      return;
    }
    
    // Actual migration
    const migrationResult = await migrator.performMigration(migrationData, {
      batchSize: parseInt(options.batchSize || '100'),
      onProgress: (progress) => {
        migrationSpinner.text = `Migrating: ${progress.completed}/${progress.total} users processed`;
        progressTracker.updateProgress(migrationId, progress);
      },
    });
    
    migrationSpinner.succeed('Migration completed');
    
    await progressTracker.updateMigration(migrationId, {
      status: 'completed',
      result: migrationResult,
    });
    
    logger.success('✅ Auth0 migration completed successfully!');
    logger.blank();
    logger.table([
      { key: 'Users migrated', value: migrationResult.usersMigrated.toString(), status: 'success' },
      { key: 'Organizations created', value: migrationResult.organizationsCreated.toString(), status: 'success' },
      { key: 'Failed users', value: migrationResult.failedUsers.length.toString(), status: migrationResult.failedUsers.length > 0 ? 'warning' : 'success' },
    ]);
    
    if (migrationResult.failedUsers.length > 0) {
      logger.blank();
      logger.warning('⚠️  Some users failed to migrate:');
      migrationResult.failedUsers.slice(0, 5).forEach(failure => {
        logger.bullet(`${failure.email}: ${failure.error}`);
      });
      
      if (migrationResult.failedUsers.length > 5) {
        logger.bullet(`... and ${migrationResult.failedUsers.length - 5} more`);
      }
    }
    
    logger.blank();
    logger.info('💡 Next steps:');
    logger.bullet('Update your application code to use Truxe');
    logger.bullet('Test authentication flows');
    logger.bullet('Update webhook configurations');
    logger.bullet('Notify users of the migration');
    
  } catch (error) {
    ErrorHandler.handle(error as Error, 'Auth0 Migration');
  }
}

async function migrateFromClerk(options: any): Promise<void> {
  const logger = new Logger();
  
  try {
    logger.header('🔄 Clerk to Truxe Migration');
    logger.blank();
    
    // Validate project
    if (!ConfigManager.isTruxeProject()) {
      throw ErrorHandler.invalidProject();
    }
    
    const config = ConfigManager.loadConfig();
    const migrator = new ClerkMigrator(config);
    const validator = new MigrationValidator('clerk');
    const progressTracker = new MigrationProgressTracker();
    
    // Start migration process
    const migrationId = await progressTracker.startMigration('clerk', {
      dataPath: options.data,
      apiKey: options.apiKey,
      batchSize: parseInt(options.batchSize || '100'),
      dryRun: options.dryRun || false,
      validateOnly: options.validateOnly || false,
    });
    
    logger.info(`Migration ID: ${chalk.cyan(migrationId)}`);
    logger.blank();
    
    // Load and validate data
    const spinner = ora('Loading Clerk data...').start();
    
    let migrationData;
    if (options.data) {
      // Load from file
      if (!existsSync(options.data)) {
        spinner.fail();
        throw new TruxeError(
          `Data file not found: ${options.data}`,
          'DATA_FILE_NOT_FOUND',
          ['Check the file path', 'Ensure the file exists and is readable']
        );
      }
      migrationData = JSON.parse(readFileSync(options.data, 'utf-8'));
    } else if (options.apiKey) {
      // Export from Clerk API
      migrationData = await migrator.exportFromClerk(options.apiKey);
      
      // Save exported data
      const exportPath = `./clerk-export-${Date.now()}.json`;
      writeFileSync(exportPath, JSON.stringify(migrationData, null, 2));
      logger.info(`Data exported to: ${chalk.cyan(exportPath)}`);
    } else {
      spinner.fail();
      throw new TruxeError(
        'Either --data or --api-key must be provided',
        'MISSING_DATA_SOURCE',
        ['Use --data to provide exported data file', 'Use --api-key to export from Clerk API']
      );
    }
    
    spinner.succeed('Clerk data loaded successfully');
    
    // Validate data
    const validationSpinner = ora('Validating migration data...').start();
    const validationResult = await validator.validateClerkData(migrationData);
    
    if (!validationResult.valid) {
      validationSpinner.fail();
      await progressTracker.updateMigration(migrationId, {
        status: 'failed',
        error: 'Data validation failed',
        validationErrors: validationResult.errors,
      });
      
      logger.error('❌ Data validation failed:');
      logger.blank();
      validationResult.errors.forEach(error => {
        logger.bullet(`${error.field}: ${error.message}`);
      });
      
      throw new TruxeError('Migration data validation failed', 'VALIDATION_FAILED');
    }
    
    validationSpinner.succeed(`Validation passed (${validationResult.stats.totalUsers} users, ${validationResult.stats.totalOrganizations} organizations)`);
    
    // Stop here if validate-only
    if (options.validateOnly) {
      await progressTracker.updateMigration(migrationId, {
        status: 'validated',
        validationStats: validationResult.stats,
      });
      
      logger.success('✅ Validation completed successfully');
      logger.blank();
      logger.table([
        { key: 'Users', value: validationResult.stats.totalUsers.toString(), status: 'info' },
        { key: 'Organizations', value: validationResult.stats.totalOrganizations.toString(), status: 'info' },
        { key: 'Webhooks', value: validationResult.stats.totalWebhooks?.toString() || '0', status: 'info' },
      ]);
      return;
    }
    
    // Perform migration
    const migrationSpinner = ora('Starting migration...').start();
    
    if (options.dryRun) {
      migrationSpinner.text = 'Running dry-run migration...';
      const dryRunResult = await migrator.performDryRun(migrationData, {
        batchSize: parseInt(options.batchSize || '100'),
        onProgress: (progress) => {
          migrationSpinner.text = `Dry-run: ${progress.completed}/${progress.total} users processed`;
          progressTracker.updateProgress(migrationId, progress);
        },
      });
      
      migrationSpinner.succeed('Dry-run completed');
      
      logger.success('✅ Dry-run migration completed');
      logger.blank();
      logger.table([
        { key: 'Users to migrate', value: dryRunResult.usersToMigrate.toString(), status: 'info' },
        { key: 'Organizations to create', value: dryRunResult.organizationsToCreate.toString(), status: 'info' },
        { key: 'Potential issues', value: dryRunResult.issues.length.toString(), status: dryRunResult.issues.length > 0 ? 'warning' : 'success' },
      ]);
      
      if (dryRunResult.issues.length > 0) {
        logger.blank();
        logger.warning('⚠️  Potential issues found:');
        dryRunResult.issues.forEach(issue => {
          logger.bullet(`${issue.type}: ${issue.message}`);
        });
      }
      
      await progressTracker.updateMigration(migrationId, {
        status: 'dry_run_completed',
        dryRunResult,
      });
      
      return;
    }
    
    // Actual migration
    const migrationResult = await migrator.performMigration(migrationData, {
      batchSize: parseInt(options.batchSize || '100'),
      onProgress: (progress) => {
        migrationSpinner.text = `Migrating: ${progress.completed}/${progress.total} users processed`;
        progressTracker.updateProgress(migrationId, progress);
      },
    });
    
    migrationSpinner.succeed('Migration completed');
    
    await progressTracker.updateMigration(migrationId, {
      status: 'completed',
      result: migrationResult,
    });
    
    logger.success('✅ Clerk migration completed successfully!');
    logger.blank();
    logger.table([
      { key: 'Users migrated', value: migrationResult.usersMigrated.toString(), status: 'success' },
      { key: 'Organizations created', value: migrationResult.organizationsCreated.toString(), status: 'success' },
      { key: 'Failed users', value: migrationResult.failedUsers.length.toString(), status: migrationResult.failedUsers.length > 0 ? 'warning' : 'success' },
    ]);
    
    if (migrationResult.failedUsers.length > 0) {
      logger.blank();
      logger.warning('⚠️  Some users failed to migrate:');
      migrationResult.failedUsers.slice(0, 5).forEach(failure => {
        logger.bullet(`${failure.email}: ${failure.error}`);
      });
      
      if (migrationResult.failedUsers.length > 5) {
        logger.bullet(`... and ${migrationResult.failedUsers.length - 5} more`);
      }
    }
    
    logger.blank();
    logger.info('💡 Next steps:');
    logger.bullet('Update your application code to use Truxe');
    logger.bullet('Test authentication flows');
    logger.bullet('Update webhook configurations');
    logger.bullet('Notify users of the migration');
    
  } catch (error) {
    ErrorHandler.handle(error as Error, 'Clerk Migration');
  }
}

async function validateMigration(options: any): Promise<void> {
  const logger = new Logger();
  
  try {
    logger.header('🔍 Migration Data Validation');
    logger.blank();
    
    const validator = new MigrationValidator(options.source);
    
    // Load data
    if (!options.data) {
      throw new TruxeError(
        'Data file path is required for validation',
        'MISSING_DATA_PATH',
        ['Use --data to specify the path to your exported data file']
      );
    }
    
    if (!existsSync(options.data)) {
      throw new TruxeError(
        `Data file not found: ${options.data}`,
        'DATA_FILE_NOT_FOUND',
        ['Check the file path', 'Ensure the file exists and is readable']
      );
    }
    
    const spinner = ora('Loading migration data...').start();
    const migrationData = JSON.parse(readFileSync(options.data, 'utf-8'));
    spinner.succeed('Data loaded successfully');
    
    // Validate data
    const validationSpinner = ora('Validating migration data...').start();
    let validationResult;
    
    if (options.source === 'auth0') {
      validationResult = await validator.validateAuth0Data(migrationData);
    } else if (options.source === 'clerk') {
      validationResult = await validator.validateClerkData(migrationData);
    } else {
      validationSpinner.fail();
      throw new TruxeError(
        `Unsupported source system: ${options.source}`,
        'UNSUPPORTED_SOURCE',
        ['Supported sources: auth0, clerk']
      );
    }
    
    if (validationResult.valid) {
      validationSpinner.succeed('Validation completed successfully');
      
      logger.success('✅ Migration data is valid!');
      logger.blank();
      
      // Display statistics
      logger.subheader('📊 Data Statistics:');
      logger.blank();
      
      const stats = Object.entries(validationResult.stats).map(([key, value]) => ({
        key: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        value: value.toString(),
        status: 'info' as const,
      }));
      
      logger.table(stats);
      
    } else {
      validationSpinner.fail('Validation failed');
      
      logger.error('❌ Migration data validation failed');
      logger.blank();
      
      logger.subheader('🚨 Validation Errors:');
      logger.blank();
      
      validationResult.errors.forEach(error => {
        logger.bullet(`${chalk.red(error.field)}: ${error.message}`);
      });
      
      throw new TruxeError('Migration data validation failed', 'VALIDATION_FAILED');
    }
    
  } catch (error) {
    ErrorHandler.handle(error as Error, 'Migration Validation');
  }
}

async function showMigrationStatus(options: any): Promise<void> {
  const logger = new Logger();
  
  try {
    logger.header('📊 Migration Status');
    logger.blank();
    
    const progressTracker = new MigrationProgressTracker();
    
    if (options.migrationId) {
      // Show specific migration status
      const migration = await progressTracker.getMigration(options.migrationId);
      
      if (!migration) {
        throw new TruxeError(
          `Migration not found: ${options.migrationId}`,
          'MIGRATION_NOT_FOUND',
          ['Check the migration ID', 'Use --all to see all migrations']
        );
      }
      
      logger.subheader(`Migration: ${migration.id}`);
      logger.blank();
      
      logger.table([
        { key: 'Source', value: migration.source, status: 'info' },
        { key: 'Status', value: migration.status, status: migration.status === 'completed' ? 'success' : migration.status === 'failed' ? 'error' : 'warning' },
        { key: 'Started', value: new Date(migration.startedAt).toLocaleString(), status: 'info' },
        { key: 'Progress', value: migration.progress ? `${migration.progress.completed}/${migration.progress.total}` : 'N/A', status: 'info' },
      ]);
      
      if (migration.error) {
        logger.blank();
        logger.error(`Error: ${migration.error}`);
      }
      
      if (migration.result) {
        logger.blank();
        logger.subheader('Migration Results:');
        logger.table([
          { key: 'Users Migrated', value: migration.result.usersMigrated?.toString() || '0', status: 'success' },
          { key: 'Organizations Created', value: migration.result.organizationsCreated?.toString() || '0', status: 'success' },
          { key: 'Failed Users', value: migration.result.failedUsers?.length?.toString() || '0', status: 'warning' },
        ]);
      }
      
    } else {
      // Show all migrations
      const migrations = await progressTracker.getAllMigrations(options.all ? undefined : 10);
      
      if (migrations.length === 0) {
        logger.info('No migrations found');
        return;
      }
      
      logger.subheader(`Recent Migrations (${migrations.length})`);
      logger.blank();
      
      const tableData = migrations.map(migration => ({
        key: migration.id.substring(0, 8),
        value: `${migration.source} - ${migration.status} (${new Date(migration.startedAt).toLocaleDateString()})`,
        status: migration.status === 'completed' ? 'success' as const : 
                migration.status === 'failed' ? 'error' as const : 'warning' as const,
      }));
      
      logger.table(tableData);
      
      logger.blank();
      logger.info('💡 Use --migration-id to see detailed status for a specific migration');
    }
    
  } catch (error) {
    ErrorHandler.handle(error as Error, 'Migration Status');
  }
}

async function rollbackMigration(options: any): Promise<void> {
  const logger = new Logger();
  
  try {
    logger.header('🔄 Migration Rollback');
    logger.blank();
    
    if (!options.migrationId) {
      throw new TruxeError(
        'Migration ID is required for rollback',
        'MISSING_MIGRATION_ID',
        ['Use --migration-id to specify which migration to rollback']
      );
    }
    
    const progressTracker = new MigrationProgressTracker();
    const migration = await progressTracker.getMigration(options.migrationId);
    
    if (!migration) {
      throw new TruxeError(
        `Migration not found: ${options.migrationId}`,
        'MIGRATION_NOT_FOUND',
        ['Check the migration ID', 'Use `truxe migrate status --all` to see all migrations']
      );
    }
    
    if (migration.status !== 'completed') {
      throw new TruxeError(
        `Cannot rollback migration with status: ${migration.status}`,
        'INVALID_MIGRATION_STATUS',
        ['Only completed migrations can be rolled back']
      );
    }
    
    logger.warning(`⚠️  You are about to rollback migration: ${migration.id}`);
    logger.blank();
    logger.table([
      { key: 'Source', value: migration.source, status: 'info' },
      { key: 'Users Migrated', value: migration.result?.usersMigrated?.toString() || '0', status: 'warning' },
      { key: 'Organizations Created', value: migration.result?.organizationsCreated?.toString() || '0', status: 'warning' },
    ]);
    logger.blank();
    
    if (!options.confirm) {
      const { default: inquirer } = await import('inquirer');
      const { confirmRollback } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmRollback',
          message: 'Are you sure you want to rollback this migration? This action cannot be undone.',
          default: false,
        },
      ]);
      
      if (!confirmRollback) {
        logger.info('Rollback cancelled');
        return;
      }
    }
    
    // Perform rollback
    const config = ConfigManager.loadConfig();
    let migrator;
    
    if (migration.source === 'auth0') {
      migrator = new Auth0Migrator(config);
    } else if (migration.source === 'clerk') {
      migrator = new ClerkMigrator(config);
    } else {
      throw new TruxeError(
        `Unsupported migration source: ${migration.source}`,
        'UNSUPPORTED_MIGRATION_SOURCE'
      );
    }
    
    const spinner = ora('Rolling back migration...').start();
    
    try {
      const rollbackResult = await migrator.rollbackMigration(migration);
      
      spinner.succeed('Rollback completed');
      
      await progressTracker.updateMigration(migration.id, {
        status: 'rolled_back',
        rollbackResult,
        rolledBackAt: new Date(),
      });
      
      logger.success('✅ Migration rollback completed successfully!');
      logger.blank();
      logger.table([
        { key: 'Users Removed', value: rollbackResult.usersRemoved?.toString() || '0', status: 'success' },
        { key: 'Organizations Removed', value: rollbackResult.organizationsRemoved?.toString() || '0', status: 'success' },
        { key: 'Failed Removals', value: rollbackResult.failedRemovals?.length?.toString() || '0', status: 'warning' },
      ]);
      
      if (rollbackResult.failedRemovals?.length > 0) {
        logger.blank();
        logger.warning('⚠️  Some items failed to rollback:');
        rollbackResult.failedRemovals.slice(0, 5).forEach(failure => {
          logger.bullet(`${failure.type} ${failure.id}: ${failure.error}`);
        });
      }
      
    } catch (rollbackError) {
      spinner.fail('Rollback failed');
      
      await progressTracker.updateMigration(migration.id, {
        status: 'rollback_failed',
        rollbackError: (rollbackError as Error).message,
      });
      
      throw rollbackError;
    }
    
  } catch (error) {
    ErrorHandler.handle(error as Error, 'Migration Rollback');
  }
}

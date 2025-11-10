/**
 * Migration Progress Tracker
 * 
 * Tracks migration progress and status for rollback and monitoring
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Logger } from './logger';
import { HeimdallError } from './error-handler';

export interface MigrationRecord {
  id: string;
  source: 'auth0' | 'clerk';
  status: 'started' | 'validated' | 'dry_run_completed' | 'in_progress' | 'completed' | 'failed' | 'rolled_back' | 'rollback_failed';
  startedAt: string;
  completedAt?: string;
  rolledBackAt?: string;
  
  // Configuration
  options: {
    configPath?: string;
    dataPath?: string;
    apiKey?: string;
    batchSize: number;
    dryRun: boolean;
    validateOnly: boolean;
  };
  
  // Progress tracking
  progress?: {
    total: number;
    completed: number;
    percentage: number;
    currentItem?: string;
  };
  
  // Results
  validationStats?: any;
  dryRunResult?: any;
  result?: any;
  rollbackResult?: any;
  
  // Error handling
  error?: string;
  validationErrors?: any[];
  rollbackError?: string;
  
  // Metadata
  metadata?: {
    userAgent?: string;
    cliVersion?: string;
    nodeVersion?: string;
    platform?: string;
  };
}

export interface MigrationSummary {
  id: string;
  source: 'auth0' | 'clerk';
  status: string;
  startedAt: string;
  completedAt?: string;
  usersMigrated?: number;
  organizationsCreated?: number;
  hasErrors: boolean;
}

export class MigrationProgressTracker {
  private logger: Logger;
  private migrationsDir: string;
  private migrationsFile: string;

  constructor() {
    this.logger = new Logger();
    this.migrationsDir = join(process.cwd(), '.heimdall', 'migrations');
    this.migrationsFile = join(this.migrationsDir, 'migrations.json');
    
    // Ensure migrations directory exists
    this.ensureDirectoryExists();
  }

  /**
   * Start tracking a new migration
   */
  async startMigration(source: 'auth0' | 'clerk', options: any): Promise<string> {
    const migrationId = `${source}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const migration: MigrationRecord = {
      id: migrationId,
      source,
      status: 'started',
      startedAt: new Date().toISOString(),
      options: {
        configPath: options.configPath,
        dataPath: options.dataPath,
        apiKey: options.apiKey ? '***masked***' : undefined,
        batchSize: options.batchSize,
        dryRun: options.dryRun,
        validateOnly: options.validateOnly,
      },
      metadata: {
        cliVersion: this.getCLIVersion(),
        nodeVersion: process.version,
        platform: process.platform,
        userAgent: `Heimdall CLI/${this.getCLIVersion()}`,
      },
    };

    await this.saveMigration(migration);
    
    this.logger.info(`Started tracking migration: ${migrationId}`);
    return migrationId;
  }

  /**
   * Update migration record
   */
  async updateMigration(migrationId: string, updates: Partial<MigrationRecord>): Promise<void> {
    const migrations = await this.loadMigrations();
    const migration = migrations.find(m => m.id === migrationId);
    
    if (!migration) {
      throw new HeimdallError(
        `Migration not found: ${migrationId}`,
        'MIGRATION_NOT_FOUND'
      );
    }

    // Merge updates
    Object.assign(migration, updates);
    
    // Update timestamps based on status
    if (updates.status === 'completed') {
      migration.completedAt = new Date().toISOString();
    } else if (updates.status === 'rolled_back') {
      migration.rolledBackAt = new Date().toISOString();
    }

    await this.saveMigrations(migrations);
  }

  /**
   * Update migration progress
   */
  async updateProgress(migrationId: string, progress: MigrationRecord['progress']): Promise<void> {
    await this.updateMigration(migrationId, { progress });
  }

  /**
   * Get specific migration record
   */
  async getMigration(migrationId: string): Promise<MigrationRecord | null> {
    const migrations = await this.loadMigrations();
    return migrations.find(m => m.id === migrationId) || null;
  }

  /**
   * Get all migration records
   */
  async getAllMigrations(limit?: number): Promise<MigrationRecord[]> {
    const migrations = await this.loadMigrations();
    
    // Sort by start date (most recent first)
    migrations.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    
    if (limit) {
      return migrations.slice(0, limit);
    }
    
    return migrations;
  }

  /**
   * Get migration summaries
   */
  async getMigrationSummaries(limit?: number): Promise<MigrationSummary[]> {
    const migrations = await this.getAllMigrations(limit);
    
    return migrations.map(migration => ({
      id: migration.id,
      source: migration.source,
      status: migration.status,
      startedAt: migration.startedAt,
      completedAt: migration.completedAt,
      usersMigrated: migration.result?.usersMigrated,
      organizationsCreated: migration.result?.organizationsCreated,
      hasErrors: !!(migration.error || migration.rollbackError || 
                   (migration.result?.failedUsers?.length > 0) ||
                   (migration.result?.failedOrganizations?.length > 0)),
    }));
  }

  /**
   * Get migration statistics
   */
  async getMigrationStats(): Promise<{
    total: number;
    bySource: Record<string, number>;
    byStatus: Record<string, number>;
    totalUsersMigrated: number;
    totalOrganizationsCreated: number;
    totalFailures: number;
  }> {
    const migrations = await this.getAllMigrations();
    
    const stats = {
      total: migrations.length,
      bySource: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      totalUsersMigrated: 0,
      totalOrganizationsCreated: 0,
      totalFailures: 0,
    };

    for (const migration of migrations) {
      // Count by source
      stats.bySource[migration.source] = (stats.bySource[migration.source] || 0) + 1;
      
      // Count by status
      stats.byStatus[migration.status] = (stats.byStatus[migration.status] || 0) + 1;
      
      // Aggregate results
      if (migration.result) {
        stats.totalUsersMigrated += migration.result.usersMigrated || 0;
        stats.totalOrganizationsCreated += migration.result.organizationsCreated || 0;
        stats.totalFailures += (migration.result.failedUsers?.length || 0) + 
                              (migration.result.failedOrganizations?.length || 0);
      }
    }

    return stats;
  }

  /**
   * Clean up old migration records
   */
  async cleanupOldMigrations(daysToKeep: number = 30): Promise<number> {
    const migrations = await this.loadMigrations();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const migrationsToKeep = migrations.filter(migration => {
      const migrationDate = new Date(migration.startedAt);
      return migrationDate > cutoffDate || migration.status === 'in_progress';
    });

    const removedCount = migrations.length - migrationsToKeep.length;
    
    if (removedCount > 0) {
      await this.saveMigrations(migrationsToKeep);
      this.logger.info(`Cleaned up ${removedCount} old migration records`);
    }

    return removedCount;
  }

  /**
   * Export migration data for backup
   */
  async exportMigrations(outputPath?: string): Promise<string> {
    const migrations = await this.loadMigrations();
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      migrations,
    };

    const exportPath = outputPath || join(process.cwd(), `heimdall-migrations-export-${Date.now()}.json`);
    writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    
    this.logger.info(`Exported ${migrations.length} migration records to: ${exportPath}`);
    return exportPath;
  }

  /**
   * Import migration data from backup
   */
  async importMigrations(importPath: string, merge: boolean = true): Promise<number> {
    if (!existsSync(importPath)) {
      throw new HeimdallError(
        `Import file not found: ${importPath}`,
        'IMPORT_FILE_NOT_FOUND'
      );
    }

    const importData = JSON.parse(readFileSync(importPath, 'utf-8'));
    
    if (!importData.migrations || !Array.isArray(importData.migrations)) {
      throw new HeimdallError(
        'Invalid import file format',
        'INVALID_IMPORT_FORMAT'
      );
    }

    let existingMigrations: MigrationRecord[] = [];
    if (merge) {
      existingMigrations = await this.loadMigrations();
    }

    // Merge migrations, avoiding duplicates
    const existingIds = new Set(existingMigrations.map(m => m.id));
    const newMigrations = importData.migrations.filter((m: MigrationRecord) => !existingIds.has(m.id));
    
    const allMigrations = [...existingMigrations, ...newMigrations];
    await this.saveMigrations(allMigrations);
    
    this.logger.info(`Imported ${newMigrations.length} new migration records`);
    return newMigrations.length;
  }

  /**
   * Get migration by source and status
   */
  async getMigrationsBySourceAndStatus(
    source?: 'auth0' | 'clerk',
    status?: string
  ): Promise<MigrationRecord[]> {
    const migrations = await this.getAllMigrations();
    
    return migrations.filter(migration => {
      if (source && migration.source !== source) return false;
      if (status && migration.status !== status) return false;
      return true;
    });
  }

  /**
   * Check if there are any active migrations
   */
  async hasActiveMigrations(): Promise<boolean> {
    const activeMigrations = await this.getMigrationsBySourceAndStatus(undefined, 'in_progress');
    return activeMigrations.length > 0;
  }

  /**
   * Load migrations from file
   */
  private async loadMigrations(): Promise<MigrationRecord[]> {
    try {
      if (!existsSync(this.migrationsFile)) {
        return [];
      }

      const data = readFileSync(this.migrationsFile, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Handle both array format and object format
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.migrations && Array.isArray(parsed.migrations)) {
        return parsed.migrations;
      } else {
        return [];
      }
    } catch (error) {
      this.logger.warning(`Failed to load migrations file: ${error.message}`);
      return [];
    }
  }

  /**
   * Save migrations to file
   */
  private async saveMigrations(migrations: MigrationRecord[]): Promise<void> {
    try {
      const data = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        migrations,
      };

      writeFileSync(this.migrationsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new HeimdallError(
        `Failed to save migrations: ${error.message}`,
        'MIGRATION_SAVE_FAILED'
      );
    }
  }

  /**
   * Save single migration
   */
  private async saveMigration(migration: MigrationRecord): Promise<void> {
    const migrations = await this.loadMigrations();
    
    // Remove existing migration with same ID (if any)
    const filteredMigrations = migrations.filter(m => m.id !== migration.id);
    
    // Add new migration
    filteredMigrations.push(migration);
    
    await this.saveMigrations(filteredMigrations);
  }

  /**
   * Ensure migrations directory exists
   */
  private ensureDirectoryExists(): void {
    try {
      if (!existsSync(this.migrationsDir)) {
        mkdirSync(this.migrationsDir, { recursive: true });
      }
    } catch (error) {
      throw new HeimdallError(
        `Failed to create migrations directory: ${error.message}`,
        'MIGRATIONS_DIR_CREATE_FAILED'
      );
    }
  }

  /**
   * Get CLI version
   */
  private getCLIVersion(): string {
    try {
      const packagePath = join(__dirname, '..', '..', 'package.json');
      if (existsSync(packagePath)) {
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        return packageJson.version || '0.0.0';
      }
    } catch (error) {
      // Ignore error
    }
    return '0.0.0';
  }
}

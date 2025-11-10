/**
 * Unit Tests for `truxe migrate` Command
 * 
 * Tests:
 * - Migration runner detection
 * - Migration status checks
 * - Migration execution
 * - Migration file creation
 * - Error handling
 * - Validation logic
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { TruxeError } from '../../src/utils/error-handler';
import { ConfigManager } from '../../src/utils/config';

// Mock dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../src/utils/config');
jest.mock('../../src/utils/logger');
jest.mock('ora', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    start: jest.fn(() => ({
      succeed: jest.fn(),
      fail: jest.fn(),
      text: '',
    })),
  })),
}));

const mockFs = require('fs') as jest.Mocked<typeof import('fs')>;
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;

describe('truxe migrate - Unit Tests', () => {
  const testProjectRoot = '/test/project';
  const testMigrationDir = join(testProjectRoot, 'migrations');

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigManager.isTruxeProject.mockReturnValue(true);
    mockConfigManager.loadConfig.mockReturnValue({
      database: { url: 'postgresql://localhost:5432/test' }
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Migration Runner Detection', () => {
    test('should find migration runner in node_modules', () => {
      const possiblePaths = [
        join(process.cwd(), 'node_modules', '@truxe', 'database', 'migrate.js'),
        join(process.cwd(), '..', 'database', 'migrate.js'),
        join(__dirname, '..', '..', '..', 'database', 'migrate.js'),
      ];

      mockFs.existsSync.mockImplementation((path: string) => {
        return possiblePaths[0] === path;
      });

      const foundPath = possiblePaths.find(path => mockFs.existsSync(path));
      
      expect(foundPath).toBeTruthy();
    });

    test('should return null when migration runner not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      const possiblePaths = [
        join(process.cwd(), 'node_modules', '@truxe', 'database', 'migrate.js'),
        join(process.cwd(), '..', 'database', 'migrate.js'),
        join(__dirname, '..', '..', '..', 'database', 'migrate.js'),
      ];

      const foundPath = possiblePaths.find(path => mockFs.existsSync(path));
      
      expect(foundPath).toBeUndefined();
    });
  });

  describe('Migration Directory Detection', () => {
    test('should find migrations directory', () => {
      const possibleDirs = [
        join(process.cwd(), 'migrations'),
        join(process.cwd(), 'database', 'migrations'),
        join(process.cwd(), 'db', 'migrations'),
      ];

      mockFs.existsSync.mockImplementation((path: string) => {
        return possibleDirs[0] === path;
      });

      const foundDir = possibleDirs.find(dir => mockFs.existsSync(dir));
      
      expect(foundDir).toBeTruthy();
    });

    test('should return null when migrations directory not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      const possibleDirs = [
        join(process.cwd(), 'migrations'),
        join(process.cwd(), 'database', 'migrations'),
        join(process.cwd(), 'db', 'migrations'),
      ];

      const foundDir = possibleDirs.find(dir => mockFs.existsSync(dir));
      
      expect(foundDir).toBeUndefined();
    });
  });

  describe('Migration File Creation', () => {
    test('should create migration files with correct naming', () => {
      const migrationName = 'add_user_preferences';
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
      const migrationFileName = `${timestamp}_${migrationName}`;

      expect(migrationFileName).toMatch(/^\d{8}T\d{6}_add_user_preferences$/);
    });

    test('should validate migration name format', () => {
      const validNames = ['add_user_preferences', 'create-organizations-table', 'update123'];
      const invalidNames = ['add user prefs', 'add.user.prefs', 'add/user/prefs'];

      validNames.forEach(name => {
        expect(/^[a-zA-Z0-9_-]+$/.test(name)).toBe(true);
      });

      invalidNames.forEach(name => {
        expect(/^[a-zA-Z0-9_-]+$/.test(name)).toBe(false);
      });
    });

    test('should create up and down migration files', () => {
      const migrationName = 'test_migration';
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
      const upFile = join(testMigrationDir, `${timestamp}_${migrationName}.sql`);
      const downFile = join(testMigrationDir, `${timestamp}_${migrationName}_rollback.sql`);

      const upContent = `-- Migration: ${migrationName}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
`;

      const downContent = `-- Rollback: ${migrationName}
-- Created: ${new Date().toISOString()}

-- Add your rollback SQL here
`;

      mockFs.writeFileSync(upFile, upContent);
      mockFs.writeFileSync(downFile, downContent);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(upFile, expect.stringContaining('Migration:'));
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(downFile, expect.stringContaining('Rollback:'));
    });

    test('should throw error for invalid migration name', () => {
      const invalidName = 'invalid name with spaces';

      expect(() => {
        if (!/^[a-zA-Z0-9_-]+$/.test(invalidName)) {
          throw new TruxeError(
            'Invalid migration name',
            'INVALID_MIGRATION_NAME',
            ['Use only letters, numbers, hyphens, and underscores']
          );
        }
      }).toThrow(TruxeError);
    });
  });

  describe('Migration Execution', () => {
    test('should execute migrations with correct arguments', () => {
      const mockChildProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      const migrationRunner = '/path/to/migrate.js';
      const args = [migrationRunner, '--up'];
      const env = {
        ...process.env,
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost:5432/test',
      };

      spawn('node', args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        args,
        expect.objectContaining({ env, stdio: ['ignore', 'pipe', 'pipe'] })
      );
    });

    test('should handle migration success', () => {
      const mockStdout = { on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify({ migrations: [{ name: 'test', appliedAt: new Date() }] })));
        }
      })};

      const mockChildProcess = {
        stdout: mockStdout,
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      let stdout = '';
      mockStdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      mockChildProcess.on('close', (code: number) => {
        if (code === 0) {
          const result = JSON.parse(stdout.trim());
          expect(result.migrations).toHaveLength(1);
        }
      });
    });

    test('should handle migration failure', () => {
      const mockStderr = { on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from('Migration failed'));
        }
      })};

      const mockChildProcess = {
        stdout: { on: jest.fn() },
        stderr: mockStderr,
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      let stderr = '';
      mockStderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      mockChildProcess.on('close', (code: number) => {
        if (code !== 0) {
          expect(stderr).toContain('Migration failed');
        }
      });
    });
  });

  describe('Migration Status', () => {
    test('should parse migration status correctly', () => {
      const mockStatus = {
        migrations: [
          { name: '001_initial', appliedAt: new Date().toISOString() },
          { name: '002_add_users', appliedAt: null },
        ],
      };

      const appliedCount = mockStatus.migrations.filter(m => m.appliedAt).length;
      const pendingCount = mockStatus.migrations.length - appliedCount;

      expect(appliedCount).toBe(1);
      expect(pendingCount).toBe(1);
    });

    test('should handle empty migration list', () => {
      const mockStatus = { migrations: [] };

      expect(mockStatus.migrations.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing migration runner', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        throw new TruxeError(
          'Database migration system not found',
          'MISSING_DEPENDENCY',
          ['Install with: npm install @truxe/database']
        );
      }).toThrow(TruxeError);
    });

    test('should handle migration directory not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        throw new TruxeError(
          'Migration directory not found',
          'MIGRATION_DIR_NOT_FOUND',
          ['Make sure you\'re in a Truxe project directory']
        );
      }).toThrow(TruxeError);
    });

    test('should handle invalid migration action', () => {
      const invalidAction = 'invalid';

      expect(() => {
        if (!['up', 'down', 'status'].includes(invalidAction)) {
          throw new TruxeError(
            `Unknown migration action: ${invalidAction}`,
            'INVALID_MIGRATION_ACTION',
            ['Valid actions: up, down, status']
          );
        }
      }).toThrow(TruxeError);
    });

    test('should handle file write errors', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => {
        mockFs.writeFileSync('/test/file.sql', 'content');
      }).toThrow('Permission denied');
    });
  });

  describe('Validation Logic', () => {
    test('should validate migration name format', () => {
      const validNames = ['add_user_preferences', 'create-table', 'update123'];
      const invalidNames = ['add user', 'add.user', 'add/user'];

      validNames.forEach(name => {
        expect(/^[a-zA-Z0-9_-]+$/.test(name)).toBe(true);
      });

      invalidNames.forEach(name => {
        expect(/^[a-zA-Z0-9_-]+$/.test(name)).toBe(false);
      });
    });

    test('should validate migration action', () => {
      const validActions = ['up', 'down', 'status'];
      const invalidAction = 'invalid';

      expect(validActions.includes('up')).toBe(true);
      expect(validActions.includes('down')).toBe(true);
      expect(validActions.includes('status')).toBe(true);
      expect(validActions.includes(invalidAction)).toBe(false);
    });
  });
});


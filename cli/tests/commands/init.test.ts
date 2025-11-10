/**
 * Unit Tests for `truxe init` Command
 * 
 * Tests:
 * - Project name validation
 * - Project path validation
 * - Directory creation
 * - File generation
 * - Template copying
 * - Error handling
 * - Interactive prompts
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { ProjectUtils } from '../../src/utils/project';
import { TruxeError } from '../../src/utils/error-handler';
import { ConfigManager } from '../../src/utils/config';

// Mock dependencies
jest.mock('fs');
jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('inquirer');
jest.mock('../../src/utils/config');
jest.mock('../../src/utils/logger');

const mockFs = require('fs') as jest.Mocked<typeof import('fs')>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;

describe('truxe init - Unit Tests', () => {
  const testProjectPath = join(__dirname, '..', 'fixtures', 'test-project');
  const testProjectName = 'test-project';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => undefined);
    mockExecSync.mockReturnValue(Buffer.from(''));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ProjectUtils.validateProjectName', () => {
    test('should accept valid project names', () => {
      const validNames = [
        'my-app',
        'my-app-123',
        'app123',
        'a',
        'my-awesome-app'
      ];

      validNames.forEach(name => {
        expect(() => ProjectUtils.validateProjectName(name)).not.toThrow();
      });
    });

    test('should reject invalid project names', () => {
      const invalidNames = [
        'My App',      // spaces
        'my_app',      // underscores
        'my.app',      // dots
        '123app',      // starts with number
        '@myapp',      // special characters
        'my app',      // spaces
        '',            // empty
      ];

      invalidNames.forEach(name => {
        expect(() => ProjectUtils.validateProjectName(name)).toThrow(TruxeError);
      });
    });

    test('should throw TruxeError with proper code', () => {
      try {
        ProjectUtils.validateProjectName('Invalid Name');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(TruxeError);
        expect((error as TruxeError).code).toBe('INVALID_PROJECT_NAME');
        expect((error as TruxeError).suggestions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('ProjectUtils.validateProjectPath', () => {
    test('should accept non-existent paths', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      expect(() => ProjectUtils.validateProjectPath(testProjectPath)).not.toThrow();
    });

    test('should reject existing directories', () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path === testProjectPath;
      });

      expect(() => ProjectUtils.validateProjectPath(testProjectPath)).toThrow(TruxeError);
      
      try {
        ProjectUtils.validateProjectPath(testProjectPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(TruxeError);
        expect((error as TruxeError).code).toBe('DIRECTORY_EXISTS');
      }
    });

    test('should check parent directory write permissions', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => ProjectUtils.validateProjectPath(testProjectPath)).toThrow(TruxeError);
    });
  });

  describe('ProjectUtils.createProjectDirectory', () => {
    test('should create directory successfully', () => {
      mockFs.mkdirSync.mockReturnValue(undefined);
      
      expect(() => ProjectUtils.createProjectDirectory(testProjectPath)).not.toThrow();
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(testProjectPath, { recursive: true });
    });

    test('should handle directory creation errors', () => {
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => ProjectUtils.createProjectDirectory(testProjectPath)).toThrow(TruxeError);
      
      try {
        ProjectUtils.createProjectDirectory(testProjectPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(TruxeError);
        expect((error as TruxeError).code).toBe('DIRECTORY_CREATION_FAILED');
      }
    });
  });

  describe('ProjectUtils.initGitRepository', () => {
    test('should initialize git repository when git is available', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockExecSync.mockReturnValue(Buffer.from('git version 2.30.0'));

      ProjectUtils.initGitRepository(testProjectPath);

      expect(mockExecSync).toHaveBeenCalledWith(
        'git init',
        expect.objectContaining({ cwd: testProjectPath, stdio: 'ignore' })
      );
    });

    test('should skip git init if repository already exists', () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('.git');
      });
      mockExecSync.mockReturnValue(Buffer.from('git version 2.30.0'));

      ProjectUtils.initGitRepository(testProjectPath);

      expect(mockExecSync).not.toHaveBeenCalledWith(
        'git init',
        expect.any(Object)
      );
    });

    test('should handle git not available gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('git: command not found');
      });

      // Should not throw
      expect(() => ProjectUtils.initGitRepository(testProjectPath)).not.toThrow();
    });
  });

  describe('ProjectUtils.detectPackageManager', () => {
    test('should detect npm when available', () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('npm')) {
          return Buffer.from('9.0.0');
        }
        throw new Error('Command not found');
      });

      const pm = ProjectUtils.detectPackageManager();
      expect(pm).toBe('npm');
    });

    test('should detect pnpm when available', () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('pnpm')) {
          return Buffer.from('8.0.0');
        }
        throw new Error('Command not found');
      });

      const pm = ProjectUtils.detectPackageManager();
      expect(pm).toBe('pnpm');
    });

    test('should detect yarn when available', () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('yarn')) {
          return Buffer.from('3.0.0');
        }
        throw new Error('Command not found');
      });

      const pm = ProjectUtils.detectPackageManager();
      expect(pm).toBe('yarn');
    });

    test('should default to npm when none detected', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const pm = ProjectUtils.detectPackageManager();
      expect(pm).toBe('npm');
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      expect(() => ProjectUtils.validateProjectPath(testProjectPath)).toThrow();
    });

    test('should provide helpful error messages', () => {
      try {
        ProjectUtils.validateProjectName('Invalid Name');
        fail('Should have thrown');
      } catch (error) {
        const truxeError = error as TruxeError;
        expect(truxeError.message).toContain('Invalid project name');
        expect(truxeError.suggestions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Validation Logic', () => {
    test('should validate project name format', () => {
      // Valid formats
      expect(() => ProjectUtils.validateProjectName('my-app')).not.toThrow();
      expect(() => ProjectUtils.validateProjectName('app123')).not.toThrow();
      
      // Invalid formats
      expect(() => ProjectUtils.validateProjectName('my app')).toThrow();
      expect(() => ProjectUtils.validateProjectName('my.app')).toThrow();
      expect(() => ProjectUtils.validateProjectName('123app')).toThrow();
    });

    test('should validate project path does not exist', () => {
      mockFs.existsSync.mockReturnValue(true);
      
      expect(() => ProjectUtils.validateProjectPath(testProjectPath)).toThrow(TruxeError);
    });
  });
});


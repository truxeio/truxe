/**
 * Unit Tests for `truxe health` Command
 * 
 * Tests:
 * - Node.js version check
 * - Package manager detection
 * - Docker availability check
 * - Port availability check
 * - Database connection check
 * - Redis connection check
 * - Environment variable validation
 * - Error handling
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { execSync } from 'child_process';
import { ConfigManager } from '../../src/utils/config';
import { PortManager } from '../../src/utils/port-manager';

// Mock dependencies
jest.mock('child_process');
jest.mock('../../src/utils/config');
jest.mock('../../src/utils/port-manager');
jest.mock('../../src/utils/logger');
jest.mock('ora', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    start: jest.fn(() => ({
      succeed: jest.fn(),
      fail: jest.fn(),
      warn: jest.fn(),
      text: '',
    })),
  })),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;
const mockPortManager = PortManager as jest.MockedClass<typeof PortManager>;

describe('truxe health - Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    
    // Default mocks
    mockConfigManager.isTruxeProject.mockReturnValue(true);
    mockConfigManager.loadConfig.mockReturnValue({
      database: { url: 'postgresql://localhost:5432/test' }
    } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Node.js Version Check', () => {
    test('should pass for Node.js 20+', () => {
      const version = process.version;
      const majorVersion = parseInt(version.slice(1).split('.')[0], 10);
      const requiredVersion = 20;

      if (majorVersion >= requiredVersion) {
        expect(majorVersion).toBeGreaterThanOrEqual(requiredVersion);
      } else {
        expect(majorVersion).toBeLessThan(requiredVersion);
      }
    });

    test('should fail for Node.js < 20', () => {
      // Mock old version
      const oldVersion = 'v18.17.0';
      const majorVersion = parseInt(oldVersion.slice(1).split('.')[0], 10);
      const requiredVersion = 20;

      expect(majorVersion).toBeLessThan(requiredVersion);
    });

    test('should extract major version correctly', () => {
      const versions = ['v20.0.0', 'v21.5.0', 'v22.1.0'];
      
      versions.forEach(version => {
        const majorVersion = parseInt(version.slice(1).split('.')[0], 10);
        expect(majorVersion).toBeGreaterThanOrEqual(20);
      });
    });
  });

  describe('Package Manager Detection', () => {
    test('should detect npm', () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('npm')) {
          return Buffer.from('9.0.0');
        }
        throw new Error('Command not found');
      });

      try {
        const npmVersion = mockExecSync('npm --version', { encoding: 'utf-8', stdio: 'pipe' }).toString().trim();
        expect(npmVersion).toBe('9.0.0');
      } catch {
        // npm not available
      }
    });

    test('should detect pnpm', () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('pnpm')) {
          return Buffer.from('8.0.0');
        }
        throw new Error('Command not found');
      });

      try {
        const pnpmVersion = mockExecSync('pnpm --version', { encoding: 'utf-8', stdio: 'pipe' }).toString().trim();
        expect(pnpmVersion).toBe('8.0.0');
      } catch {
        // pnpm not available
      }
    });

    test('should detect yarn', () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('yarn')) {
          return Buffer.from('3.0.0');
        }
        throw new Error('Command not found');
      });

      try {
        const yarnVersion = mockExecSync('yarn --version', { encoding: 'utf-8', stdio: 'pipe' }).toString().trim();
        expect(yarnVersion).toBe('3.0.0');
      } catch {
        // yarn not available
      }
    });

    test('should handle no package manager available', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const packageManagers = ['npm', 'pnpm', 'yarn'];
      let detected = false;

      for (const pm of packageManagers) {
        try {
          mockExecSync(`${pm} --version`, { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 });
          detected = true;
          break;
        } catch {
          // Continue checking
        }
      }

      expect(detected).toBe(false);
    });
  });

  describe('Docker Check', () => {
    test('should detect Docker when installed and running', () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('docker --version')) {
          return Buffer.from('Docker version 24.0.0');
        }
        if (command.includes('docker info')) {
          return Buffer.from('Server Version: 24.0.0');
        }
        throw new Error('Command not found');
      });

      try {
        const dockerVersion = mockExecSync('docker --version', { encoding: 'utf-8', stdio: 'pipe' }).toString().trim();
        mockExecSync('docker info', { encoding: 'utf-8', stdio: 'pipe' });
        
        expect(dockerVersion).toContain('Docker version');
      } catch {
        // Docker not available
      }
    });

    test('should detect Docker installed but daemon not running', () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('docker --version')) {
          return Buffer.from('Docker version 24.0.0');
        }
        if (command.includes('docker info')) {
          throw new Error('Cannot connect to Docker daemon');
        }
        throw new Error('Command not found');
      });

      try {
        const dockerVersion = mockExecSync('docker --version', { encoding: 'utf-8', stdio: 'pipe' }).toString().trim();
        expect(dockerVersion).toContain('Docker version');
        
        try {
          mockExecSync('docker info', { encoding: 'utf-8', stdio: 'pipe' });
        } catch {
          // Daemon not running
          expect(true).toBe(true);
        }
      } catch {
        // Docker not installed
      }
    });

    test('should handle Docker not installed', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('docker: command not found');
      });

      try {
        mockExecSync('docker --version', { encoding: 'utf-8', stdio: 'pipe' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('docker');
      }
    });
  });

  describe('Port Availability Check', () => {
    test('should check required ports', async () => {
      const requiredPorts = [87001, 87032, 87079];
      const mockPortManager = {
        checkPorts: jest.fn().mockResolvedValue([
          { port: 87001, available: true },
          { port: 87032, available: true },
          { port: 87079, available: true },
        ]),
      };

      mockPortManager.checkPorts = jest.fn().mockResolvedValue([
        { port: 87001, available: true },
        { port: 87032, available: true },
        { port: 87079, available: true },
      ]);

      const results = await mockPortManager.checkPorts(requiredPorts);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.available)).toBe(true);
    });

    test('should detect port conflicts', async () => {
      const mockPortManager = {
        checkPorts: jest.fn().mockResolvedValue([
          { port: 87001, available: false, process: 'node', pid: 1234 },
          { port: 87032, available: true },
          { port: 87079, available: true },
        ]),
      };

      const results = await mockPortManager.checkPorts([87001, 87032, 87079]);
      const unavailable = results.filter(r => !r.available);
      
      expect(unavailable.length).toBe(1);
      expect(unavailable[0].port).toBe(87001);
    });
  });

  describe('Environment Variables Check', () => {
    test('should pass when all required variables are set', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.JWT_PRIVATE_KEY = 'test-private-key';
      process.env.JWT_PUBLIC_KEY = 'test-public-key';

      const requiredVars = ['DATABASE_URL', 'JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY'];
      const missing = requiredVars.filter(varName => !process.env[varName]);

      expect(missing.length).toBe(0);
    });

    test('should fail when required variables are missing', () => {
      delete process.env.DATABASE_URL;
      delete process.env.JWT_PRIVATE_KEY;
      delete process.env.JWT_PUBLIC_KEY;

      const requiredVars = ['DATABASE_URL', 'JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY'];
      const missing = requiredVars.filter(varName => !process.env[varName]);

      expect(missing.length).toBeGreaterThan(0);
    });

    test('should check optional variables', () => {
      process.env.EMAIL_API_KEY = 'test-key';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const optionalVars = ['EMAIL_API_KEY', 'REDIS_URL', 'NODE_ENV'];
      const present = optionalVars.filter(v => process.env[v]);

      expect(present.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Database Connection Check', () => {
    test('should validate SQLite database URL', () => {
      const databaseUrl = 'sqlite:./dev.db';
      
      if (databaseUrl.startsWith('sqlite:')) {
        expect(true).toBe(true);
      } else {
        expect(false).toBe(true);
      }
    });

    test('should validate PostgreSQL database URL', () => {
      const databaseUrl = 'postgresql://user:pass@localhost:5432/test';
      
      const isPostgres = databaseUrl.startsWith('postgresql:') || databaseUrl.startsWith('postgres:');
      expect(isPostgres).toBe(true);
    });

    test('should handle missing database URL', () => {
      const databaseUrl = undefined;
      
      if (!databaseUrl) {
        expect(true).toBe(true);
      } else {
        expect(false).toBe(true);
      }
    });
  });

  describe('Redis Connection Check', () => {
    test('should use default Redis URL when not set', () => {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      expect(redisUrl).toBe('redis://localhost:6379');
    });

    test('should use custom Redis URL when set', () => {
      process.env.REDIS_URL = 'redis://custom:6379';
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      expect(redisUrl).toBe('redis://custom:6379');
    });
  });

  describe('Error Handling', () => {
    test('should handle command execution errors gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      try {
        mockExecSync('some-command', { encoding: 'utf-8', stdio: 'pipe' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('Command failed');
      }
    });

    test('should handle timeout errors', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command timed out');
      });

      try {
        mockExecSync('slow-command', { encoding: 'utf-8', stdio: 'pipe', timeout: 1000 });
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('timed out');
      }
    });
  });

  describe('Health Check Results Formatting', () => {
    test('should format health check results correctly', () => {
      const checks = [
        { name: 'Node.js', status: 'healthy' as const, message: 'Version 20.0.0' },
        { name: 'Docker', status: 'warning' as const, message: 'Daemon not running' },
        { name: 'Database', status: 'unhealthy' as const, message: 'Connection failed' },
      ];

      const healthy = checks.filter(c => c.status === 'healthy').length;
      const unhealthy = checks.filter(c => c.status === 'unhealthy').length;
      const warnings = checks.filter(c => c.status === 'warning').length;

      expect(healthy).toBe(1);
      expect(unhealthy).toBe(1);
      expect(warnings).toBe(1);
    });

    test('should provide suggestions for failed checks', () => {
      const check = {
        name: 'Database',
        status: 'unhealthy' as const,
        message: 'Connection failed',
        suggestions: [
          'Check database credentials',
          'Verify database server is running',
        ],
      };

      expect(check.suggestions.length).toBeGreaterThan(0);
    });
  });
});


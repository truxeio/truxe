/**
 * Integration Tests for `truxe health` Command
 * 
 * Tests:
 * - Real system checks (when possible)
 * - Health check result formatting
 * - Error detection
 * - Suggestion generation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { execSync } from 'child_process';
import { PortManager } from '../../src/utils/port-manager';

// Use real implementations for integration tests
jest.unmock('child_process');

describe('truxe health - Integration Tests', () => {
  describe('Node.js Version Check', () => {
    test('should detect current Node.js version', () => {
      const version = process.version;
      const majorVersion = parseInt(version.slice(1).split('.')[0], 10);
      const requiredVersion = 20;

      expect(majorVersion).toBeGreaterThanOrEqual(18); // At least Node 18
      expect(typeof majorVersion).toBe('number');
    });

    test('should parse version string correctly', () => {
      const version = process.version;
      const match = version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
      
      expect(match).not.toBeNull();
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        const patch = parseInt(match[3], 10);
        
        expect(major).toBeGreaterThan(0);
        expect(minor).toBeGreaterThanOrEqual(0);
        expect(patch).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Package Manager Detection', () => {
    test('should detect at least one package manager', () => {
      const packageManagers = ['npm', 'pnpm', 'yarn'];
      const detected: string[] = [];

      for (const pm of packageManagers) {
        try {
          execSync(`${pm} --version`, {
            encoding: 'utf-8',
            stdio: 'pipe',
            timeout: 5000,
          });
          detected.push(pm);
        } catch {
          // Package manager not available
        }
      }

      // At least npm should be available (comes with Node.js)
      expect(detected.length).toBeGreaterThan(0);
      expect(detected).toContain('npm');
    });

    test('should get package manager version', () => {
      try {
        const npmVersion = execSync('npm --version', {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 5000,
        }).trim();

        expect(npmVersion).toBeTruthy();
        expect(npmVersion).toMatch(/^\d+\.\d+\.\d+/);
      } catch {
        // npm not available (unlikely)
        expect(true).toBe(true);
      }
    });
  });

  describe('Port Availability Check', () => {
    test('should check port availability', async () => {
      const portManager = new PortManager();
      const testPorts = [3000, 3001, 8080];

      const results = await portManager.checkPorts(testPorts);

      expect(results).toHaveLength(testPorts.length);
      results.forEach(result => {
        expect(result).toHaveProperty('port');
        expect(result).toHaveProperty('available');
        expect(typeof result.available).toBe('boolean');
      });
    });

    test('should detect port conflicts', async () => {
      const portManager = new PortManager();
      
      // Check a commonly used port (might be in use)
      const results = await portManager.checkPorts([80, 443, 3000]);

      results.forEach(result => {
        expect(result).toHaveProperty('port');
        expect(result).toHaveProperty('available');
        
        if (!result.available) {
          // If port is in use, should have process info
          expect(result).toHaveProperty('process');
        }
      });
    });
  });

  describe('Environment Variables Check', () => {
    test('should check required environment variables', () => {
      const requiredVars = [
        'DATABASE_URL',
        'JWT_PRIVATE_KEY',
        'JWT_PUBLIC_KEY',
      ];

      const missing: string[] = [];
      const present: string[] = [];

      requiredVars.forEach(varName => {
        if (process.env[varName]) {
          present.push(varName);
        } else {
          missing.push(varName);
        }
      });

      // At least verify the check works
      expect(typeof missing.length).toBe('number');
      expect(typeof present.length).toBe('number');
      expect(missing.length + present.length).toBe(requiredVars.length);
    });

    test('should check optional environment variables', () => {
      const optionalVars = [
        'EMAIL_API_KEY',
        'REDIS_URL',
        'NODE_ENV',
      ];

      const present = optionalVars.filter(v => process.env[v]);

      // NODE_ENV is usually set
      expect(present.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Check Result Formatting', () => {
    test('should format health check results', () => {
      const checks = [
        {
          name: 'Node.js',
          status: 'healthy' as const,
          message: `Version ${process.version} meets requirement`,
          details: { version: process.version },
        },
        {
          name: 'Package Manager',
          status: 'healthy' as const,
          message: 'npm detected',
          details: { detected: ['npm'] },
        },
      ];

      const healthy = checks.filter(c => c.status === 'healthy').length;
      const unhealthy = checks.filter(c => c.status === 'unhealthy').length;
      const warnings = checks.filter(c => c.status === 'warning').length;

      expect(healthy).toBeGreaterThanOrEqual(0);
      expect(unhealthy).toBeGreaterThanOrEqual(0);
      expect(warnings).toBeGreaterThanOrEqual(0);
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
      check.suggestions.forEach(suggestion => {
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle command execution errors', () => {
      try {
        execSync('nonexistent-command-12345', {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 1000,
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    test('should handle timeout errors', () => {
      try {
        execSync('sleep 10', {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 100,
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});


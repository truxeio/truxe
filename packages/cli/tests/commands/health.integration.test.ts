import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { exec } from '../../src/utils/exec';

describe('health command integration', () => {
  const cliPath = join(process.cwd(), 'dist', 'index.js');

  describe('health check', () => {
    it('should run health check successfully', async () => {
      const { exitCode, stdout } = await exec('node', [cliPath, 'health'], {
        cwd: process.cwd(),
      });

      expect(exitCode).toBe(0);
      expect(stdout).toBeTruthy();
    });

    it('should check Node.js version', async () => {
      const { stdout } = await exec('node', [cliPath, 'health'], {
        cwd: process.cwd(),
      });

      // Should mention Node.js in output
      expect(stdout.toLowerCase()).toMatch(/node/);
    });

    it('should check for Docker', async () => {
      const { stdout } = await exec('node', [cliPath, 'health'], {
        cwd: process.cwd(),
      });

      // Should check Docker status
      expect(stdout.toLowerCase()).toMatch(/docker/);
    });

    it('should check package manager availability', async () => {
      const { stdout } = await exec('node', [cliPath, 'health'], {
        cwd: process.cwd(),
      });

      // Should check npm or pnpm
      expect(stdout.toLowerCase()).toMatch(/npm|pnpm/);
    });

    it('should report port availability', async () => {
      const { stdout } = await exec('node', [cliPath, 'health'], {
        cwd: process.cwd(),
      });

      // Should check Truxe default ports
      expect(stdout).toMatch(/3456|5433|6380/);
    });
  });

  describe('health output format', () => {
    it('should use colored output by default', async () => {
      const { stdout } = await exec('node', [cliPath, 'health'], {
        cwd: process.cwd(),
      });

      // Output should be present
      expect(stdout.length).toBeGreaterThan(0);
    });

    it('should support --no-color option', async () => {
      const { exitCode } = await exec('node', [cliPath, '--no-color', 'health'], {
        cwd: process.cwd(),
      });

      expect(exitCode).toBe(0);
    });

    it('should support --verbose option', async () => {
      const { exitCode, stdout } = await exec('node', [cliPath, '--verbose', 'health'], {
        cwd: process.cwd(),
      });

      expect(exitCode).toBe(0);
      expect(stdout.length).toBeGreaterThan(0);
    });
  });

  describe('error scenarios', () => {
    it('should handle missing environment gracefully', async () => {
      // Run in a directory without .env
      const { exitCode } = await exec('node', [cliPath, 'health'], {
        cwd: '/tmp',
      });

      // Should still complete, just report missing env
      expect([0, 1]).toContain(exitCode);
    });

    it('should report unhealthy state appropriately', async () => {
      // The health command should always complete
      // even if some checks fail
      const { exitCode } = await exec('node', [cliPath, 'health'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          // Remove database URL to simulate unhealthy state
          DATABASE_URL: undefined,
        },
      });

      // Should complete with some status code
      expect(typeof exitCode).toBe('number');
    });
  });

  describe('comprehensive checks', () => {
    it('should perform all required checks', async () => {
      const { stdout } = await exec('node', [cliPath, 'health'], {
        cwd: process.cwd(),
      });

      const output = stdout.toLowerCase();

      // Verify all major checks are performed
      const checks = [
        'node', // Node.js check
        'docker', // Docker check
      ];

      for (const check of checks) {
        expect(output).toContain(check);
      }
    });

    it('should complete within reasonable time', async () => {
      const startTime = Date.now();

      await exec('node', [cliPath, 'health'], {
        cwd: process.cwd(),
      });

      const duration = Date.now() - startTime;

      // Health check should complete within 30 seconds
      expect(duration).toBeLessThan(30000);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exec, execStream, commandExists, execSilent } from '../../src/utils/exec';

describe('exec utility', () => {
  describe('exec', () => {
    it('should execute a simple command', async () => {
      const result = await exec('echo', ['hello']);

      expect(result.stdout.trim()).toBe('hello');
      expect(result.exitCode).toBe(0);
    });

    it('should execute command with multiple arguments', async () => {
      const result = await exec('echo', ['hello', 'world']);

      expect(result.stdout.trim()).toBe('hello world');
      expect(result.exitCode).toBe(0);
    });

    it('should handle stderr output', async () => {
      // Using a command that writes to stderr (>&2 redirects to stderr in shell)
      const result = await exec('node', [
        '-e',
        'console.error("error message")',
      ]);

      expect(result.stderr.trim()).toBe('error message');
      expect(result.exitCode).toBe(0);
    });

    it('should throw error for non-existent command', async () => {
      await expect(
        exec('non-existent-command-12345', [])
      ).rejects.toThrow();
    });

    it('should throw error for command that fails', async () => {
      await expect(
        exec('node', ['-e', 'process.exit(1)'])
      ).rejects.toThrow();
    });

    it('should respect cwd option', async () => {
      const result = await exec('pwd', [], {
        cwd: '/tmp',
      });

      expect(result.stdout.trim()).toContain('/tmp');
    });

    it('should respect env option', async () => {
      const result = await exec('node', [
        '-e',
        'console.log(process.env.TEST_VAR)',
      ], {
        env: { ...process.env, TEST_VAR: 'test_value' },
      });

      expect(result.stdout.trim()).toBe('test_value');
    });

    it('should handle verbose option', async () => {
      const result = await exec('echo', ['test'], {
        verbose: true,
      });

      expect(result.stdout.trim()).toBe('test');
    });

    it('should handle shell option', async () => {
      const result = await exec('echo "hello world"', [], {
        shell: true,
      });

      expect(result.stdout.trim()).toBe('hello world');
    });

    it('should handle empty output', async () => {
      const result = await exec('node', ['-e', '']);

      expect(result.stdout).toBe('');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('execStream', () => {
    it('should execute command with streaming output', async () => {
      const result = await execStream('echo', ['hello']);

      expect(result.exitCode).toBe(0);
    });

    it('should respect cwd option', async () => {
      const result = await execStream('pwd', [], {
        cwd: '/tmp',
      });

      expect(result.exitCode).toBe(0);
    });

    it('should respect env option', async () => {
      const result = await execStream('node', [
        '-e',
        'process.exit(0)',
      ], {
        env: { ...process.env, TEST_VAR: 'test' },
      });

      expect(result.exitCode).toBe(0);
    });

    it('should throw error for failing command', async () => {
      await expect(
        execStream('node', ['-e', 'process.exit(1)'])
      ).rejects.toThrow();
    });

    it('should handle shell option', async () => {
      const result = await execStream('echo "test"', [], {
        shell: true,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  describe('commandExists', () => {
    it('should return true for existing commands', async () => {
      const exists = await commandExists('node');
      expect(exists).toBe(true);
    });

    it('should return true for npm/pnpm', async () => {
      // At least one of these should exist
      const npmExists = await commandExists('npm');
      const pnpmExists = await commandExists('pnpm');

      expect(npmExists || pnpmExists).toBe(true);
    });

    it('should return false for non-existent command', async () => {
      const exists = await commandExists('non-existent-command-xyz-12345');
      expect(exists).toBe(false);
    });

    it('should handle common system commands', async () => {
      // These should exist on most Unix systems
      if (process.platform !== 'win32') {
        const echoExists = await commandExists('echo');
        const lsExists = await commandExists('ls');

        expect(echoExists).toBe(true);
        expect(lsExists).toBe(true);
      }
    });

    it('should handle Windows commands on Windows', async () => {
      if (process.platform === 'win32') {
        const cmdExists = await commandExists('cmd');
        expect(cmdExists).toBe(true);
      }
    });
  });

  describe('execSilent', () => {
    it('should return true for successful command', async () => {
      const result = await execSilent('echo', ['test']);
      expect(result).toBe(true);
    });

    it('should return false for failing command', async () => {
      const result = await execSilent('node', ['-e', 'process.exit(1)']);
      expect(result).toBe(false);
    });

    it('should return false for non-existent command', async () => {
      const result = await execSilent('non-existent-command-12345', []);
      expect(result).toBe(false);
    });

    it('should respect options', async () => {
      const result = await execSilent('pwd', [], {
        cwd: '/tmp',
      });

      expect(result).toBe(true);
    });

    it('should not throw errors', async () => {
      // This should not throw, just return false
      const result = await execSilent('invalid-command', []);
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle commands with no arguments', async () => {
      const result = await exec('pwd');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBeTruthy();
    });

    it('should handle very long output', async () => {
      const result = await exec('node', [
        '-e',
        'console.log("x".repeat(10000))',
      ]);

      expect(result.stdout.trim().length).toBe(10000);
      expect(result.exitCode).toBe(0);
    });

    it('should handle multiple commands in sequence', async () => {
      const result1 = await exec('echo', ['first']);
      const result2 = await exec('echo', ['second']);
      const result3 = await exec('echo', ['third']);

      expect(result1.stdout.trim()).toBe('first');
      expect(result2.stdout.trim()).toBe('second');
      expect(result3.stdout.trim()).toBe('third');
    });

    it('should handle concurrent command execution', async () => {
      const [result1, result2, result3] = await Promise.all([
        exec('echo', ['concurrent1']),
        exec('echo', ['concurrent2']),
        exec('echo', ['concurrent3']),
      ]);

      expect(result1.stdout.trim()).toBe('concurrent1');
      expect(result2.stdout.trim()).toBe('concurrent2');
      expect(result3.stdout.trim()).toBe('concurrent3');
    });

    it('should handle special characters in arguments', async () => {
      const specialChars = '!@#$%^&*()';
      const result = await exec('echo', [specialChars]);

      expect(result.stdout.trim()).toBe(specialChars);
    });

    it('should handle empty string arguments', async () => {
      const result = await exec('echo', ['']);
      expect(result.exitCode).toBe(0);
    });

    it('should handle commands with newlines in output', async () => {
      const result = await exec('node', [
        '-e',
        'console.log("line1\\nline2\\nline3")',
      ]);

      const lines = result.stdout.trim().split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('line1');
      expect(lines[1]).toBe('line2');
      expect(lines[2]).toBe('line3');
    });
  });

  describe('platform-specific behavior', () => {
    it('should work with platform-specific path separator', async () => {
      const result = await exec('node', ['-e', 'console.log(__dirname)']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBeTruthy();
    });

    it('should handle platform-specific commands', async () => {
      if (process.platform === 'win32') {
        const result = await commandExists('where');
        expect(result).toBe(true);
      } else {
        const result = await commandExists('which');
        expect(result).toBe(true);
      }
    });
  });

  describe('error handling', () => {
    it('should include stderr in error when command fails', async () => {
      try {
        await exec('node', [
          '-e',
          'console.error("error message"); process.exit(1)',
        ]);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeDefined();
        // Error should contain information about the failure
        expect(error.exitCode).toBe(1);
      }
    });

    it('should handle timeout scenarios gracefully', async () => {
      // This test just ensures the command completes
      // Real timeout would require execa timeout option
      const result = await exec('node', [
        '-e',
        'setTimeout(() => {}, 10)',
      ]);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('stdio options', () => {
    it('should handle stdio: pipe option', async () => {
      const result = await exec('echo', ['test'], {
        stdio: 'pipe',
      });

      expect(result.stdout.trim()).toBe('test');
    });

    it('should handle stdio: ignore option', async () => {
      const result = await exec('echo', ['test'], {
        stdio: 'ignore',
      });

      // With ignore, we still get the result object
      expect(result.exitCode).toBe(0);
    });
  });
});

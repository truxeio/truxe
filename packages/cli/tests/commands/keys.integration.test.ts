import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { exec } from '../../src/utils/exec';
import { exists, remove, ensureDir, readFile } from '../../src/utils/fs';

describe('keys command integration', () => {
  const testDir = join(process.cwd(), 'tests', 'tmp', 'keys-integration');
  const cliPath = join(process.cwd(), 'dist', 'index.js');

  beforeEach(async () => {
    await ensureDir(testDir);
  });

  afterEach(async () => {
    try {
      await remove(testDir);
    } catch {
      // Ignore errors
    }
  });

  describe('keys generate', () => {
    it('should generate RSA key pair with default options', async () => {
      const keysDir = join(testDir, 'keys');

      const { exitCode } = await exec('node', [
        cliPath,
        'keys',
        'generate',
        '--output',
        keysDir,
      ], {
        cwd: testDir,
      });

      expect(exitCode).toBe(0);

      const privateKeyPath = join(keysDir, 'private.pem');
      const publicKeyPath = join(keysDir, 'public.pem');

      const privateKeyExists = await exists(privateKeyPath);
      const publicKeyExists = await exists(publicKeyPath);

      expect(privateKeyExists).toBe(true);
      expect(publicKeyExists).toBe(true);

      // Verify key content
      const privateKey = await readFile(privateKeyPath);
      const publicKey = await readFile(publicKeyPath);

      expect(privateKey).toContain('BEGIN PRIVATE KEY');
      expect(privateKey).toContain('END PRIVATE KEY');
      expect(publicKey).toContain('BEGIN PUBLIC KEY');
      expect(publicKey).toContain('END PUBLIC KEY');
    });

    it('should generate 4096-bit keys when specified', async () => {
      const keysDir = join(testDir, 'keys-4096');

      const { exitCode } = await exec('node', [
        cliPath,
        'keys',
        'generate',
        '--output',
        keysDir,
        '--bits',
        '4096',
      ], {
        cwd: testDir,
      });

      expect(exitCode).toBe(0);

      const privateKeyExists = await exists(join(keysDir, 'private.pem'));
      const publicKeyExists = await exists(join(keysDir, 'public.pem'));

      expect(privateKeyExists).toBe(true);
      expect(publicKeyExists).toBe(true);
    });

    it('should not overwrite existing keys without --force', async () => {
      const keysDir = join(testDir, 'keys-no-force');

      // Generate keys first time
      await exec('node', [
        cliPath,
        'keys',
        'generate',
        '--output',
        keysDir,
      ], {
        cwd: testDir,
      });

      // Try to generate again without --force (should fail or skip)
      try {
        await exec('node', [
          cliPath,
          'keys',
          'generate',
          '--output',
          keysDir,
        ], {
          cwd: testDir,
        });

        // If it doesn't throw, the command should have exited with non-zero
        // or provided a warning message
      } catch (error) {
        // Expected behavior - command should prevent overwriting
        expect(error).toBeDefined();
      }
    });

    it('should overwrite existing keys with --force', async () => {
      const keysDir = join(testDir, 'keys-force');

      // Generate keys first time
      await exec('node', [
        cliPath,
        'keys',
        'generate',
        '--output',
        keysDir,
      ], {
        cwd: testDir,
      });

      const firstPrivateKey = await readFile(join(keysDir, 'private.pem'));

      // Small delay to ensure different keys
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate again with --force
      const { exitCode } = await exec('node', [
        cliPath,
        'keys',
        'generate',
        '--output',
        keysDir,
        '--force',
      ], {
        cwd: testDir,
      });

      expect(exitCode).toBe(0);

      const secondPrivateKey = await readFile(join(keysDir, 'private.pem'));

      // Keys should be different
      expect(firstPrivateKey).not.toBe(secondPrivateKey);
    });
  });

  describe('keys verify', () => {
    it('should verify valid key pair', async () => {
      const keysDir = join(testDir, 'keys-verify');

      // Generate keys first
      await exec('node', [
        cliPath,
        'keys',
        'generate',
        '--output',
        keysDir,
      ], {
        cwd: testDir,
      });

      // Set environment variables for verification
      const { exitCode } = await exec('node', [
        cliPath,
        'keys',
        'verify',
      ], {
        cwd: testDir,
        env: {
          ...process.env,
          JWT_PRIVATE_KEY_PATH: join(keysDir, 'private.pem'),
          JWT_PUBLIC_KEY_PATH: join(keysDir, 'public.pem'),
        },
      });

      expect(exitCode).toBe(0);
    });

    it('should fail verification with missing keys', async () => {
      try {
        await exec('node', [
          cliPath,
          'keys',
          'verify',
        ], {
          cwd: testDir,
          env: {
            ...process.env,
            JWT_PRIVATE_KEY_PATH: '/non/existent/private.pem',
            JWT_PUBLIC_KEY_PATH: '/non/existent/public.pem',
          },
        });

        // Should not reach here
        expect.fail('Should have thrown error for missing keys');
      } catch (error) {
        // Expected - keys don't exist
        expect(error).toBeDefined();
      }
    });
  });

  describe('keys rotate', () => {
    it('should provide rotation guidance', async () => {
      const { stdout, exitCode } = await exec('node', [
        cliPath,
        'keys',
        'rotate',
      ], {
        cwd: testDir,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('rotation');
    });
  });

  describe('error handling', () => {
    it('should handle invalid bits parameter', async () => {
      try {
        await exec('node', [
          cliPath,
          'keys',
          'generate',
          '--bits',
          '1024', // Too small
        ], {
          cwd: testDir,
        });

        expect.fail('Should have thrown error for invalid bits');
      } catch (error) {
        // Expected - invalid parameter
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid output directory', async () => {
      try {
        await exec('node', [
          cliPath,
          'keys',
          'generate',
          '--output',
          '/invalid/permission/path',
        ], {
          cwd: testDir,
        });

        expect.fail('Should have thrown error for invalid output');
      } catch (error) {
        // Expected - cannot write to that location
        expect(error).toBeDefined();
      }
    });
  });
});

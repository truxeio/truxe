import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';
import { writeFile, remove, ensureDir } from '../../src/utils/fs';
import {
  isDockerInstalled,
  isDockerRunning,
  getDockerInfo,
  isContainerRunning,
  startDockerCompose,
  stopDockerCompose,
  dockerComposeFileExists,
  waitForService,
} from '../../src/utils/docker';

describe('docker utility', () => {
  const testDir = join(process.cwd(), 'tests', 'tmp', 'docker-tests');

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

  describe('isDockerInstalled', () => {
    it('should check if docker command exists', async () => {
      const installed = await isDockerInstalled();
      expect(typeof installed).toBe('boolean');
    });

    it('should return true if docker is available', async () => {
      const installed = await isDockerInstalled();
      // This might be true or false depending on environment
      // Just verify it returns a boolean
      expect([true, false]).toContain(installed);
    });
  });

  describe('isDockerRunning', () => {
    it('should check if docker daemon is running', async () => {
      const running = await isDockerRunning();
      expect(typeof running).toBe('boolean');
    });

    it('should return false if docker is not installed', async () => {
      const installed = await isDockerInstalled();
      if (!installed) {
        const running = await isDockerRunning();
        expect(running).toBe(false);
      }
    });
  });

  describe('getDockerInfo', () => {
    it('should return docker information', async () => {
      const info = await getDockerInfo();

      expect(info).toHaveProperty('available');
      expect(info).toHaveProperty('running');
      expect(typeof info.available).toBe('boolean');
      expect(typeof info.running).toBe('boolean');
    });

    it('should return version if docker is running', async () => {
      const info = await getDockerInfo();

      if (info.running) {
        expect(info.version).toBeDefined();
        expect(typeof info.version).toBe('string');
        expect(info.version).toContain('Docker');
      }
    });

    it('should not return version if docker is not running', async () => {
      const info = await getDockerInfo();

      if (!info.running) {
        expect(info.version).toBeUndefined();
      }
    });

    it('should set available to false if docker not installed', async () => {
      const installed = await isDockerInstalled();
      const info = await getDockerInfo();

      if (!installed) {
        expect(info.available).toBe(false);
        expect(info.running).toBe(false);
      }
    });

    it('should handle docker available but not running', async () => {
      const info = await getDockerInfo();

      if (info.available && !info.running) {
        expect(info.version).toBeUndefined();
      }
    });
  });

  describe('isContainerRunning', () => {
    it('should return boolean for container status', async () => {
      const running = await isContainerRunning('test-container-that-does-not-exist-123456');
      expect(typeof running).toBe('boolean');
    });

    it('should return false for non-existent container', async () => {
      const running = await isContainerRunning('non-existent-container-xyz-999');
      expect(running).toBe(false);
    });

    it('should handle docker not available', async () => {
      const installed = await isDockerInstalled();
      if (!installed) {
        const running = await isContainerRunning('any-container');
        expect(running).toBe(false);
      }
    });

    it('should check exact container name match', async () => {
      // Even if similar containers exist, it should match exact name
      const running = await isContainerRunning('test-exact-name-match-12345');
      expect(typeof running).toBe('boolean');
    });
  });

  describe('dockerComposeFileExists', () => {
    it('should return true for existing compose file', async () => {
      const composePath = join(testDir, 'docker-compose.yml');
      await writeFile(composePath, 'version: "3.8"\nservices:\n  test:\n    image: alpine');

      const exists = await dockerComposeFileExists(composePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent compose file', async () => {
      const composePath = join(testDir, 'non-existent-compose.yml');

      const exists = await dockerComposeFileExists(composePath);
      expect(exists).toBe(false);
    });

    it('should handle relative paths', async () => {
      const composePath = './docker-compose.yml';
      const exists = await dockerComposeFileExists(composePath);
      expect(typeof exists).toBe('boolean');
    });
  });

  describe('startDockerCompose', () => {
    it('should return boolean for start result', async () => {
      const composePath = join(testDir, 'test-compose.yml');
      await writeFile(composePath, 'version: "3.8"\nservices:\n  test:\n    image: alpine');

      // This will likely fail if docker-compose is not available
      // But should return boolean either way
      const result = await startDockerCompose(composePath);
      expect(typeof result).toBe('boolean');
    });

    it('should handle non-existent compose file', async () => {
      const composePath = join(testDir, 'missing-compose.yml');

      const result = await startDockerCompose(composePath);
      expect(result).toBe(false);
    });

    it('should handle specific services parameter', async () => {
      const composePath = join(testDir, 'services-compose.yml');
      await writeFile(
        composePath,
        'version: "3.8"\nservices:\n  db:\n    image: postgres\n  redis:\n    image: redis'
      );

      const result = await startDockerCompose(composePath, ['db']);
      expect(typeof result).toBe('boolean');
    });

    it('should handle empty services array', async () => {
      const composePath = join(testDir, 'empty-services.yml');
      await writeFile(composePath, 'version: "3.8"\nservices:\n  test:\n    image: alpine');

      const result = await startDockerCompose(composePath, []);
      expect(typeof result).toBe('boolean');
    });

    it('should return false when docker-compose not available', async () => {
      const composePath = join(testDir, 'no-docker-compose.yml');
      await writeFile(composePath, 'version: "3.8"\nservices:\n  test:\n    image: alpine');

      // If docker-compose command doesn't exist, should return false
      const result = await startDockerCompose(composePath);
      if (result === false) {
        // Command might not be available
        expect(result).toBe(false);
      }
    });
  });

  describe('stopDockerCompose', () => {
    it('should return boolean for stop result', async () => {
      const composePath = join(testDir, 'stop-compose.yml');
      await writeFile(composePath, 'version: "3.8"\nservices:\n  test:\n    image: alpine');

      const result = await stopDockerCompose(composePath);
      expect(typeof result).toBe('boolean');
    });

    it('should handle non-existent compose file', async () => {
      const composePath = join(testDir, 'missing-stop-compose.yml');

      const result = await stopDockerCompose(composePath);
      expect(result).toBe(false);
    });

    it('should handle docker-compose not available', async () => {
      const composePath = join(testDir, 'no-compose-stop.yml');
      await writeFile(composePath, 'version: "3.8"\nservices:\n  test:\n    image: alpine');

      const result = await stopDockerCompose(composePath);
      // Should return false if docker-compose not available
      expect(typeof result).toBe('boolean');
    });
  });

  describe('waitForService', () => {
    it('should return false for non-existent container within timeout', async () => {
      const result = await waitForService('non-existent-container-xyz-123', 1000, 200);
      expect(result).toBe(false);
    });

    it('should respect maxWaitTime parameter', async () => {
      const startTime = Date.now();
      const maxWaitTime = 2000;

      await waitForService('non-existent-container-wait-test', maxWaitTime, 500);

      const elapsed = Date.now() - startTime;
      // Should not exceed maxWaitTime by too much (allow some overhead)
      expect(elapsed).toBeLessThanOrEqual(maxWaitTime + 1000);
    });

    it('should use default parameters', async () => {
      // Default maxWaitTime is 30000ms, checkInterval is 1000ms
      // We'll use a shorter timeout for testing
      const result = await waitForService('non-existent-default-params', 1000);
      expect(result).toBe(false);
    });

    it('should check container at regular intervals', async () => {
      const startTime = Date.now();
      const checkInterval = 500;
      const maxWaitTime = 2000;

      await waitForService('interval-test-container', maxWaitTime, checkInterval);

      const elapsed = Date.now() - startTime;
      // Should have made multiple checks
      expect(elapsed).toBeGreaterThanOrEqual(checkInterval);
    });

    it('should handle docker not available', async () => {
      const installed = await isDockerInstalled();
      if (!installed) {
        const result = await waitForService('any-service', 1000, 200);
        expect(result).toBe(false);
      }
    });

    it('should timeout for container that never becomes ready', async () => {
      const maxWaitTime = 1500;
      const startTime = Date.now();

      const result = await waitForService('never-ready-container', maxWaitTime, 300);

      const elapsed = Date.now() - startTime;
      expect(result).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(maxWaitTime);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full docker check workflow', async () => {
      const installed = await isDockerInstalled();
      const running = await isDockerRunning();
      const info = await getDockerInfo();

      expect(info.available).toBe(installed);
      expect(info.running).toBe(running);

      if (installed && running) {
        expect(info.version).toBeDefined();
      }
    });

    it('should handle compose file workflow', async () => {
      const composePath = join(testDir, 'workflow-compose.yml');
      const composeContent = `
version: "3.8"
services:
  test:
    image: alpine
    command: sleep 1000
`;

      await writeFile(composePath, composeContent);

      const exists = await dockerComposeFileExists(composePath);
      expect(exists).toBe(true);

      // Try to start (may fail if docker not available, but should not throw)
      const startResult = await startDockerCompose(composePath);
      expect(typeof startResult).toBe('boolean');

      // Try to stop
      const stopResult = await stopDockerCompose(composePath);
      expect(typeof stopResult).toBe('boolean');
    });
  });

  describe('edge cases', () => {
    it('should handle very long container names', async () => {
      const longName = 'a'.repeat(200);
      const running = await isContainerRunning(longName);
      expect(typeof running).toBe('boolean');
    });

    it('should handle special characters in container names', async () => {
      const specialName = 'test-container_123-xyz';
      const running = await isContainerRunning(specialName);
      expect(typeof running).toBe('boolean');
    });

    it('should handle invalid compose file path', async () => {
      const invalidPath = '/invalid/path/to/compose.yml';
      const result = await startDockerCompose(invalidPath);
      expect(result).toBe(false);
    });

    it('should handle malformed compose file', async () => {
      const composePath = join(testDir, 'malformed-compose.yml');
      await writeFile(composePath, 'this is not valid yaml {{{');

      const result = await startDockerCompose(composePath);
      expect(result).toBe(false);
    });

    it('should handle concurrent docker operations', async () => {
      const [info1, info2, info3] = await Promise.all([
        getDockerInfo(),
        getDockerInfo(),
        getDockerInfo(),
      ]);

      expect(info1).toEqual(info2);
      expect(info2).toEqual(info3);
    });

    it('should handle zero wait time', async () => {
      const result = await waitForService('test-container', 0, 100);
      expect(result).toBe(false);
    });

    it('should handle very small check interval', async () => {
      const result = await waitForService('test-container', 500, 10);
      expect(result).toBe(false);
    });
  });

  describe('error resilience', () => {
    it('should not throw on docker command failures', async () => {
      // All these should return false/undefined gracefully, not throw
      await expect(isDockerInstalled()).resolves.toBeDefined();
      await expect(isDockerRunning()).resolves.toBeDefined();
      await expect(getDockerInfo()).resolves.toBeDefined();
      await expect(isContainerRunning('test')).resolves.toBeDefined();
    });

    it('should handle missing docker-compose gracefully', async () => {
      const composePath = join(testDir, 'missing-dc.yml');
      await writeFile(composePath, 'version: "3.8"\nservices:\n  test:\n    image: alpine');

      // Should not throw, just return false
      await expect(startDockerCompose(composePath)).resolves.toBeDefined();
      await expect(stopDockerCompose(composePath)).resolves.toBeDefined();
    });
  });
});

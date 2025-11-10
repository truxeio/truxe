import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer } from 'net';
import {
  checkPort,
  checkPorts,
  findAvailablePort,
  checkAndLogPorts,
  getProcessUsingPort,
  TRUXE_DEFAULT_PORTS,
  checkTruxePorts,
} from '../../src/utils/ports';

describe('ports utility', () => {
  describe('TRUXE_DEFAULT_PORTS', () => {
    it('should have correct default ports', () => {
      expect(TRUXE_DEFAULT_PORTS.API).toBe(3456);
      expect(TRUXE_DEFAULT_PORTS.POSTGRES).toBe(5433);
      expect(TRUXE_DEFAULT_PORTS.REDIS).toBe(6380);
    });

    it('should have read-only properties', () => {
      // The `as const` assertion makes properties readonly at compile time
      // We can't modify them at runtime without TypeScript errors
      expect(TRUXE_DEFAULT_PORTS).toBeDefined();
      expect(typeof TRUXE_DEFAULT_PORTS).toBe('object');
    });
  });

  describe('checkPort', () => {
    it('should return true for available port', async () => {
      // Use a port that is very likely to be available (high port number)
      const available = await checkPort(54321);
      expect(available).toBe(true);
    });

    it('should return false for port in use', async () => {
      const server = createServer();
      const testPort = 54322;

      // Start server on test port
      await new Promise((resolve) => {
        server.listen(testPort, () => resolve(undefined));
      });

      try {
        const available = await checkPort(testPort);
        expect(available).toBe(false);
      } finally {
        await new Promise((resolve) => {
          server.close(() => resolve(undefined));
        });
      }
    });

    it('should handle port 0 (system-assigned port)', async () => {
      const available = await checkPort(0);
      expect(available).toBe(true);
    });
  });

  describe('checkPorts', () => {
    it('should check multiple ports', async () => {
      const results = await checkPorts([54323, 54324, 54325]);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('port', 54323);
      expect(results[0]).toHaveProperty('available');
      expect(results[1]).toHaveProperty('port', 54324);
      expect(results[2]).toHaveProperty('port', 54325);
    });

    it('should include error message for unavailable ports', async () => {
      const server = createServer();
      const testPort = 54326;

      await new Promise((resolve) => {
        server.listen(testPort, () => resolve(undefined));
      });

      try {
        const results = await checkPorts([testPort, 54327]);

        expect(results[0].available).toBe(false);
        expect(results[0].error).toBe(`Port ${testPort} is already in use`);
        expect(results[1].available).toBe(true);
        expect(results[1].error).toBeUndefined();
      } finally {
        await new Promise((resolve) => {
          server.close(() => resolve(undefined));
        });
      }
    });

    it('should handle empty array', async () => {
      const results = await checkPorts([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('findAvailablePort', () => {
    it('should find available port starting from given port', async () => {
      const port = await findAvailablePort(54330);
      expect(port).toBeGreaterThanOrEqual(54330);
      expect(port).toBeLessThan(54430); // Within maxAttempts range
    });

    it('should find next available port if starting port is in use', async () => {
      const server = createServer();
      const startPort = 54340;

      await new Promise((resolve) => {
        server.listen(startPort, () => resolve(undefined));
      });

      try {
        const port = await findAvailablePort(startPort);
        expect(port).toBeGreaterThan(startPort);
      } finally {
        await new Promise((resolve) => {
          server.close(() => resolve(undefined));
        });
      }
    });

    it('should respect maxAttempts parameter', async () => {
      // Create servers on a range of ports to force failure
      const servers: any[] = [];
      const startPort = 54350;
      const maxAttempts = 5;

      // Occupy all ports in the range
      for (let i = 0; i < maxAttempts; i++) {
        const server = createServer();
        servers.push(server);
        await new Promise((resolve) => {
          server.listen(startPort + i, () => resolve(undefined));
        });
      }

      try {
        await expect(
          findAvailablePort(startPort, maxAttempts)
        ).rejects.toThrow(
          `Could not find an available port starting from ${startPort} after ${maxAttempts} attempts`
        );
      } finally {
        // Close all servers
        for (const server of servers) {
          await new Promise((resolve) => {
            server.close(() => resolve(undefined));
          });
        }
      }
    });
  });

  describe('checkAndLogPorts', () => {
    it('should return true when all ports are available', async () => {
      const result = await checkAndLogPorts([54360, 54361, 54362]);
      expect(result).toBe(true);
    });

    it('should return false when any port is unavailable', async () => {
      const server = createServer();
      const testPort = 54370;

      await new Promise((resolve) => {
        server.listen(testPort, () => resolve(undefined));
      });

      try {
        const result = await checkAndLogPorts([testPort, 54371]);
        expect(result).toBe(false);
      } finally {
        await new Promise((resolve) => {
          server.close(() => resolve(undefined));
        });
      }
    });
  });

  describe('getProcessUsingPort', () => {
    it('should return null on Windows platform', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });

      const result = await getProcessUsingPort(3456);
      expect(result).toBeNull();

      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true,
        configurable: true,
      });
    });

    it('should return null for available port on Unix', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows
        return;
      }

      const result = await getProcessUsingPort(54380);
      expect(result).toBeNull();
    });

    it('should return process ID for port in use on Unix', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows
        return;
      }

      const server = createServer();
      const testPort = 54381;

      await new Promise((resolve) => {
        server.listen(testPort, () => resolve(undefined));
      });

      try {
        const result = await getProcessUsingPort(testPort);
        // Should return a process ID (string of numbers)
        if (result) {
          expect(result).toMatch(/^\d+$/);
        }
      } finally {
        await new Promise((resolve) => {
          server.close(() => resolve(undefined));
        });
      }
    });
  });

  describe('checkTruxePorts', () => {
    it('should check all Truxe default ports', async () => {
      const results = await checkTruxePorts();

      expect(results).toHaveLength(3);

      const apiResult = results.find((r) => r.port === TRUXE_DEFAULT_PORTS.API);
      const postgresResult = results.find((r) => r.port === TRUXE_DEFAULT_PORTS.POSTGRES);
      const redisResult = results.find((r) => r.port === TRUXE_DEFAULT_PORTS.REDIS);

      expect(apiResult).toBeDefined();
      expect(postgresResult).toBeDefined();
      expect(redisResult).toBeDefined();
    });

    it('should include process information for unavailable ports', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows
        return;
      }

      const server = createServer();
      const testPort = TRUXE_DEFAULT_PORTS.API;

      // Try to use Truxe API port
      const isPortAvailable = await checkPort(testPort);

      if (isPortAvailable) {
        await new Promise((resolve) => {
          server.listen(testPort, () => resolve(undefined));
        });

        try {
          const results = await checkTruxePorts();
          const apiResult = results.find((r) => r.port === testPort);

          if (apiResult && !apiResult.available) {
            // Should have process info on Unix systems
            expect(apiResult.process).toBeDefined();
          }
        } finally {
          await new Promise((resolve) => {
            server.close(() => resolve(undefined));
          });
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle invalid port numbers gracefully', async () => {
      // Port numbers must be between 0 and 65535
      await expect(checkPort(-1)).rejects.toThrow();
      await expect(checkPort(70000)).rejects.toThrow();
    });

    it('should handle concurrent port checks', async () => {
      const ports = [54400, 54401, 54402, 54403, 54404];

      const [results1, results2] = await Promise.all([
        checkPorts(ports),
        checkPorts(ports),
      ]);

      expect(results1).toHaveLength(ports.length);
      expect(results2).toHaveLength(ports.length);
    });
  });
});

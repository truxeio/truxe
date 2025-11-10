/**
 * Port availability checker utility
 * Checks if ports are available and provides port suggestions
 */

import { createServer, Server } from 'net';
import { logger } from './logger';

export interface PortCheckResult {
  port: number;
  available: boolean;
  error?: string;
  process?: string;
}

/**
 * Check if a port is available
 */
export function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server: Server = createServer();

    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });

    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Check multiple ports
 */
export async function checkPorts(ports: number[]): Promise<PortCheckResult[]> {
  const results: PortCheckResult[] = [];

  for (const port of ports) {
    const available = await checkPort(port);
    results.push({
      port,
      available,
      error: available ? undefined : `Port ${port} is already in use`,
    });
  }

  return results;
}

/**
 * Find an available port starting from a given port
 */
export async function findAvailablePort(startPort: number, maxAttempts = 100): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await checkPort(port);
    
    if (available) {
      return port;
    }
  }

  throw new Error(
    `Could not find an available port starting from ${startPort} after ${maxAttempts} attempts`
  );
}

/**
 * Check if ports are available and log results
 */
export async function checkAndLogPorts(ports: number[]): Promise<boolean> {
  const results = await checkPorts(ports);
  let allAvailable = true;

  for (const result of results) {
    if (result.available) {
      logger.success(`Port ${result.port} is available`);
    } else {
      logger.error(`Port ${result.port} is not available: ${result.error}`);
      allAvailable = false;
    }
  }

  return allAvailable;
}

/**
 * Get process using a port (Unix/Linux/macOS only)
 */
export async function getProcessUsingPort(port: number): Promise<string | null> {
  if (process.platform === 'win32') {
    // Windows implementation would use netstat
    return null;
  }

  try {
    const { exec } = await import('./exec');
    const { stdout } = await exec('lsof', ['-ti', `:${port}`], {
      stdio: 'pipe',
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Truxe default ports
 */
export const TRUXE_DEFAULT_PORTS = {
  API: 3456,
  POSTGRES: 5433,
  REDIS: 6380,
} as const;

/**
 * Check Truxe default ports with process information
 */
export async function checkTruxePorts(): Promise<PortCheckResult[]> {
  const defaultPorts = [
    TRUXE_DEFAULT_PORTS.API,
    TRUXE_DEFAULT_PORTS.POSTGRES,
    TRUXE_DEFAULT_PORTS.REDIS,
  ];
  const results = await checkPorts(defaultPorts);

  // Add process information for unavailable ports
  for (const result of results) {
    if (!result.available) {
      const processInfo = await getProcessUsingPort(result.port);
      if (processInfo) {
        result.process = processInfo;
      }
    }
  }

  return results;
}


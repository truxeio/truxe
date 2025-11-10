/**
 * Docker utility helpers
 * Provides utilities for checking Docker availability and managing containers
 */

import { exec, commandExists } from './exec';
import { logger } from './logger';
import { exists } from './fs';

export interface DockerInfo {
  version?: string;
  running: boolean;
  available: boolean;
}

/**
 * Check if Docker is installed
 */
export async function isDockerInstalled(): Promise<boolean> {
  return await commandExists('docker');
}

/**
 * Check if Docker daemon is running
 */
export async function isDockerRunning(): Promise<boolean> {
  try {
    await exec('docker', ['info'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Docker information
 */
export async function getDockerInfo(): Promise<DockerInfo> {
  const available = await isDockerInstalled();
  
  if (!available) {
    return {
      available: false,
      running: false,
    };
  }

  const running = await isDockerRunning();
  
  let version: string | undefined;
  if (running) {
    try {
      const { stdout } = await exec('docker', ['--version'], { stdio: 'pipe' });
      version = stdout.trim();
    } catch {
      // Ignore version fetch errors
    }
  }

  return {
    available: true,
    running,
    version,
  };
}

/**
 * Check if a Docker container is running
 */
export async function isContainerRunning(containerName: string): Promise<boolean> {
  try {
    const { stdout } = await exec('docker', ['ps', '--filter', `name=${containerName}`, '--format', '{{.Names}}'], {
      stdio: 'pipe',
    });
    return stdout.trim() === containerName;
  } catch {
    return false;
  }
}

/**
 * Start Docker Compose services
 */
export async function startDockerCompose(
  composeFile: string,
  services?: string[]
): Promise<boolean> {
  try {
    const args = ['-f', composeFile, 'up', '-d'];
    if (services && services.length > 0) {
      args.push(...services);
    }
    
    await exec('docker-compose', args, { stdio: 'inherit' });
    logger.success('Docker Compose services started');
    return true;
  } catch (error) {
    logger.error('Failed to start Docker Compose services');
    if (error instanceof Error) {
      logger.debug(error.message);
    }
    return false;
  }
}

/**
 * Stop Docker Compose services
 */
export async function stopDockerCompose(composeFile: string): Promise<boolean> {
  try {
    await exec('docker-compose', ['-f', composeFile, 'down'], { stdio: 'inherit' });
    logger.success('Docker Compose services stopped');
    return true;
  } catch (error) {
    logger.error('Failed to stop Docker Compose services');
    if (error instanceof Error) {
      logger.debug(error.message);
    }
    return false;
  }
}

/**
 * Check Docker Compose file exists
 */
export async function dockerComposeFileExists(composeFile: string): Promise<boolean> {
  return await exists(composeFile);
}

/**
 * Wait for a service to be healthy
 */
export async function waitForService(
  containerName: string,
  maxWaitTime = 30000,
  checkInterval = 1000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    if (await isContainerRunning(containerName)) {
      // Additional health check - try to ping the service
      try {
        await exec('docker', ['exec', containerName, 'echo', 'ok'], {
          stdio: 'ignore',
        });
        return true;
      } catch {
        // Container exists but not ready yet
      }
    }
    
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }
  
  return false;
}


/**
 * Health command - Check system dependencies and configuration
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { exec, commandExists } from '../utils/exec';
import { checkTruxePorts } from '../utils/ports';
import { isDockerInstalled, isDockerRunning } from '../utils/docker';
import { loadEnv } from '../utils/env';
import { logger } from '../utils/logger';
import { type HealthCheckResult } from '../types';

/**
 * Check Node.js version
 */
async function checkNodeVersion(): Promise<HealthCheckResult> {
  try {
    const { stdout } = await exec('node', ['--version']);
    const version = stdout.trim().replace('v', '');
    const major = parseInt(version.split('.')[0], 10);

    if (major >= 20) {
      return {
        name: 'Node.js',
        status: 'pass',
        message: `v${version} (✓ >= 20.0.0)`,
      };
    } else {
      return {
        name: 'Node.js',
        status: 'fail',
        message: `v${version} (✗ requires >= 20.0.0)`,
      };
    }
  } catch (error) {
    return {
      name: 'Node.js',
      status: 'fail',
      message: 'Not installed',
    };
  }
}

/**
 * Check npm availability
 */
async function checkNpm(): Promise<HealthCheckResult> {
  const hasNpm = await commandExists('npm');

  if (!hasNpm) {
    return {
      name: 'npm',
      status: 'fail',
      message: 'Not installed',
    };
  }

  try {
    const { stdout } = await exec('npm', ['--version']);
    return {
      name: 'npm',
      status: 'pass',
      message: `v${stdout.trim()}`,
    };
  } catch (error) {
    return {
      name: 'npm',
      status: 'warn',
      message: 'Installed but not accessible',
    };
  }
}

/**
 * Check pnpm availability (optional)
 */
async function checkPnpm(): Promise<HealthCheckResult> {
  const hasPnpm = await commandExists('pnpm');

  if (!hasPnpm) {
    return {
      name: 'pnpm',
      status: 'warn',
      message: 'Not installed (optional)',
    };
  }

  try {
    const { stdout } = await exec('pnpm', ['--version']);
    return {
      name: 'pnpm',
      status: 'pass',
      message: `v${stdout.trim()}`,
    };
  } catch (error) {
    return {
      name: 'pnpm',
      status: 'warn',
      message: 'Installed but not accessible',
    };
  }
}

/**
 * Check Docker installation and status
 */
async function checkDocker(): Promise<HealthCheckResult> {
  const installed = await isDockerInstalled();

  if (!installed) {
    return {
      name: 'Docker',
      status: 'fail',
      message: 'Not installed (required for database)',
    };
  }

  const running = await isDockerRunning();

  if (!running) {
    return {
      name: 'Docker',
      status: 'warn',
      message: 'Installed but not running',
    };
  }

  try {
    const { stdout } = await exec('docker', ['--version']);
    const version = stdout.trim().replace('Docker version ', '').split(',')[0];
    return {
      name: 'Docker',
      status: 'pass',
      message: `v${version} (running)`,
    };
  } catch (error) {
    return {
      name: 'Docker',
      status: 'pass',
      message: 'Installed and running',
    };
  }
}

/**
 * Check PostgreSQL connection
 */
async function checkPostgres(): Promise<HealthCheckResult> {
  try {
    // Try to load env first
    const env = await loadEnv();
    const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;

    if (!dbUrl) {
      return {
        name: 'PostgreSQL',
        status: 'warn',
        message: 'DATABASE_URL not configured',
      };
    }

    // Try to connect using pg
    const { Client } = await import('pg');
    const client = new Client({ connectionString: dbUrl });

    try {
      await client.connect();
      const result = await client.query('SELECT version()');
      await client.end();

      const version = result.rows[0]?.version || '';
      const pgVersion = version.split(' ')[1] || 'unknown';

      return {
        name: 'PostgreSQL',
        status: 'pass',
        message: `v${pgVersion} (connected)`,
      };
    } catch (error) {
      await client.end().catch(() => {});

      return {
        name: 'PostgreSQL',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  } catch (error) {
    return {
      name: 'PostgreSQL',
      status: 'warn',
      message: 'Cannot check (database not configured)',
    };
  }
}

/**
 * Check Redis connection
 */
async function checkRedis(): Promise<HealthCheckResult> {
  try {
    // Try to load env first
    const env = await loadEnv();
    const redisUrl = env.REDIS_URL || process.env.REDIS_URL;

    if (!redisUrl) {
      return {
        name: 'Redis',
        status: 'warn',
        message: 'REDIS_URL not configured',
      };
    }

    // Try to connect using redis
    const { createClient } = await import('redis');
    const client = createClient({ url: redisUrl });

    try {
      await client.connect();
      const pong = await client.ping();
      await client.quit();

      return {
        name: 'Redis',
        status: 'pass',
        message: pong === 'PONG' ? 'Connected' : 'Connected (no PONG)',
      };
    } catch (error) {
      await client.quit().catch(() => {});

      return {
        name: 'Redis',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  } catch (error) {
    return {
      name: 'Redis',
      status: 'warn',
      message: 'Cannot check (Redis not configured)',
    };
  }
}

/**
 * Check Truxe ports availability
 */
async function checkPorts(): Promise<HealthCheckResult> {
  try {
    const portsStatus = await checkTruxePorts();
    const allAvailable = portsStatus.every(p => p.available);

    if (allAvailable) {
      return {
        name: 'Ports',
        status: 'pass',
        message: 'All Truxe ports available (3456, 5433, 6380)',
      };
    }

    const unavailable = portsStatus.filter(p => !p.available);
    const portsList = unavailable.map(p => `${p.port}${p.process ? ` (${p.process})` : ''}`).join(', ');

    return {
      name: 'Ports',
      status: 'warn',
      message: `Ports in use: ${portsList}`,
    };
  } catch (error) {
    return {
      name: 'Ports',
      status: 'warn',
      message: error instanceof Error ? error.message : 'Cannot check ports',
    };
  }
}

/**
 * Check environment configuration
 */
async function checkEnvironment(): Promise<HealthCheckResult> {
  try {
    const env = await loadEnv();
    const requiredVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_PRIVATE_KEY_PATH',
      'JWT_PUBLIC_KEY_PATH',
      'COOKIE_SECRET',
      'SESSION_SECRET',
    ];

    const missing = requiredVars.filter(key => !env[key]);

    if (missing.length === 0) {
      return {
        name: 'Environment',
        status: 'pass',
        message: 'All required variables configured',
      };
    }

    if (missing.length === requiredVars.length) {
      return {
        name: 'Environment',
        status: 'warn',
        message: 'No .env file found (run `truxe init` first)',
      };
    }

    return {
      name: 'Environment',
      status: 'warn',
      message: `Missing: ${missing.join(', ')}`,
    };
  } catch (error) {
    return {
      name: 'Environment',
      status: 'warn',
      message: 'No .env file found',
    };
  }
}

/**
 * Print health check result
 */
function printResult(result: HealthCheckResult): void {
  const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
  const color = result.status === 'pass' ? chalk.green : result.status === 'fail' ? chalk.red : chalk.yellow;

  console.log(`  ${color(icon)} ${result.name.padEnd(15)} ${result.message}`);
}

/**
 * Health command handler
 */
async function healthCommand(): Promise<void> {
  logger.section('System Health Check');

  const checks: Array<() => Promise<HealthCheckResult>> = [
    checkNodeVersion,
    checkNpm,
    checkPnpm,
    checkDocker,
    checkPostgres,
    checkRedis,
    checkPorts,
    checkEnvironment,
  ];

  const results: HealthCheckResult[] = [];

  for (const check of checks) {
    const result = await check();
    results.push(result);
    printResult(result);
  }

  console.log();

  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;

  if (failed > 0) {
    logger.error(`Health check failed: ${failed} critical issue(s), ${warned} warning(s)`);
    logger.info('\nFix critical issues before running Truxe:');
    results
      .filter(r => r.status === 'fail')
      .forEach(r => console.log(`  - ${r.name}: ${r.message}`));
    process.exit(1);
  } else if (warned > 0) {
    logger.warn(`Health check passed with warnings: ${warned} warning(s)`);
    logger.info('\nOptional improvements:');
    results
      .filter(r => r.status === 'warn')
      .forEach(r => console.log(`  - ${r.name}: ${r.message}`));
  } else {
    logger.success(`All checks passed! (${passed}/${results.length})`);
    logger.info('\n✓ Your system is ready to run Truxe');
  }
}

/**
 * Register health command
 */
export function registerHealthCommand(program: Command): void {
  program
    .command('health')
    .description('Check system dependencies and configuration')
    .action(async () => {
      try {
        await healthCommand();
      } catch (error) {
        logger.error('Health check failed:');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

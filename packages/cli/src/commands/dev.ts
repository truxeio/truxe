/**
 * Dev command - Start development server with Docker services
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { exec, commandExists } from '../utils/exec';
import { isDockerInstalled, isDockerRunning } from '../utils/docker';
import { checkTruxePorts, TRUXE_DEFAULT_PORTS } from '../utils/ports';
import { loadEnv } from '../utils/env';

interface DevOptions {
  skipHealthCheck?: boolean;
  skipDocker?: boolean;
  port?: number;
  verbose?: boolean;
}

/**
 * Check if JWT keys exist
 */
async function checkJWTKeys(): Promise<{ exists: boolean; privatePath: string; publicPath: string }> {
  const env = await loadEnv();
  const privatePath = env.JWT_PRIVATE_KEY_PATH || './keys/private.pem';
  const publicPath = env.JWT_PUBLIC_KEY_PATH || './keys/public.pem';

  const exists = existsSync(privatePath) && existsSync(publicPath);

  return { exists, privatePath, publicPath };
}

/**
 * Check if .env file exists
 */
function checkEnvFile(): boolean {
  return existsSync(join(process.cwd(), '.env'));
}

/**
 * Check if docker-compose.yml exists
 */
function checkDockerCompose(): boolean {
  return existsSync(join(process.cwd(), 'docker-compose.yml'));
}

/**
 * Start Docker services
 */
async function startDockerServices(): Promise<void> {
  logger.info('Starting Docker services...');

  const ora = (await import('ora')).default;
  const spinner = ora('Starting PostgreSQL and Redis...').start();

  try {
    // Check if services are already running
    const { stdout: psOutput } = await exec('docker-compose', ['ps', '-q']);
    const runningServices = psOutput.trim().split('\n').filter(Boolean);

    if (runningServices.length > 0) {
      spinner.info('Docker services already running');

      // Check health status
      const { stdout: healthOutput } = await exec('docker-compose', ['ps']);
      logger.debug('Docker services status:');
      logger.debug(healthOutput);
    } else {
      // Start services
      await exec('docker-compose', ['up', '-d']);
      spinner.succeed('Docker services started');
    }

    // Wait for services to be healthy
    spinner.start('Waiting for services to be ready...');

    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (attempts < maxAttempts) {
      try {
        const { stdout } = await exec('docker-compose', ['ps', '--format', 'json']);
        const services = stdout
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line));

        const allHealthy = services.every((service: any) =>
          service.Health === 'healthy' || service.Health === '' || service.State === 'running'
        );

        if (allHealthy && services.length > 0) {
          spinner.succeed('All services are ready');
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      } catch (error) {
        // docker-compose ps might fail on older versions without --format
        // Fall back to simple wait
        await new Promise(resolve => setTimeout(resolve, 2000));
        spinner.succeed('Docker services started (health check not available)');
        break;
      }
    }

    if (attempts >= maxAttempts) {
      spinner.warn('Services started but health check timed out');
      logger.info('Check status with: docker-compose ps');
    }

  } catch (error) {
    spinner.fail('Failed to start Docker services');

    if (error instanceof Error) {
      logger.error(error.message);

      // Provide helpful error messages
      if (error.message.includes('Cannot connect to the Docker daemon')) {
        logger.info('\nDocker daemon is not running. Start Docker Desktop and try again.');
      } else if (error.message.includes('no configuration file provided')) {
        logger.info('\nNo docker-compose.yml found. Run: truxe init');
      }
    }

    throw error;
  }
}

/**
 * Check database connection
 */
async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const env = await loadEnv();
    const dbUrl = env.DATABASE_URL;

    if (!dbUrl) {
      logger.warn('DATABASE_URL not configured in .env');
      return false;
    }

    logger.debug('Checking database connection...');

    const { Client } = await import('pg');
    const client = new Client({ connectionString: dbUrl });

    await client.connect();
    await client.query('SELECT 1');
    await client.end();

    logger.success('Database connection: OK');
    return true;
  } catch (error) {
    logger.warn('Database connection: FAILED');

    if (error instanceof Error) {
      logger.debug(error.message);

      if (error.message.includes('ECONNREFUSED')) {
        logger.info('PostgreSQL is not ready yet. It may take a few more seconds...');
      }
    }

    return false;
  }
}

/**
 * Check Redis connection
 */
async function checkRedisConnection(): Promise<boolean> {
  try {
    const env = await loadEnv();
    const redisUrl = env.REDIS_URL;

    if (!redisUrl) {
      logger.warn('REDIS_URL not configured in .env');
      return false;
    }

    logger.debug('Checking Redis connection...');

    const { createClient } = await import('redis');
    const client = createClient({ url: redisUrl });

    await client.connect();
    await client.ping();
    await client.quit();

    logger.success('Redis connection: OK');
    return true;
  } catch (error) {
    logger.warn('Redis connection: FAILED');

    if (error instanceof Error) {
      logger.debug(error.message);

      if (error.message.includes('ECONNREFUSED')) {
        logger.info('Redis is not ready yet. It may take a few more seconds...');
      }
    }

    return false;
  }
}

/**
 * Run pre-flight checks
 */
async function runPreflightChecks(options: DevOptions): Promise<boolean> {
  logger.section('Pre-flight Checks');

  let allPassed = true;

  // 1. Check .env file
  if (!checkEnvFile()) {
    logger.error('✗ .env file not found');
    logger.info('  Run: truxe init');
    allPassed = false;
  } else {
    logger.success('✓ .env file exists');
  }

  // 2. Check docker-compose.yml
  if (!options.skipDocker) {
    if (!checkDockerCompose()) {
      logger.error('✗ docker-compose.yml not found');
      logger.info('  Run: truxe init');
      allPassed = false;
    } else {
      logger.success('✓ docker-compose.yml exists');
    }
  }

  // 3. Check JWT keys
  const keysCheck = await checkJWTKeys();
  if (!keysCheck.exists) {
    logger.error('✗ JWT keys not found');
    logger.info(`  Run: truxe keys generate`);
    allPassed = false;
  } else {
    logger.success('✓ JWT keys exist');
  }

  // 4. Check Docker (if not skipped)
  if (!options.skipDocker) {
    const dockerInstalled = await isDockerInstalled();
    if (!dockerInstalled) {
      logger.error('✗ Docker not installed');
      logger.info('  Install Docker Desktop from https://docker.com/');
      allPassed = false;
    } else {
      const dockerRunning = await isDockerRunning();
      if (!dockerRunning) {
        logger.error('✗ Docker not running');
        logger.info('  Start Docker Desktop and try again');
        allPassed = false;
      } else {
        logger.success('✓ Docker is running');
      }
    }
  }

  // 5. Check ports availability (unless skipping health check)
  if (!options.skipHealthCheck) {
    const portsStatus = await checkTruxePorts();
    const unavailable = portsStatus.filter(p => !p.available);

    if (unavailable.length > 0) {
      logger.warn('⚠ Some Truxe ports are already in use:');
      unavailable.forEach(p => {
        const portName = p.port === TRUXE_DEFAULT_PORTS.API ? 'API' :
                        p.port === TRUXE_DEFAULT_PORTS.POSTGRES ? 'PostgreSQL' :
                        p.port === TRUXE_DEFAULT_PORTS.REDIS ? 'Redis' : 'Unknown';
        logger.info(`  ${portName} (${p.port}): ${p.process || 'unknown process'}`);
      });
      logger.info('  Services may fail to start. Stop conflicting processes or use different ports.');
    } else {
      logger.success('✓ All Truxe ports available (3456, 5433, 6380)');
    }
  }

  console.log();

  return allPassed;
}

/**
 * Wait for services to be ready with retries
 */
async function waitForServices(): Promise<void> {
  logger.info('Waiting for services to be ready...');

  const maxAttempts = 10;
  let dbReady = false;
  let redisReady = false;

  for (let i = 0; i < maxAttempts; i++) {
    if (!dbReady) {
      dbReady = await checkDatabaseConnection();
    }

    if (!redisReady) {
      redisReady = await checkRedisConnection();
    }

    if (dbReady && redisReady) {
      console.log();
      logger.success('All services ready!');
      return;
    }

    if (i < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log();

  if (!dbReady || !redisReady) {
    logger.warn('⚠ Some services did not become ready in time');
    logger.info('  The application may not work correctly');
    logger.info('  Check logs with: docker-compose logs');
  }
}

/**
 * Print development server info
 */
function printDevInfo(port: number): void {
  console.log();
  logger.section('Development Server');
  console.log();
  console.log(chalk.bold('Server Information:'));
  console.log(`  API URL:     ${chalk.cyan(`http://localhost:${port}`)}`);
  console.log(`  Health:      ${chalk.cyan(`http://localhost:${port}/health`)}`);
  console.log(`  API Docs:    ${chalk.cyan(`http://localhost:${port}/docs`)}`);
  console.log();
  console.log(chalk.bold('Services:'));
  console.log(`  PostgreSQL:  ${chalk.dim(`localhost:${TRUXE_DEFAULT_PORTS.POSTGRES}`)}`);
  console.log(`  Redis:       ${chalk.dim(`localhost:${TRUXE_DEFAULT_PORTS.REDIS}`)}`);
  console.log();
  console.log(chalk.bold('Useful Commands:'));
  console.log(`  ${chalk.cyan('docker-compose logs -f')}        View service logs`);
  console.log(`  ${chalk.cyan('docker-compose ps')}             Check service status`);
  console.log(`  ${chalk.cyan('docker-compose stop')}           Stop services`);
  console.log(`  ${chalk.cyan('docker-compose down')}           Stop and remove services`);
  console.log();
  console.log(chalk.dim('Press Ctrl+C to stop the development server'));
  console.log();
}

/**
 * Start the Truxe API server (placeholder)
 */
async function startTruxeServer(port: number): Promise<void> {
  logger.info('Starting Truxe API server...');

  // TODO: This is a placeholder. In a real implementation, this would:
  // 1. Check if @truxe/api is installed
  // 2. Start the API server using the appropriate command
  // 3. Monitor the process and restart on crashes
  // 4. Handle graceful shutdown

  logger.warn('⚠ API server start is not yet implemented');
  logger.info('  The CLI currently only manages Docker services');
  logger.info('  To start your Truxe server manually:');
  console.log();
  console.log(chalk.dim('    cd api'));
  console.log(chalk.dim('    npm run dev'));
  console.log();
}

/**
 * Dev command handler
 */
async function devCommand(options: DevOptions): Promise<void> {
  logger.section('Start Development Environment');
  console.log();

  try {
    // Run pre-flight checks
    if (!options.skipHealthCheck) {
      const checksPass = await runPreflightChecks(options);

      if (!checksPass) {
        logger.error('Pre-flight checks failed. Fix the issues above and try again.');
        process.exit(1);
      }
    }

    // Start Docker services (unless skipped)
    if (!options.skipDocker) {
      await startDockerServices();
      console.log();

      // Wait for services to be ready
      await waitForServices();
    } else {
      logger.info('Skipping Docker services (--skip-docker flag)');
      console.log();
    }

    // Print dev server info
    const port = options.port || 87001;
    printDevInfo(port);

    // Start Truxe API server (placeholder)
    await startTruxeServer(port);

    // Keep the process alive
    // In a real implementation, this would monitor the API server process
    logger.info('Development environment is running...');

  } catch (error) {
    logger.error('Failed to start development environment');

    if (error instanceof Error) {
      logger.error(error.message);

      if (process.env.TRUXE_VERBOSE === 'true' && error.stack) {
        logger.debug(error.stack);
      }
    }

    process.exit(1);
  }
}

/**
 * Register dev command
 */
export function registerDevCommand(program: Command): void {
  program
    .command('dev')
    .description('Start development server with Docker services')
    .option('--skip-health-check', 'Skip pre-flight health checks')
    .option('--skip-docker', 'Skip Docker service management')
    .option('-p, --port <port>', 'Port for API server', String(TRUXE_DEFAULT_PORTS.API))
    .action(async (options) => {
      try {
        await devCommand({
          skipHealthCheck: options.skipHealthCheck,
          skipDocker: options.skipDocker,
          port: options.port ? parseInt(options.port, 10) : TRUXE_DEFAULT_PORTS.API,
          verbose: process.env.TRUXE_VERBOSE === 'true',
        });
      } catch (error) {
        logger.error('Dev command failed:');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { ConfigManager } from '../utils/config';
import { PortManager } from '../utils/port-manager';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  message: string;
  details?: Record<string, unknown>;
  suggestions?: string[];
}

export function healthCommand(program: Command): void {
  program
    .command('health')
    .description('Check system health and dependencies')
    .addHelpText('after', `
Examples:
  $ truxe health
  $ truxe health --json
  $ truxe health --skip-docker
  $ truxe health --skip-db --skip-redis

Checks performed:
  ✓ Node.js version (>= 20.0.0)
  ✓ Package manager (npm/pnpm/yarn)
  ✓ Docker availability
  ✓ Port availability (87001, 87032, 87079)
  ✓ Environment variables
  ✓ PostgreSQL connection (if configured)
  ✓ Redis connection (if configured)

For more information, visit: https://docs.truxe.io/cli/health
    `)
    .option('--json', 'Output results as JSON')
    .option('--skip-docker', 'Skip Docker check')
    .option('--skip-db', 'Skip database check')
    .option('--skip-redis', 'Skip Redis check')
    .action(async (options: {
      json?: boolean;
      skipDocker?: boolean;
      skipDb?: boolean;
      skipRedis?: boolean;
    }) => {
      const logger = new Logger();
      
      try {
        if (!options.json) {
          logger.header('🏥 Truxe System Health Check');
          logger.blank();
        }
        
        const checks: HealthCheck[] = [];
        
        // Check Node.js version
        checks.push(await checkNodeVersion());
        
        // Check package manager
        checks.push(await checkPackageManager());
        
        // Check Docker (if not skipped)
        if (!options.skipDocker) {
          checks.push(await checkDocker());
        }
        
        // Check ports
        checks.push(await checkPorts());
        
        // Check environment variables
        checks.push(await checkEnvironmentVariables());
        
        // Check database (if not skipped and in Truxe project)
        if (!options.skipDb && ConfigManager.isTruxeProject()) {
          checks.push(await checkDatabase());
        }
        
        // Check Redis (if not skipped and in Truxe project)
        if (!options.skipRedis && ConfigManager.isTruxeProject()) {
          checks.push(await checkRedis());
        }
        
        // Display results
        if (options.json) {
          console.log(JSON.stringify(checks, null, 2));
        } else {
          displayHealthResults(checks, logger);
        }
        
        // Exit with appropriate code
        const hasFailures = checks.some(c => c.status === 'unhealthy');
        if (hasFailures) {
          process.exit(1);
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Health Check');
      }
    });
}

async function checkNodeVersion(): Promise<HealthCheck> {
  const spinner = ora('Checking Node.js version...').start();
  
  try {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0], 10);
    const requiredVersion = 20;
    
    if (majorVersion >= requiredVersion) {
      spinner.succeed(`Node.js ${version} (required: >= ${requiredVersion}.0.0)`);
      return {
        name: 'Node.js',
        status: 'healthy',
        message: `Version ${version} meets requirement (>= ${requiredVersion}.0.0)`,
        details: { version, required: `>= ${requiredVersion}.0.0` }
      };
    } else {
      spinner.fail(`Node.js ${version} (required: >= ${requiredVersion}.0.0)`);
      return {
        name: 'Node.js',
        status: 'unhealthy',
        message: `Version ${version} does not meet requirement (>= ${requiredVersion}.0.0)`,
        details: { version, required: `>= ${requiredVersion}.0.0` },
        suggestions: [
          'Update Node.js to version 20 or higher',
          'Use nvm to manage Node.js versions: nvm install 20',
          'Download from https://nodejs.org/'
        ]
      };
    }
  } catch (error) {
    spinner.fail('Failed to check Node.js version');
    return {
      name: 'Node.js',
      status: 'unhealthy',
      message: `Failed to check version: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    };
  }
}

async function checkPackageManager(): Promise<HealthCheck> {
  const spinner = ora('Checking package manager...').start();
  
  try {
    const packageManagers = {
      npm: { command: 'npm', versionFlag: '--version' },
      pnpm: { command: 'pnpm', versionFlag: '--version' },
      yarn: { command: 'yarn', versionFlag: '--version' }
    };
    
    const detected: Array<{ name: string; version: string }> = [];
    
    for (const [name, config] of Object.entries(packageManagers)) {
      try {
        const version = execSync(`${config.command} ${config.versionFlag}`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 5000
        }).trim();
        
        detected.push({ name, version });
      } catch {
        // Package manager not available
      }
    }
    
    if (detected.length > 0) {
      const primary = detected[0];
      spinner.succeed(`${primary.name} ${primary.version} detected`);
      
      return {
        name: 'Package Manager',
        status: 'healthy',
        message: `Detected: ${detected.map(pm => `${pm.name} ${pm.version}`).join(', ')}`,
        details: { detected }
      };
    } else {
      spinner.fail('No package manager detected');
      return {
        name: 'Package Manager',
        status: 'warning',
        message: 'No package manager detected (npm, pnpm, or yarn)',
        suggestions: [
          'Install npm (comes with Node.js)',
          'Or install pnpm: npm install -g pnpm',
          'Or install yarn: npm install -g yarn'
        ]
      };
    }
  } catch (error) {
    spinner.fail('Failed to check package manager');
    return {
      name: 'Package Manager',
      status: 'warning',
      message: `Failed to check: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    };
  }
}

async function checkDocker(): Promise<HealthCheck> {
  const spinner = ora('Checking Docker...').start();
  
  try {
    // Check if Docker is installed
    try {
      const dockerVersion = execSync('docker --version', {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 5000
      }).trim();
      
      // Check if Docker daemon is running
      try {
        execSync('docker info', {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 5000
        });
        
        spinner.succeed(`Docker installed and running (${dockerVersion})`);
        return {
          name: 'Docker',
          status: 'healthy',
          message: `Docker is installed and daemon is running`,
          details: { version: dockerVersion }
        };
      } catch {
        spinner.warn(`Docker installed but daemon not running (${dockerVersion})`);
        return {
          name: 'Docker',
          status: 'warning',
          message: 'Docker is installed but daemon is not running',
          details: { version: dockerVersion },
          suggestions: [
            'Start Docker Desktop or Docker daemon',
            'On macOS: Open Docker Desktop application',
            'On Linux: sudo systemctl start docker'
          ]
        };
      }
    } catch {
      spinner.fail('Docker not found');
      return {
        name: 'Docker',
        status: 'warning',
        message: 'Docker is not installed or not in PATH',
        suggestions: [
          'Install Docker Desktop from https://www.docker.com/products/docker-desktop',
          'Docker is optional but recommended for local development',
          'You can use SQLite instead of PostgreSQL for simpler setup'
        ]
      };
    }
  } catch (error) {
    spinner.fail('Failed to check Docker');
    return {
      name: 'Docker',
      status: 'warning',
      message: `Failed to check: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    };
  }
}

async function checkPorts(): Promise<HealthCheck> {
  const spinner = ora('Checking port availability...').start();
  
  try {
    const requiredPorts = [87001, 87032, 87079];
    const portManager = new PortManager();
    
    const results = await portManager.checkPorts(requiredPorts);
    const unavailable = results.filter(r => !r.available);
    
    if (unavailable.length === 0) {
      spinner.succeed(`All required ports available (${requiredPorts.join(', ')})`);
      return {
        name: 'Ports',
        status: 'healthy',
        message: `All required ports are available: ${requiredPorts.join(', ')}`,
        details: { ports: requiredPorts.map(p => ({ port: p, available: true })) }
      };
    } else {
      spinner.fail(`${unavailable.length} port(s) in use`);
      
      const suggestions: string[] = [];
      unavailable.forEach(result => {
        suggestions.push(`Port ${result.port} is in use by ${result.process || 'unknown process'}`);
        if (result.pid) {
          suggestions.push(`  Process ID: ${result.pid}`);
        }
      });
      
      return {
        name: 'Ports',
        status: 'unhealthy',
        message: `${unavailable.length} required port(s) are in use`,
        details: {
          ports: results.map(r => ({
            port: r.port,
            available: r.available,
            process: r.process,
            pid: r.pid
          }))
        },
        suggestions: [
          ...suggestions,
          'Stop the processes using these ports',
          'Or configure Truxe to use different ports'
        ]
      };
    }
  } catch (error) {
    spinner.fail('Failed to check ports');
    return {
      name: 'Ports',
      status: 'warning',
      message: `Failed to check ports: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    };
  }
}

async function checkEnvironmentVariables(): Promise<HealthCheck> {
  const spinner = ora('Checking environment variables...').start();
  
  try {
    const requiredVars = [
      'DATABASE_URL',
      'JWT_PRIVATE_KEY',
      'JWT_PUBLIC_KEY'
    ];
    
    const optionalVars = [
      'EMAIL_API_KEY',
      'REDIS_URL',
      'NODE_ENV'
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
    
    if (missing.length === 0) {
      spinner.succeed('Required environment variables are set');
      return {
        name: 'Environment Variables',
        status: 'healthy',
        message: 'All required environment variables are configured',
        details: {
          required: present,
          optional: optionalVars.filter(v => process.env[v])
        }
      };
    } else {
      spinner.fail(`${missing.length} required variable(s) missing`);
      return {
        name: 'Environment Variables',
        status: 'unhealthy',
        message: `Missing required environment variables: ${missing.join(', ')}`,
        details: {
          missing,
          present,
          optional: optionalVars.filter(v => process.env[v])
        },
        suggestions: [
          'Create a .env file in your project root',
          'Run `truxe init` to set up environment variables',
          'Or set them manually in your .env file'
        ]
      };
    }
  } catch (error) {
    spinner.fail('Failed to check environment variables');
    return {
      name: 'Environment Variables',
      status: 'warning',
      message: `Failed to check: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    };
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  const spinner = ora('Checking database connection...').start();
  
  try {
    const config = ConfigManager.loadConfig();
    const databaseUrl = config.database?.url || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      spinner.fail('Database URL not configured');
      return {
        name: 'Database',
        status: 'unhealthy',
        message: 'Database URL not configured',
        suggestions: [
          'Set DATABASE_URL in your .env file',
          'For SQLite: sqlite:./dev.db',
          'For PostgreSQL: postgresql://user:password@localhost:5432/truxe'
        ]
      };
    }
    
    // Check database type
    if (databaseUrl.startsWith('sqlite:')) {
      spinner.succeed('SQLite database configured');
      return {
        name: 'Database',
        status: 'healthy',
        message: 'SQLite database configured',
        details: { type: 'sqlite', url: databaseUrl }
      };
    }
    
    if (databaseUrl.startsWith('postgresql:') || databaseUrl.startsWith('postgres:')) {
      // Try to connect to PostgreSQL
      try {
        // Dynamic import for optional dependency
        let pg: any;
        try {
          pg = require('pg');
        } catch {
          spinner.fail('pg package not installed');
          return {
            name: 'Database',
            status: 'warning',
            message: 'PostgreSQL client (pg) not installed',
            suggestions: [
              'Install pg package: npm install pg',
              'Or use SQLite for development: sqlite:./dev.db'
            ]
          };
        }
        
        const { Client } = pg;
        const client = new Client({ connectionString: databaseUrl });
        
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        
        spinner.succeed('PostgreSQL connection successful');
        return {
          name: 'Database',
          status: 'healthy',
          message: 'PostgreSQL connection successful',
          details: { type: 'postgresql' }
        };
      } catch (error) {
        const message = (error as Error).message;
        spinner.fail('PostgreSQL connection failed');
        
        let suggestions: string[] = [];
        if (message.includes('ECONNREFUSED')) {
          suggestions = [
            'PostgreSQL server is not running',
            'Start PostgreSQL: docker-compose up -d postgres',
            'Or start your local PostgreSQL service'
          ];
        } else if (message.includes('authentication failed')) {
          suggestions = [
            'Check database credentials in DATABASE_URL',
            'Verify user has access to the database'
          ];
        } else if (message.includes('does not exist')) {
          suggestions = [
            'Create the database: createdb truxe',
            'Or update DATABASE_URL with correct database name'
          ];
        }
        
        return {
          name: 'Database',
          status: 'unhealthy',
          message: `PostgreSQL connection failed: ${message}`,
          details: { type: 'postgresql', error: message },
          suggestions
        };
      }
    }
    
    spinner.warn('Unknown database type');
    return {
      name: 'Database',
      status: 'warning',
      message: 'Unknown database type',
      details: { url: databaseUrl.split('@')[0] } // Hide credentials
    };
    
  } catch (error) {
    spinner.fail('Failed to check database');
    return {
      name: 'Database',
      status: 'warning',
      message: `Failed to check: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const spinner = ora('Checking Redis connection...').start();
  
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Try to connect to Redis
    try {
      // Dynamic import for optional dependency
      let redis: any;
      try {
        redis = require('redis');
      } catch {
        spinner.warn('redis package not installed');
        return {
          name: 'Redis',
          status: 'warning',
          message: 'Redis client not installed (optional for development)',
          details: { note: 'Redis is optional for development' }
        };
      }
      
      const client = redis.createClient({ url: redisUrl });
      
      await client.connect();
      await client.ping();
      await client.quit();
      
      spinner.succeed('Redis connection successful');
      return {
        name: 'Redis',
        status: 'healthy',
        message: 'Redis connection successful',
        details: { url: redisUrl }
      };
    } catch (error) {
      const message = (error as Error).message;
      spinner.fail('Redis connection failed');
      
      let suggestions: string[] = [];
      if (message.includes('ECONNREFUSED') || message.includes('connect')) {
        suggestions = [
          'Redis server is not running',
          'Start Redis: docker-compose up -d redis',
          'Or start your local Redis service: redis-server'
        ];
      } else {
        suggestions = [
          'Check REDIS_URL in your .env file',
          'Verify Redis server is accessible'
        ];
      }
      
      return {
        name: 'Redis',
        status: 'warning',
        message: `Redis connection failed: ${message}`,
        details: { url: redisUrl, error: message },
        suggestions
      };
    }
  } catch (error) {
    // Redis client not available
    spinner.warn('Redis client not available');
    return {
      name: 'Redis',
      status: 'warning',
      message: 'Redis check skipped (redis package not installed)',
      details: { note: 'Redis is optional for development' }
    };
  }
}

function displayHealthResults(checks: HealthCheck[], logger: Logger): void {
  logger.blank();
  logger.subheader('Health Check Results:');
  logger.blank();
  
  const tableData = checks.map(check => ({
    key: check.name,
    value: check.message,
    status: check.status === 'healthy' ? 'success' as const :
            check.status === 'unhealthy' ? 'error' as const : 'warning' as const
  }));
  
  logger.table(tableData);
  logger.blank();
  
  // Summary
  const healthy = checks.filter(c => c.status === 'healthy').length;
  const unhealthy = checks.filter(c => c.status === 'unhealthy').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  
  logger.info(`Summary: ${chalk.green(`${healthy} healthy`)} | ${chalk.red(`${unhealthy} unhealthy`)} | ${chalk.yellow(`${warnings} warnings`)}`);
  
  // Show suggestions for failed checks
  const failedChecks = checks.filter(c => c.status !== 'healthy');
  if (failedChecks.length > 0) {
    logger.blank();
    logger.subheader('Issues Found:');
    logger.blank();
    
    failedChecks.forEach(check => {
      const statusIcon = check.status === 'unhealthy' ? chalk.red('✗') : chalk.yellow('⚠');
      logger.log(`${statusIcon} ${chalk.bold(check.name)}: ${check.message}`);
      
      if (check.suggestions && check.suggestions.length > 0) {
        check.suggestions.forEach(suggestion => {
          logger.indent(`• ${suggestion}`);
        });
      }
      
      logger.blank();
    });
  }
  
  logger.blank();
  
  if (unhealthy === 0 && warnings === 0) {
    logger.success('🎉 All systems healthy!');
  } else if (unhealthy === 0) {
    logger.warning('⚠️  Some warnings found, but system is operational');
  } else {
    logger.error('❌ Some critical issues found. Please fix them before proceeding.');
  }
}


import { Command } from 'commander';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { ConfigManager } from '../utils/config';
import { StatusOptions, HealthStatus } from '../types';

export function statusCommand(program: Command): void {
  program
    .command('status')
    .description('Check Heimdall system health and status')
    .option('--check-all', 'Run all health checks')
    .option('--check-db', 'Check database connection')
    .option('--check-email', 'Check email service')
    .option('--check-jwt', 'Check JWT configuration')
    .option('--format <format>', 'Output format (table|json)', 'table')
    .action(async (options: StatusOptions) => {
      const logger = new Logger();
      
      try {
        logger.header('🛡️  Heimdall System Status');
        logger.blank();
        
        // Validate project
        if (!ConfigManager.isHeimdallProject()) {
          throw ErrorHandler.invalidProject();
        }
        
        // Load configuration
        const config = ConfigManager.loadConfig();
        
        // Determine which checks to run
        const checksToRun = determineChecks(options);
        
        // Run health checks
        const results = await runHealthChecks(checksToRun, config);
        
        // Display results
        displayResults(results, options.format || 'table');
        
        // Exit with appropriate code
        const hasFailures = results.some(r => r.status === 'unhealthy');
        if (hasFailures) {
          process.exit(1);
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Status Check');
      }
    });
}

function determineChecks(options: StatusOptions): string[] {
  const checks: string[] = [];
  
  if (options.checkAll) {
    return ['config', 'database', 'jwt', 'email', 'server'];
  }
  
  // Always check configuration
  checks.push('config');
  
  if (options.checkDb) checks.push('database');
  if (options.checkJwt) checks.push('jwt');
  if (options.checkEmail) checks.push('email');
  
  // If no specific checks requested, run basic checks
  if (checks.length === 1) {
    checks.push('database', 'jwt');
  }
  
  return checks;
}

async function runHealthChecks(checks: string[], config: any): Promise<HealthStatus[]> {
  const results: HealthStatus[] = [];
  
  for (const check of checks) {
    switch (check) {
      case 'config':
        results.push(await checkConfiguration(config));
        break;
      case 'database':
        results.push(await checkDatabase(config));
        break;
      case 'jwt':
        results.push(await checkJWT(config));
        break;
      case 'email':
        results.push(await checkEmail(config));
        break;
      case 'server':
        results.push(await checkServer(config));
        break;
    }
  }
  
  return results;
}

async function checkConfiguration(config: any): Promise<HealthStatus> {
  try {
    // Basic configuration validation
    const requiredKeys = [
      'database.url',
      'auth.jwt.algorithm',
      'email.provider'
    ];
    
    const missingKeys = requiredKeys.filter(key => {
      const value = getNestedValue(config, key);
      return value === undefined || value === null || value === '';
    });
    
    if (missingKeys.length > 0) {
      return {
        service: 'Configuration',
        status: 'unhealthy',
        message: `Missing required configuration: ${missingKeys.join(', ')}`,
        details: { missingKeys }
      };
    }
    
    return {
      service: 'Configuration',
      status: 'healthy',
      message: 'All required configuration present'
    };
    
  } catch (error) {
    return {
      service: 'Configuration',
      status: 'unhealthy',
      message: `Configuration error: ${(error as Error).message}`
    };
  }
}

async function checkDatabase(config: any): Promise<HealthStatus> {
  try {
    const databaseUrl = config.database?.url;
    
    if (!databaseUrl) {
      return {
        service: 'Database',
        status: 'unhealthy',
        message: 'Database URL not configured'
      };
    }
    
    // Determine database type
    const dbType = databaseUrl.startsWith('sqlite:') ? 'sqlite' : 
                   databaseUrl.startsWith('postgresql:') ? 'postgresql' : 'unknown';
    
    if (dbType === 'sqlite') {
      return await checkSQLiteDatabase(databaseUrl);
    } else if (dbType === 'postgresql') {
      return await checkPostgreSQLDatabase(databaseUrl);
    } else {
      return {
        service: 'Database',
        status: 'unknown',
        message: `Unsupported database type: ${dbType}`,
        details: { databaseUrl: databaseUrl.split('@')[0] } // Hide credentials
      };
    }
    
  } catch (error) {
    return {
      service: 'Database',
      status: 'unhealthy',
      message: `Database check failed: ${(error as Error).message}`
    };
  }
}

async function checkSQLiteDatabase(databaseUrl: string): Promise<HealthStatus> {
  try {
    const dbPath = databaseUrl.replace('sqlite:', '');
    const { existsSync } = require('fs');
    const { resolve } = require('path');
    
    const fullPath = resolve(dbPath);
    
    if (!existsSync(fullPath)) {
      return {
        service: 'Database',
        status: 'healthy',
        message: 'SQLite database will be created on first use',
        details: { path: fullPath, type: 'sqlite' }
      };
    }
    
    // Try to open and query the database
    const Database = require('better-sqlite3');
    const db = new Database(fullPath, { readonly: true });
    
    try {
      db.prepare('SELECT 1 as test').get();
      db.close();
      
      return {
        service: 'Database',
        status: 'healthy',
        message: 'SQLite database connection successful',
        details: { path: fullPath, type: 'sqlite' }
      };
    } catch (error) {
      db.close();
      throw error;
    }
    
  } catch (error) {
    return {
      service: 'Database',
      status: 'unhealthy',
      message: `SQLite error: ${(error as Error).message}`
    };
  }
}

async function checkPostgreSQLDatabase(databaseUrl: string): Promise<HealthStatus> {
  try {
    const { Client } = require('pg');
    const client = new Client({ connectionString: databaseUrl });
    
    await client.connect();
    
    try {
      await client.query('SELECT 1 as test');
      await client.end();
      
      return {
        service: 'Database',
        status: 'healthy',
        message: 'PostgreSQL database connection successful',
        details: { type: 'postgresql' }
      };
    } catch (error) {
      await client.end();
      throw error;
    }
    
  } catch (error) {
    const message = (error as Error).message;
    
    // Provide helpful error messages
    if (message.includes('ECONNREFUSED')) {
      return {
        service: 'Database',
        status: 'unhealthy',
        message: 'PostgreSQL server is not running or not accessible'
      };
    } else if (message.includes('authentication failed')) {
      return {
        service: 'Database',
        status: 'unhealthy',
        message: 'PostgreSQL authentication failed - check credentials'
      };
    } else if (message.includes('database') && message.includes('does not exist')) {
      return {
        service: 'Database',
        status: 'unhealthy',
        message: 'PostgreSQL database does not exist'
      };
    }
    
    return {
      service: 'Database',
      status: 'unhealthy',
      message: `PostgreSQL error: ${message}`
    };
  }
}

async function checkJWT(config: any): Promise<HealthStatus> {
  try {
    const jwtConfig = config.auth?.jwt;
    
    if (!jwtConfig) {
      return {
        service: 'JWT',
        status: 'unhealthy',
        message: 'JWT configuration missing'
      };
    }
    
    const algorithm = jwtConfig.algorithm || 'RS256';
    const privateKey = process.env.JWT_PRIVATE_KEY;
    const publicKey = process.env.JWT_PUBLIC_KEY;
    
    if (algorithm === 'RS256') {
      if (!privateKey || !publicKey) {
        return {
          service: 'JWT',
          status: 'unhealthy',
          message: 'JWT keys not configured for RS256 algorithm',
          details: {
            algorithm,
            hasPrivateKey: !!privateKey,
            hasPublicKey: !!publicKey
          }
        };
      }
      
      // Test key format
      try {
        const crypto = require('crypto');
        
        // Test private key
        crypto.createPrivateKey(privateKey.replace(/\\n/g, '\n'));
        
        // Test public key
        crypto.createPublicKey(publicKey.replace(/\\n/g, '\n'));
        
        return {
          service: 'JWT',
          status: 'healthy',
          message: 'JWT keys are valid',
          details: { algorithm }
        };
        
      } catch (keyError) {
        return {
          service: 'JWT',
          status: 'unhealthy',
          message: `Invalid JWT keys: ${(keyError as Error).message}`,
          details: { algorithm }
        };
      }
    } else {
      return {
        service: 'JWT',
        status: 'healthy',
        message: `JWT configured with ${algorithm} algorithm`,
        details: { algorithm }
      };
    }
    
  } catch (error) {
    return {
      service: 'JWT',
      status: 'unhealthy',
      message: `JWT check failed: ${(error as Error).message}`
    };
  }
}

async function checkEmail(config: any): Promise<HealthStatus> {
  try {
    const emailConfig = config.email;
    
    if (!emailConfig) {
      return {
        service: 'Email',
        status: 'unhealthy',
        message: 'Email configuration missing'
      };
    }
    
    const provider = emailConfig.provider;
    
    switch (provider) {
      case 'resend':
        return await checkResendEmail();
      case 'ses':
        return await checkSESEmail();
      case 'smtp':
        return await checkSMTPEmail(emailConfig);
      case 'development':
        return {
          service: 'Email',
          status: 'healthy',
          message: 'Development email provider (emails logged to console)',
          details: { provider: 'development' }
        };
      default:
        return {
          service: 'Email',
          status: 'unknown',
          message: `Unknown email provider: ${provider}`,
          details: { provider }
        };
    }
    
  } catch (error) {
    return {
      service: 'Email',
      status: 'unhealthy',
      message: `Email check failed: ${(error as Error).message}`
    };
  }
}

async function checkResendEmail(): Promise<HealthStatus> {
  const apiKey = process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    return {
      service: 'Email',
      status: 'unhealthy',
      message: 'Resend API key not configured',
      details: { provider: 'resend' }
    };
  }
  
  // Basic API key format validation
  if (!apiKey.startsWith('re_')) {
    return {
      service: 'Email',
      status: 'unhealthy',
      message: 'Invalid Resend API key format',
      details: { provider: 'resend' }
    };
  }
  
  return {
    service: 'Email',
    status: 'healthy',
    message: 'Resend email provider configured',
    details: { provider: 'resend' }
  };
}

async function checkSESEmail(): Promise<HealthStatus> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  if (!accessKeyId || !secretAccessKey) {
    return {
      service: 'Email',
      status: 'unhealthy',
      message: 'AWS credentials not configured for SES',
      details: { provider: 'ses' }
    };
  }
  
  return {
    service: 'Email',
    status: 'healthy',
    message: 'AWS SES email provider configured',
    details: { provider: 'ses' }
  };
}

async function checkSMTPEmail(emailConfig: any): Promise<HealthStatus> {
  const smtp = emailConfig.smtp;
  
  if (!smtp || !smtp.host) {
    return {
      service: 'Email',
      status: 'unhealthy',
      message: 'SMTP configuration incomplete',
      details: { provider: 'smtp' }
    };
  }
  
  return {
    service: 'Email',
    status: 'healthy',
    message: 'SMTP email provider configured',
    details: { 
      provider: 'smtp',
      host: smtp.host,
      port: smtp.port || 587
    }
  };
}

async function checkServer(config: any): Promise<HealthStatus> {
  try {
    const port = config.server?.port || 3001;
    
    // Try to connect to the server
    const fetch = (await import('node-fetch')).default;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`http://localhost:${port}/health`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const healthData = await response.json();
      
      return {
        service: 'Server',
        status: 'healthy',
        message: `Heimdall server running on port ${port}`,
        details: { 
          port,
          uptime: (healthData as any).uptime,
          version: (healthData as any).version
        }
      };
    } else {
      return {
        service: 'Server',
        status: 'unhealthy',
        message: `Server responded with status ${response.status}`,
        details: { port }
      };
    }
    
  } catch (error) {
    const message = (error as Error).message;
    
    if (message.includes('ECONNREFUSED')) {
      return {
        service: 'Server',
        status: 'unhealthy',
        message: 'Heimdall server is not running',
        details: { port: config.server?.port || 3001 }
      };
    }
    
    return {
      service: 'Server',
      status: 'unknown',
      message: `Server check failed: ${message}`
    };
  }
}

function displayResults(results: HealthStatus[], format: string): void {
  const logger = new Logger();
  
  if (format === 'json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  // Table format
  logger.subheader('Health Check Results:');
  logger.blank();
  
  const tableData = results.map(result => ({
    key: result.service,
    value: result.message || 'No message',
    status: result.status === 'healthy' ? 'success' as const : 
            result.status === 'unhealthy' ? 'error' as const : 'warning' as const
  }));
  
  logger.table(tableData);
  logger.blank();
  
  // Summary
  const healthy = results.filter(r => r.status === 'healthy').length;
  const unhealthy = results.filter(r => r.status === 'unhealthy').length;
  const unknown = results.filter(r => r.status === 'unknown').length;
  
  logger.info(`Summary: ${chalk.green(`${healthy} healthy`)} | ${chalk.red(`${unhealthy} unhealthy`)} | ${chalk.yellow(`${unknown} unknown`)}`);
  
  // Show details for failed checks
  const failedChecks = results.filter(r => r.status !== 'healthy');
  if (failedChecks.length > 0) {
    logger.blank();
    logger.subheader('Issues Found:');
    
    failedChecks.forEach(check => {
      logger.error(`${check.service}: ${check.message}`);
      
      if (check.details) {
        logger.indent(`Details: ${JSON.stringify(check.details, null, 2)}`);
      }
      
      // Provide suggestions based on service
      const suggestions = getSuggestions(check.service, check.message || '');
      if (suggestions.length > 0) {
        logger.indent('💡 Suggestions:');
        suggestions.forEach(suggestion => {
          logger.indent(`• ${suggestion}`, 2);
        });
      }
      
      logger.blank();
    });
  }
}

function getSuggestions(service: string, message: string): string[] {
  const suggestions: string[] = [];
  
  switch (service) {
    case 'Database':
      if (message.includes('not running')) {
        suggestions.push('Start your PostgreSQL server');
        suggestions.push('Check if Docker container is running');
      } else if (message.includes('authentication')) {
        suggestions.push('Check database credentials in DATABASE_URL');
        suggestions.push('Verify user has access to the database');
      } else if (message.includes('does not exist')) {
        suggestions.push('Create the database: createdb heimdall');
        suggestions.push('Run migrations: heimdall migrate up');
      }
      break;
      
    case 'JWT':
      if (message.includes('keys not configured')) {
        suggestions.push('Run: heimdall keys generate');
        suggestions.push('Set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables');
      } else if (message.includes('Invalid')) {
        suggestions.push('Regenerate JWT keys: heimdall keys generate --force');
        suggestions.push('Check for newline characters in environment variables');
      }
      break;
      
    case 'Email':
      if (message.includes('API key')) {
        suggestions.push('Get API key from your email provider');
        suggestions.push('Set EMAIL_API_KEY environment variable');
      } else if (message.includes('SMTP')) {
        suggestions.push('Check SMTP host and port configuration');
        suggestions.push('Verify SMTP credentials');
      }
      break;
      
    case 'Server':
      if (message.includes('not running')) {
        suggestions.push('Start the server: truxe.io');
        suggestions.push('Check if another process is using the port');
      }
      break;
  }
  
  return suggestions;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

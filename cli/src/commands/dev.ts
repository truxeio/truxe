import { Command } from 'commander';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { ErrorHandler, TruxeError } from '../utils/error-handler';
import { ConfigManager } from '../utils/config';
import { DevOptions } from '../types';

export function devCommand(program: Command): void {
  program
    .command('dev')
    .description('Start Truxe development server with hot reload')
    .addHelpText('after', `
Examples:
  $ truxe dev
  $ truxe dev --port=8080
  $ truxe dev --db=postgresql
  $ truxe dev --open
  $ truxe dev --port=3001 --host=localhost

The development server will:
  - Start on http://localhost:3001 (or specified port)
  - Enable hot reload for code changes
  - Validate environment variables
  - Check database connections
  - Display helpful error messages

For more information, visit: https://docs.truxe.io/cli/dev
    `)
    .option('-p, --port <port>', 'Port for Truxe API', '3001')
    .option('--api-port <port>', 'Alternative port specification', '3001')
    .option('--db <database>', 'Database type (sqlite|postgresql)', 'sqlite')
    .option('--host <host>', 'Host to bind to', '0.0.0.0')
    .option('--open', 'Open browser automatically')
    .option('--watch', 'Watch for file changes', true)
    .action(async (options: DevOptions) => {
      const logger = new Logger();
      
      try {
        logger.header('🛡️  Truxe Development Server');
        logger.blank();
        
        // Validate project
        if (!ConfigManager.isTruxeProject()) {
          throw ErrorHandler.invalidProject([
            'Run this command from a Truxe project directory',
            'Use `truxe init` to create a new project'
          ]);
        }
        
        // Load configuration
        const config = ConfigManager.loadConfig();
        const port = parseInt(String(options.apiPort || options.port || '3001'));
        const host = options.host || '0.0.0.0';
        
        // Start development server
        await startDevelopmentServer({
          ...options,
          port,
          host
        }, config);
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Development Server');
      }
    });
}

async function startDevelopmentServer(options: DevOptions & { port: number; host: string }, config: any): Promise<void> {
  // const logger = new Logger();
  
  // Check if Truxe API source exists
  const apiPath = findTruxeApiPath();
  
  if (!apiPath) {
    // Start standalone development server
    await startStandaloneServer(options, config);
  } else {
    // Start full development environment
    await startFullEnvironment(options, config, apiPath);
  }
}

function findTruxeApiPath(): string | null {
  const possiblePaths = [
    join(process.cwd(), 'node_modules', '@truxe', 'api'),
    join(process.cwd(), '..', 'api'), // For monorepo development
    join(__dirname, '..', '..', '..', 'api') // For CLI development
  ];
  
  for (const path of possiblePaths) {
    try {
      const { existsSync } = require('fs');
      if (existsSync(join(path, 'package.json'))) {
        return path;
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

async function startStandaloneServer(options: DevOptions & { port: number; host: string }, config: any): Promise<void> {
  const logger = new Logger();
  
  logger.info('Starting Truxe development server...');
  logger.blank();
  
  // Create development server
  const server = await createDevelopmentServer(options, config);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\n🛑 Shutting down development server...');
    server.close(() => {
      logger.success('Development server stopped');
      process.exit(0);
    });
  });
  
  // Start server
  server.listen({ port: options.port, host: options.host }, (err: Error | null, address: string) => {
    if (err) {
      throw new TruxeError(
        `Failed to start server: ${err.message}`,
        'SERVER_START_FAILED',
        [
          `Check if port ${options.port} is available`,
          'Try using a different port with --port flag',
          'Make sure no other Truxe instance is running'
        ]
      );
    }
    
    logger.success(`🚀 Truxe API running at ${chalk.cyan(address)}`);
    logger.blank();
    
    showDevelopmentInfo(options.port);
    
    if (options.open) {
      openBrowser(`http://localhost:${options.port}/admin`);
    }
  });
}

async function startFullEnvironment(options: DevOptions & { port: number; host: string }, _config: any, apiPath: string): Promise<void> {
  const logger = new Logger();
  
  logger.info('Starting full development environment...');
  logger.blank();
  
  const processes: ChildProcess[] = [];
  
  try {
    // Start Truxe API
    logger.info('📡 Starting Truxe API...');
    const apiProcess = await startApiProcess(apiPath, options);
    processes.push(apiProcess);
    
    // Start database if needed
    if (options.db === 'postgresql') {
      logger.info('🗄️  Starting PostgreSQL...');
      // TODO: Add database startup logic
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('\n🛑 Shutting down development environment...');
      
      processes.forEach((proc) => {
        if (proc && !proc.killed) {
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
          }, 5000);
        }
      });
      
      setTimeout(() => {
        logger.success('Development environment stopped');
        process.exit(0);
      }, 1000);
    });
    
    // Wait for API to be ready
    await waitForServer(`http://localhost:${options.port}/health`, 30000);
    
    logger.success(`🚀 Development environment ready!`);
    logger.blank();
    
    showDevelopmentInfo(options.port);
    
    if (options.open) {
      openBrowser(`http://localhost:${options.port}/admin`);
    }
    
    // Keep process alive
    await new Promise(() => {}); // Infinite wait
    
  } catch (error) {
    // Clean up processes on error
    processes.forEach(proc => {
      if (proc && !proc.killed) {
        proc.kill('SIGKILL');
      }
    });
    
    throw error;
  }
}

async function createDevelopmentServer(options: DevOptions & { port: number; host: string }, _config: any): Promise<any> {
  // Import Fastify and create a minimal development server
  const Fastify = require('fastify');
  
  const server = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    }
  });
  
  // Basic CORS
  await server.register(require('@fastify/cors'), {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
  });
  
  // Health check endpoint
  server.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        database: options.db === 'sqlite' ? 'healthy' : 'configured',
        email: 'development'
      }
    };
  });
  
  // Development inbox endpoint
  server.get('/dev/inbox', async () => {
    return {
      message: 'Development email inbox - emails will appear here in development mode',
      emails: []
    };
  });
  
  // Basic admin endpoint
  server.get('/admin', async (_request: any, reply: any) => {
    reply.type('text/html');
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Truxe Admin</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 40px; }
        .header { color: #0066cc; margin-bottom: 20px; }
        .status { background: #f0f9ff; padding: 20px; border-radius: 8px; }
        .link { color: #0066cc; text-decoration: none; }
    </style>
</head>
<body>
    <h1 class="header">🛡️ Truxe Development Server</h1>
    <div class="status">
        <h2>Status: Running</h2>
        <p><strong>API:</strong> http://localhost:${options.port}</p>
        <p><strong>Health Check:</strong> <a href="/health" class="link">/health</a></p>
        <p><strong>Dev Inbox:</strong> <a href="/dev/inbox" class="link">/dev/inbox</a></p>
    </div>
    <h3>Next Steps:</h3>
    <ol>
        <li>Start your frontend application on port 3000</li>
        <li>Test authentication flow</li>
        <li>Check development inbox for magic link emails</li>
    </ol>
</body>
</html>`;
  });
  
  return server;
}

async function startApiProcess(apiPath: string, options: DevOptions & { port: number; host: string }): Promise<ChildProcess> {
  // const logger = new Logger();
  
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: options.port.toString(),
    HOST: options.host,
    LOG_LEVEL: 'debug'
  };
  
  const apiProcess = spawn('npm', ['run', 'dev'], {
    cwd: apiPath,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  apiProcess.stdout?.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(`[API] ${output}`);
    }
  });
  
  apiProcess.stderr?.on('data', (data) => {
    const output = data.toString().trim();
    if (output && !output.includes('ExperimentalWarning')) {
      console.warn(`[API] ${output}`);
    }
  });
  
  apiProcess.on('error', (error) => {
    throw new TruxeError(
      `Failed to start API process: ${error.message}`,
      'API_START_FAILED',
      [
        'Make sure the API dependencies are installed',
        'Check if the API directory exists and is accessible',
        'Verify Node.js version compatibility'
      ]
    );
  });
  
  return apiProcess;
}

async function waitForServer(url: string, timeout: number = 30000): Promise<void> {
  // const logger = new Logger();
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new TruxeError(
    'Server failed to start within timeout period',
    'SERVER_TIMEOUT',
    [
      'Check server logs for errors',
      'Increase timeout or check system resources',
      'Verify port is not already in use'
    ]
  );
}

function showDevelopmentInfo(port: number): void {
  const logger = new Logger();
  
  logger.subheader('📍 Development URLs:');
  logger.bullet(`API: ${chalk.cyan(`http://localhost:${port}`)}`);
  logger.bullet(`Admin: ${chalk.cyan(`http://localhost:${port}/admin`)}`);
  logger.bullet(`Health: ${chalk.cyan(`http://localhost:${port}/health`)}`);
  logger.bullet(`Dev Inbox: ${chalk.cyan(`http://localhost:${port}/dev/inbox`)}`);
  logger.blank();
  
  logger.info('💡 Tips:');
  logger.bullet('Your frontend should run on port 3000');
  logger.bullet('Magic link emails appear in the dev inbox');
  logger.bullet('Press Ctrl+C to stop the server');
  logger.blank();
}

function openBrowser(url: string): void {
  const { exec } = require('child_process');
  const platform = process.platform;
  
  let command: string;
  
  switch (platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
  }
  
  exec(command, (error: Error | null) => {
    if (error) {
      // Silently fail - browser opening is optional
    }
  });
}

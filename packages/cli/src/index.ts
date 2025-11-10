import { Command, program } from 'commander';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger';
import { registerHealthCommand } from './commands/health';
import { registerKeysCommand } from './commands/keys';
import { registerInitCommand } from './commands/init';
import { registerDevCommand } from './commands/dev';
import { registerMigrateCommand } from './commands/migrate';

// Get package.json for version info
// Handle both ESM (development) and CommonJS (bundled) environments
function getPackageJsonPath(): string {
  try {
    // ESM: use import.meta.url
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      return join(__dirname, '..', 'package.json');
    }
  } catch {
    // Fall through to CommonJS
  }

  // CommonJS: use require (will be available after bundling)
   
  return require.resolve('../package.json');
}

const packageJsonPath = getPackageJsonPath();
const packageJson = JSON.parse(
  readFileSync(packageJsonPath, 'utf-8')
);

// Check for updates (only in non-CI environments)
if (!process.env.CI && !process.env.SKIP_UPDATE_CHECK) {
  const notifier = updateNotifier({ pkg: packageJson });
  if (notifier.update) {
    notifier.notify({
      defer: false,
      message: `Update available: ${chalk.dim(notifier.update.current)} → ${chalk.green(
        notifier.update.latest
      )}\nRun ${chalk.cyan('npm i -g @truxe/cli')} to update`,
    });
  }
}

// Configure main program with enhanced help and error handling
program
  .name('truxe')
  .description('Truxe CLI - Set up authentication in 5 minutes')
  .version(
    packageJson.version,
    '-V, --version',
    'Display version number'
  )
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--no-color', 'Disable colored output')
  .addHelpText(
    'after',
    `
Examples:
  $ truxe init my-project        Initialize a new Truxe project
  $ truxe dev                    Start development server
  $ truxe keys generate          Generate JWT keys
  $ truxe migrate                Run database migrations
  $ truxe health                 Check system health

For more information, visit: ${chalk.cyan('https://truxe.io/docs')}
    `
  )
  .hook('preAction', (thisCommand: Command) => {
    // Set global options
    const opts = thisCommand.opts();
    process.env.TRUXE_VERBOSE = opts.verbose ? 'true' : 'false';
    if (opts.noColor) {
      chalk.level = 0;
    }
  })
  .configureHelp({
    sortSubcommands: true,
    subcommandTerm: (cmd) => cmd.name(),
  });

// Register implemented commands
registerHealthCommand(program);
registerKeysCommand(program);
registerInitCommand(program);
registerDevCommand(program);
registerMigrateCommand(program);

// Enhanced global error handling
process.on('unhandledRejection', (reason: unknown) => {
  if (reason instanceof Error) {
    logger.error('Unhandled Promise Rejection:');
    logger.error(reason.message);
    if (process.env.TRUXE_VERBOSE === 'true' && reason.stack) {
      logger.debug(reason.stack);
    }
  } else {
    logger.error('Unhandled Promise Rejection:', String(reason));
  }
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:');
  logger.error(error.message);
  if (process.env.TRUXE_VERBOSE === 'true' && error.stack) {
    logger.debug(error.stack);
  }
  process.exit(1);
});

// Handle SIGINT gracefully
process.on('SIGINT', () => {
  logger.info('\nOperation cancelled by user');
  process.exit(130);
});

// Handle SIGTERM gracefully
process.on('SIGTERM', () => {
  logger.info('\nProcess terminated');
  process.exit(143);
});

// Parse CLI arguments with error handling
try {
  program.parse();
  
  // If no command provided, show help
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
} catch (error) {
  if (error instanceof Error) {
    logger.error(error.message);
    if (process.env.TRUXE_VERBOSE === 'true' && error.stack) {
      logger.debug(error.stack);
    }
  } else {
    logger.error('An unexpected error occurred:', String(error));
  }
  process.exit(1);
}


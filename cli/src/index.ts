#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';
import { readFileSync } from 'fs';
import { join } from 'path';
import { initCommand } from './commands/init';
import { devCommand } from './commands/dev';
import { migrateCommand } from './commands/migrate';
import { configCommand } from './commands/config';
import { statusCommand } from './commands/status';
import { portsCommand } from './commands/ports';
import { dashboardCommand } from './commands/dashboard';
import { ErrorHandler } from './utils/error-handler';

// Get package.json for version info
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

// Check for updates
const notifier = updateNotifier({ pkg: packageJson });
if (notifier.update) {
  notifier.notify({
    defer: false,
    message: `Update available: ${chalk.dim(notifier.update.current)} → ${chalk.green(
      notifier.update.latest
    )}\nRun ${chalk.cyan('npm i -g @heimdall/cli')} to update`,
  });
}

// Configure main program
program
  .name('heimdall')
  .description('Heimdall CLI - Set up authentication in 5 minutes')
  .version(packageJson.version)
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--no-color', 'Disable colored output')
  .hook('preAction', (thisCommand) => {
    // Set global options
    const opts = thisCommand.opts();
    process.env.TRUXE_VERBOSE = opts.verbose ? 'true' : 'false';
    if (opts.noColor) {
      chalk.level = 0;
    }
  });

// Register commands
initCommand(program);
devCommand(program);
migrateCommand(program);
configCommand(program);
statusCommand(program);
portsCommand(program);
dashboardCommand(program);

// Global error handling
process.on('unhandledRejection', (reason, _promise) => {
  ErrorHandler.handleUnexpected(reason as Error, 'Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
  ErrorHandler.handleUnexpected(error, 'Uncaught Exception');
});

// Parse CLI arguments
program.parse();

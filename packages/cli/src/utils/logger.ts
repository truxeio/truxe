/**
 * Logger utility for colored console output
 * Provides consistent logging with chalk for better UX
 */

import chalk from 'chalk';

export interface LoggerOptions {
  verbose?: boolean;
  noColor?: boolean;
}

class Logger {
  private verbose: boolean;
  private noColor: boolean;

  constructor(options: LoggerOptions = {}) {
    this.verbose = options.verbose ?? process.env.TRUXE_VERBOSE === 'true';
    this.noColor = options.noColor ?? false;
  }

  /**
   * Log informational message
   */
  info(message: string, ...args: unknown[]): void {
    const prefix = this.noColor ? 'ℹ' : chalk.blue('ℹ');
    console.log(`${prefix} ${message}`, ...args);
  }

  /**
   * Log success message
   */
  success(message: string, ...args: unknown[]): void {
    const prefix = this.noColor ? '✓' : chalk.green('✓');
    console.log(`${prefix} ${message}`, ...args);
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    const prefix = this.noColor ? '✗' : chalk.red('✗');
    console.error(`${prefix} ${message}`, ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    const prefix = this.noColor ? '⚠' : chalk.yellow('⚠');
    console.warn(`${prefix} ${message}`, ...args);
  }

  /**
   * Log debug message (only in verbose mode)
   */
  debug(message: string, ...args: unknown[]): void {
    if (!this.verbose) return;
    const prefix = this.noColor ? '🔍' : chalk.gray('🔍');
    console.log(`${prefix} ${message}`, ...args);
  }

  /**
   * Log raw message without prefix
   */
  log(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  }

  /**
   * Create a section header
   */
  section(title: string): void {
    const line = this.noColor ? '─'.repeat(50) : chalk.gray('─'.repeat(50));
    console.log('');
    console.log(this.noColor ? title : chalk.bold(title));
    console.log(line);
  }

  /**
   * Create a divider
   */
  divider(): void {
    const line = this.noColor ? '─'.repeat(50) : chalk.gray('─'.repeat(50));
    console.log(line);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for custom instances
export { Logger };


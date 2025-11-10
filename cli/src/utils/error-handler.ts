import { Logger } from './logger';

export class TruxeError extends Error {
  constructor(
    message: string,
    public code: string = 'TRUXE_ERROR',
    public suggestions: string[] = []
  ) {
    super(message);
    this.name = 'TruxeError';
  }
}

export class ErrorHandler {
  private static logger = new Logger();

  static handle(error: Error, context?: string): void {
    if (error instanceof TruxeError) {
      this.handleTruxeError(error, context);
    } else {
      this.handleGenericError(error, context);
    }
  }

  static handleTruxeError(error: TruxeError, context?: string): void {
    this.logger.error(context ? `[${context}] ${error.message}` : error.message);
    
    if (error.suggestions.length > 0) {
      this.logger.info('\n💡 Suggestions:');
      error.suggestions.forEach((suggestion, index) => {
        this.logger.info(`   ${index + 1}. ${suggestion}`);
      });
    }

    process.exit(1);
  }

  static handleGenericError(error: Error, context?: string): void {
    const message = context ? `[${context}] ${error.message}` : error.message;
    this.logger.error(message);
    
    if (process.env.TRUXE_VERBOSE === 'true') {
      this.logger.debug('\n🐛 Stack trace:');
      this.logger.debug(error.stack || 'No stack trace available');
    }

    this.logger.info('\n💡 Need help? Check out:');
    this.logger.info('   • Documentation: https://docs.truxe.io');
    this.logger.info('   • GitHub Issues: https://github.com/truxe-auth/truxe/issues');
    this.logger.info('   • Discord: https://discord.gg/truxe');

    process.exit(1);
  }

  static handleUnexpected(error: Error, type: string): void {
    this.logger.error(`${type}: ${error.message}`);
    
    if (process.env.TRUXE_VERBOSE === 'true') {
      this.logger.debug(error.stack || 'No stack trace available');
    }

    this.logger.info('\n🚨 This is an unexpected error. Please report it:');
    this.logger.info('   • GitHub Issues: https://github.com/truxe-auth/truxe/issues/new');
    this.logger.info('   • Include the error message and steps to reproduce');

    process.exit(1);
  }

  // Common error factories
  static invalidProject(suggestions: string[] = []): TruxeError {
    return new TruxeError(
      'Not a Truxe project. Run this command from a project root or initialize a new project.',
      'INVALID_PROJECT',
      [
        'Run `truxe init` to create a new project',
        'Make sure you\'re in the correct directory',
        ...suggestions
      ]
    );
  }

  static missingDependency(dependency: string, installCommand: string): TruxeError {
    return new TruxeError(
      `Missing dependency: ${dependency}`,
      'MISSING_DEPENDENCY',
      [
        `Install with: ${installCommand}`,
        'Make sure all dependencies are installed',
        'Check your package.json file'
      ]
    );
  }

  static configurationError(message: string, suggestions: string[] = []): TruxeError {
    return new TruxeError(
      `Configuration error: ${message}`,
      'CONFIGURATION_ERROR',
      [
        'Check your truxe.config.js file',
        'Verify environment variables are set',
        'Run `truxe status` to check configuration',
        ...suggestions
      ]
    );
  }

  static databaseError(message: string, suggestions: string[] = []): TruxeError {
    return new TruxeError(
      `Database error: ${message}`,
      'DATABASE_ERROR',
      [
        'Check your DATABASE_URL environment variable',
        'Ensure your database server is running',
        'Run `truxe migrate` to apply migrations',
        'Run `truxe status --check-db` to test connection',
        ...suggestions
      ]
    );
  }

  static networkError(message: string, suggestions: string[] = []): TruxeError {
    return new TruxeError(
      `Network error: ${message}`,
      'NETWORK_ERROR',
      [
        'Check your internet connection',
        'Verify firewall settings',
        'Try again in a few moments',
        ...suggestions
      ]
    );
  }
}

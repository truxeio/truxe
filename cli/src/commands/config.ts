import { Command } from 'commander';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { ConfigManager } from '../utils/config';

export function configCommand(program: Command): void {
  const config = program
    .command('config')
    .description('Manage Truxe configuration')
    .addHelpText('after', `
Examples:
  $ truxe config set database.url "postgresql://localhost:5432/mydb"
  $ truxe config set multiTenant.enabled true
  $ truxe config get database.url
  $ truxe config get --all
  $ truxe config validate
  $ truxe config show

For more information, visit: https://docs.truxe.io/cli/config
    `);

  // Set configuration value
  config
    .command('set <key> <value>')
    .description('Set a configuration value')
    .addHelpText('after', `
Examples:
  $ truxe config set database.url "postgresql://localhost:5432/mydb"
  $ truxe config set multiTenant.enabled true
  $ truxe config set server.port 8080
    `)
    .action(async (key: string, value: string) => {
      const logger = new Logger();
      
      try {
        logger.header('⚙️  Truxe Configuration');
        logger.blank();
        
        // Validate project
        if (!ConfigManager.isTruxeProject()) {
          throw ErrorHandler.invalidProject();
        }
        
        // Set configuration value
        ConfigManager.setValue(key, value);
        
        logger.success(`Set ${chalk.cyan(key)} = ${chalk.yellow(value)}`);
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Configuration');
      }
    });

  // Get configuration value
  config
    .command('get [key]')
    .description('Get configuration value(s)')
    .addHelpText('after', `
Examples:
  $ truxe config get database.url
  $ truxe config get --all
  $ truxe config get multiTenant.enabled
    `)
    .option('-a, --all', 'Show all configuration values')
    .action(async (key: string | undefined, options: { all?: boolean }) => {
      const logger = new Logger();
      
      try {
        logger.header('⚙️  Truxe Configuration');
        logger.blank();
        
        // Validate project
        if (!ConfigManager.isTruxeProject()) {
          throw ErrorHandler.invalidProject();
        }
        
        if (key) {
          // Get specific key
          const configValue = ConfigManager.getValue(key);
          
          if (configValue) {
            logger.subheader(`Configuration: ${key}`);
            logger.blank();
            
            logger.info(`Value: ${chalk.yellow(JSON.stringify(configValue.value, null, 2))}`);
            logger.info(`Source: ${chalk.dim(configValue.source)}`);
            
            if (configValue.description) {
              logger.info(`Description: ${configValue.description}`);
            }
          } else {
            logger.warning(`Configuration key '${key}' not found`);
            logger.blank();
            logger.info('💡 Use `truxe config get --all` to see all available keys');
          }
          
        } else if (options.all) {
          // Get all configuration
          const allConfig = ConfigManager.listValues();
          
          if (allConfig.length === 0) {
            logger.info('No configuration found');
            return;
          }
          
          logger.subheader('All Configuration:');
          logger.blank();
          
          // Group by category
          const grouped = groupConfigByCategory(allConfig);
          
          Object.entries(grouped).forEach(([category, values]) => {
            logger.info(`${chalk.bold(category)}:`);
            
            values.forEach(config => {
              const sourceIcon = config.source === 'env' ? '🔒' : '📄';
              const value = typeof config.value === 'string' 
                ? config.value 
                : JSON.stringify(config.value);
              
              logger.indent(`${sourceIcon} ${chalk.cyan(config.key.split('.').pop())} = ${chalk.yellow(value)}`);
              
              if (config.description) {
                logger.indent(`  ${chalk.dim(config.description)}`, 2);
              }
            });
            
            logger.blank();
          });
          
          logger.info('Legend:');
          logger.bullet('🔒 Environment variable');
          logger.bullet('📄 Configuration file');
          
        } else {
          // Show usage
          logger.info('Usage:');
          logger.bullet('`truxe config get <key>` - Get specific value');
          logger.bullet('`truxe config get --all` - Show all configuration');
          logger.blank();
          
          logger.info('Common keys:');
          logger.bullet('database.url');
          logger.bullet('auth.jwt.algorithm');
          logger.bullet('email.provider');
          logger.bullet('multiTenant.enabled');
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Configuration');
      }
    });

  // List configuration keys
  config
    .command('list')
    .description('List all configuration keys')
    .option('--keys-only', 'Show only key names')
    .action(async (options: { keysOnly?: boolean }) => {
      const logger = new Logger();
      
      try {
        logger.header('⚙️  Configuration Keys');
        logger.blank();
        
        // Validate project
        if (!ConfigManager.isTruxeProject()) {
          throw ErrorHandler.invalidProject();
        }
        
        const allConfig = ConfigManager.listValues();
        
        if (allConfig.length === 0) {
          logger.info('No configuration found');
          return;
        }
        
        if (options.keysOnly) {
          allConfig.forEach(config => {
            logger.log(config.key);
          });
        } else {
          const grouped = groupConfigByCategory(allConfig);
          
          Object.entries(grouped).forEach(([category, values]) => {
            logger.subheader(category);
            
            values.forEach(config => {
              const description = config.description ? ` - ${config.description}` : '';
              logger.bullet(`${chalk.cyan(config.key)}${description}`);
            });
            
            logger.blank();
          });
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Configuration');
      }
    });

  // Validate configuration
  config
    .command('validate')
    .description('Validate current configuration')
    .action(async () => {
      const logger = new Logger();
      
      try {
        logger.header('✅ Configuration Validation');
        logger.blank();
        
        // Validate project
        if (!ConfigManager.isTruxeProject()) {
          throw ErrorHandler.invalidProject();
        }
        
        // Load and validate configuration
        const config = ConfigManager.loadConfig();
        const issues = validateConfiguration(config);
        
        if (issues.length === 0) {
          logger.success('✅ Configuration is valid');
        } else {
          logger.warning('⚠️  Configuration issues found:');
          logger.blank();
          
          issues.forEach(issue => {
            logger.error(`❌ ${issue.message}`);
            
            if (issue.suggestions.length > 0) {
              issue.suggestions.forEach(suggestion => {
                logger.indent(`💡 ${suggestion}`);
              });
            }
            
            logger.blank();
          });
          
          process.exit(1);
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Configuration Validation');
      }
    });

  // Reset configuration
  config
    .command('reset')
    .description('Reset configuration to defaults')
    .option('--confirm', 'Confirm the reset operation')
    .action(async (options: { confirm?: boolean }) => {
      const logger = new Logger();
      
      try {
        logger.header('🔄 Reset Configuration');
        logger.blank();
        
        // Validate project
        if (!ConfigManager.isTruxeProject()) {
          throw ErrorHandler.invalidProject();
        }
        
        if (!options.confirm) {
          logger.warning('This will reset all configuration to defaults');
          logger.info('Use --confirm flag to proceed');
          return;
        }
        
        // Reset to default configuration
        const defaultConfig = {
          database: {
            url: 'sqlite:./dev.db',
            ssl: false,
            poolSize: 10,
          },
          auth: {
            magicLink: {
              enabled: true,
              expiryMinutes: 15,
            },
            jwt: {
              algorithm: 'RS256' as const,
              accessTokenTTL: '15m',
              refreshTokenTTL: '30d',
            },
            session: {
              maxConcurrent: 5,
              deviceTracking: true,
            },
          },
          multiTenant: {
            enabled: false,
            defaultRole: 'member',
            allowSignup: true,
          },
          email: {
            provider: 'resend' as const,
            from: 'noreply@localhost',
          },
          rateLimit: {
            magicLink: '5/minute',
            apiRequests: '1000/hour',
          },
        };
        
        ConfigManager.saveConfig(defaultConfig);
        
        logger.success('Configuration reset to defaults');
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Configuration Reset');
      }
    });
}

function groupConfigByCategory(configs: Array<{ key: string; value: unknown; source: string; description?: string }>): Record<string, typeof configs> {
  const groups: Record<string, typeof configs> = {};
  
  configs.forEach(config => {
    const category = config.key.split('.')[0];
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    
    if (!groups[categoryName]) {
      groups[categoryName] = [];
    }
    
    groups[categoryName].push(config);
  });
  
  return groups;
}

function validateConfiguration(config: any): Array<{ message: string; suggestions: string[] }> {
  const issues: Array<{ message: string; suggestions: string[] }> = [];
  
  // Database validation
  if (!config.database?.url) {
    issues.push({
      message: 'Database URL is required',
      suggestions: [
        'Set DATABASE_URL environment variable',
        'Configure database.url in truxe.config.yaml'
      ]
    });
  }
  
  // JWT validation
  if (config.auth?.jwt?.algorithm === 'RS256') {
    if (!process.env.JWT_PRIVATE_KEY || !process.env.JWT_PUBLIC_KEY) {
      issues.push({
        message: 'JWT keys are required for RS256 algorithm',
        suggestions: [
          'Run `truxe keys generate` to create keys',
          'Set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables'
        ]
      });
    }
  }
  
  // Email validation
  if (config.email?.provider === 'resend' && !process.env.EMAIL_API_KEY && !process.env.RESEND_API_KEY) {
    issues.push({
      message: 'Email API key is required for Resend provider',
      suggestions: [
        'Set EMAIL_API_KEY or RESEND_API_KEY environment variable',
        'Get API key from https://resend.com'
      ]
    });
  }
  
  // Multi-tenant validation
  if (config.multiTenant?.enabled && !config.multiTenant?.defaultRole) {
    issues.push({
      message: 'Default role is required when multi-tenant mode is enabled',
      suggestions: [
        'Set multiTenant.defaultRole in configuration',
        'Common values: member, user, viewer'
      ]
    });
  }
  
  return issues;
}

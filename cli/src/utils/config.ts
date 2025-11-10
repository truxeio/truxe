import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { config as loadEnv } from 'dotenv';
import { TruxeConfig, ConfigValue } from '../types';
import { Logger } from './logger';
import { TruxeError } from './error-handler';

export class ConfigManager {
  private static logger = new Logger();
  private static configCache: Partial<TruxeConfig> | null = null;

  static getProjectRoot(): string {
    let currentDir = process.cwd();
    
    // Look for truxe.config.js, package.json with truxe, or .truxe directory
    while (currentDir !== '/') {
      const configFiles = [
        'truxe.config.js',
        'truxe.config.ts',
        'truxe.config.yaml',
        'truxe.config.yml'
      ];
      
      for (const file of configFiles) {
        if (existsSync(join(currentDir, file))) {
          return currentDir;
        }
      }
      
      // Check for package.json with truxe config
      const packageJsonPath = join(currentDir, 'package.json');
      if (existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.truxe) {
            return currentDir;
          }
        } catch {
          // Continue searching
        }
      }
      
      // Check for .truxe directory
      if (existsSync(join(currentDir, '.truxe'))) {
        return currentDir;
      }
      
      currentDir = join(currentDir, '..');
    }
    
    throw new TruxeError(
      'Not a Truxe project',
      'INVALID_PROJECT',
      [
        'Run `truxe init` to create a new project',
        'Make sure you\'re in the correct directory'
      ]
    );
  }

  static isTruxeProject(): boolean {
    try {
      this.getProjectRoot();
      return true;
    } catch {
      return false;
    }
  }

  static loadConfig(projectRoot?: string): Partial<TruxeConfig> {
    if (this.configCache) {
      return this.configCache;
    }

    const root = projectRoot || this.getProjectRoot();
    
    // Load environment variables
    loadEnv({ path: join(root, '.env') });
    loadEnv({ path: join(root, '.env.local') });
    
    let config: Partial<TruxeConfig> = this.getDefaultConfig();
    
    // Try to load from various config files
    const configFiles = [
      { file: 'truxe.config.js', type: 'js' },
      { file: 'truxe.config.ts', type: 'ts' },
      { file: 'truxe.config.yaml', type: 'yaml' },
      { file: 'truxe.config.yml', type: 'yaml' },
    ];
    
    for (const { file, type } of configFiles) {
      const configPath = join(root, file);
      if (existsSync(configPath)) {
        try {
          const fileConfig = this.loadConfigFile(configPath, type);
          config = this.mergeConfigs(config, fileConfig);
          break;
        } catch (error) {
          this.logger.warning(`Failed to load config from ${file}: ${(error as Error).message}`);
        }
      }
    }
    
    // Try to load from package.json
    const packageJsonPath = join(root, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.truxe) {
          config = this.mergeConfigs(config, packageJson.truxe);
        }
      } catch (error) {
        this.logger.debug(`Failed to load config from package.json: ${(error as Error).message}`);
      }
    }
    
    // Override with environment variables
    config = this.applyEnvironmentOverrides(config);
    
    this.configCache = config;
    return config;
  }

  static saveConfig(config: Partial<TruxeConfig>, projectRoot?: string): void {
    const root = projectRoot || this.getProjectRoot();
    const configPath = join(root, 'truxe.config.yaml');
    
    try {
      const yamlContent = stringifyYaml(config, {
        indent: 2,
        lineWidth: 100,
        minContentWidth: 0,
      });
      
      writeFileSync(configPath, yamlContent, 'utf-8');
      this.configCache = null; // Clear cache
      this.logger.success(`Configuration saved to ${configPath}`);
    } catch (error) {
      throw new TruxeError(
        `Failed to save configuration: ${(error as Error).message}`,
        'CONFIG_SAVE_ERROR'
      );
    }
  }

  static getValue(key: string, projectRoot?: string): ConfigValue | null {
    const config = this.loadConfig(projectRoot);
    const value = this.getNestedValue(config, key);
    
    if (value === undefined) {
      return null;
    }
    
    // Determine source
    const envKey = this.configKeyToEnvKey(key);
    const source = process.env[envKey] ? 'env' : 'file';
    
    return {
      key,
      value,
      source,
      description: this.getConfigDescription(key)
    };
  }

  static setValue(key: string, value: string, projectRoot?: string): void {
    const config = this.loadConfig(projectRoot);
    this.setNestedValue(config, key, this.parseConfigValue(value));
    this.saveConfig(config, projectRoot);
  }

  static listValues(projectRoot?: string): ConfigValue[] {
    const config = this.loadConfig(projectRoot);
    const values: ConfigValue[] = [];
    
    this.flattenConfig(config, '', values);
    
    return values.sort((a, b) => a.key.localeCompare(b.key));
  }

  private static loadConfigFile(configPath: string, type: string): Partial<TruxeConfig> {
    const content = readFileSync(configPath, 'utf-8');
    
    switch (type) {
      case 'js':
      case 'ts':
        // Use dynamic import for ES modules
        // For now, use require for CommonJS
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const moduleExports = require(configPath);
        return moduleExports.default || moduleExports;
        
      case 'yaml':
        return parseYaml(content) as Partial<TruxeConfig>;
        
      default:
        throw new Error(`Unsupported config file type: ${type}`);
    }
  }

  private static mergeConfigs(
    base: Partial<TruxeConfig>, 
    override: Partial<TruxeConfig>
  ): Partial<TruxeConfig> {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        (result as any)[key] = this.mergeConfigs(
          (result as any)[key] || {},
          value as any
        );
      } else {
        (result as any)[key] = value;
      }
    }
    
    return result;
  }

  private static applyEnvironmentOverrides(config: Partial<TruxeConfig>): Partial<TruxeConfig> {
    const envMappings = {
      'database.url': 'DATABASE_URL',
      'database.ssl': 'DATABASE_SSL',
      'email.provider': 'EMAIL_PROVIDER',
      'email.from': 'EMAIL_FROM',
      'email.apiKey': 'EMAIL_API_KEY',
      'auth.jwt.algorithm': 'JWT_ALGORITHM',
      'multiTenant.enabled': 'ENABLE_MULTI_TENANT',
    };
    
    const result = { ...config };
    
    for (const [configPath, envKey] of Object.entries(envMappings)) {
      const envValue = process.env[envKey];
      if (envValue !== undefined) {
        this.setNestedValue(result, configPath, this.parseConfigValue(envValue));
      }
    }
    
    return result;
  }

  private static getDefaultConfig(): Partial<TruxeConfig> {
    return {
      // Server configuration
      server: {
        port: 3001, // Truxe API port (standard)
        host: '0.0.0.0',
        cors: {
          origin: 'http://localhost:3000', // Default frontend port
          credentials: true
        }
      },
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
          algorithm: 'RS256',
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
        provider: 'resend',
        from: 'noreply@localhost',
      },
      rateLimit: {
        magicLink: '5/minute',
        apiRequests: '1000/hour',
      },
    };
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  private static parseConfigValue(value: string): any {
    // Try to parse as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if JSON parsing fails
      return value;
    }
  }

  private static configKeyToEnvKey(configKey: string): string {
    return configKey
      .split('.')
      .map(part => part.replace(/([A-Z])/g, '_$1').toUpperCase())
      .join('_');
  }

  private static flattenConfig(obj: any, prefix: string, result: ConfigValue[]): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.flattenConfig(value, fullKey, result);
      } else {
        const envKey = this.configKeyToEnvKey(fullKey);
        const source = process.env[envKey] ? 'env' : 'file';
        
        result.push({
          key: fullKey,
          value,
          source,
          description: this.getConfigDescription(fullKey)
        });
      }
    }
  }

  private static getConfigDescription(key: string): string | undefined {
    const descriptions: Record<string, string> = {
      'database.url': 'Database connection URL',
      'database.ssl': 'Enable SSL for database connections',
      'database.poolSize': 'Maximum database connection pool size',
      'auth.magicLink.enabled': 'Enable magic link authentication',
      'auth.magicLink.expiryMinutes': 'Magic link expiration time in minutes',
      'auth.jwt.algorithm': 'JWT signing algorithm (RS256 or HS256)',
      'auth.jwt.accessTokenTTL': 'Access token time-to-live',
      'auth.jwt.refreshTokenTTL': 'Refresh token time-to-live',
      'auth.session.maxConcurrent': 'Maximum concurrent sessions per user',
      'auth.session.deviceTracking': 'Enable device tracking for sessions',
      'multiTenant.enabled': 'Enable multi-tenant mode',
      'multiTenant.defaultRole': 'Default role for new organization members',
      'multiTenant.allowSignup': 'Allow users to sign up without invitation',
      'email.provider': 'Email service provider (resend, ses, smtp)',
      'email.from': 'Default sender email address',
      'email.apiKey': 'Email service API key',
      'rateLimit.magicLink': 'Rate limit for magic link requests',
      'rateLimit.apiRequests': 'Rate limit for API requests',
    };
    
    return descriptions[key];
  }
}

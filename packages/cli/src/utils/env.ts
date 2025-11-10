/**
 * Environment variable validation utility
 * Provides validation and loading of environment variables
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { exists, readFile } from './fs';
import { logger } from './logger';

export interface EnvValidationRule {
  key: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'url';
  default?: string | number | boolean;
  validator?: (value: string) => boolean;
  message?: string;
}

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  values: Record<string, string>;
}

/**
 * Load environment variables from .env file
 * Returns the loaded environment variables as an object
 */
export async function loadEnv(envPath?: string): Promise<Record<string, string>> {
  const envFile = envPath ?? path.resolve(process.cwd(), '.env');

  if (await exists(envFile)) {
    const result = dotenv.config({ path: envFile });
    logger.debug(`Loaded environment variables from ${envFile}`);
    return result.parsed || {};
  } else {
    logger.debug(`No .env file found at ${envFile}`);
    return {};
  }
}

/**
 * Get environment variable with optional default
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

/**
 * Get required environment variable
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get environment variable as number
 */
export function getEnvNumber(key: string, defaultValue?: number): number | undefined {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} is not a valid number: ${value}`);
  }
  return num;
}

/**
 * Get environment variable as boolean
 */
export function getEnvBoolean(key: string, defaultValue?: boolean): boolean | undefined {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  const lower = value.toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'yes';
}

/**
 * Validate environment variables against rules
 */
export function validateEnv(rules: EnvValidationRule[]): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const values: Record<string, string> = {};

  for (const rule of rules) {
    const { key, required = false, type, default: defaultValue, validator, message } = rule;
    let value = process.env[key];

    // Use default if value is not set
    if (!value && defaultValue !== undefined) {
      value = String(defaultValue);
      process.env[key] = value;
    }

    // Check required
    if (required && !value) {
      errors.push(
        message ?? `Required environment variable ${key} is not set`
      );
      continue;
    }

    // Skip validation if value is not set and not required
    if (!value) {
      continue;
    }

    values[key] = value;

    // Type validation
    if (type) {
      switch (type) {
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(
              message ?? `Environment variable ${key} must be a number, got: ${value}`
            );
            continue;
          }
          break;

        case 'boolean':
          const lower = value.toLowerCase();
          if (!['true', 'false', '1', '0', 'yes', 'no'].includes(lower)) {
            errors.push(
              message ?? `Environment variable ${key} must be a boolean, got: ${value}`
            );
            continue;
          }
          break;

        case 'url':
          try {
            new URL(value);
          } catch {
            errors.push(
              message ?? `Environment variable ${key} must be a valid URL, got: ${value}`
            );
            continue;
          }
          break;
      }
    }

    // Custom validator
    if (validator && !validator(value)) {
      errors.push(
        message ?? `Environment variable ${key} failed validation: ${value}`
      );
      continue;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    values,
  };
}

/**
 * Validate required environment variables for Truxe
 */
export function validateTruxeEnv(): EnvValidationResult {
  return validateEnv([
    {
      key: 'DATABASE_URL',
      required: true,
      type: 'url',
      message: 'DATABASE_URL is required and must be a valid PostgreSQL connection string',
    },
    {
      key: 'REDIS_URL',
      required: true,
      type: 'url',
      message: 'REDIS_URL is required and must be a valid Redis connection string',
    },
    {
      key: 'JWT_PRIVATE_KEY_PATH',
      required: false,
      message: 'JWT_PRIVATE_KEY_PATH is recommended for production',
    },
    {
      key: 'JWT_PUBLIC_KEY_PATH',
      required: false,
      message: 'JWT_PUBLIC_KEY_PATH is recommended for production',
    },
    {
      key: 'PORT',
      required: false,
      type: 'number',
      default: 3000,
    },
    {
      key: 'NODE_ENV',
      required: false,
      default: 'development',
    },
  ]);
}

/**
 * Parse .env file and return as object
 */
export async function parseEnvFile(envPath: string): Promise<Record<string, string>> {
  if (!(await exists(envPath))) {
    return {};
  }

  const content = await readFile(envPath);
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');
      env[key.trim()] = cleanValue;
    }
  }

  return env;
}


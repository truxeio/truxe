import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { writeFile, remove } from '../../src/utils/fs';
import {
  loadEnv,
  getEnv,
  getRequiredEnv,
  getEnvNumber,
  getEnvBoolean,
  validateEnv,
  validateTruxeEnv,
  parseEnvFile,
} from '../../src/utils/env';

describe('env utility', () => {
  const testDir = join(process.cwd(), 'tests', 'tmp', 'env-tests');
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    // Clear process.env for clean tests
    for (const key in process.env) {
      if (key.startsWith('TEST_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(async () => {
    // Restore original env
    process.env = { ...originalEnv };

    // Clean up test files
    try {
      await remove(testDir);
    } catch {
      // Ignore errors
    }
  });

  describe('loadEnv', () => {
    it('should load environment variables from .env file', async () => {
      const envPath = join(testDir, '.env');
      const envContent = `
TEST_VAR_1=value1
TEST_VAR_2=value2
TEST_VAR_3=value3
`;
      await writeFile(envPath, envContent);

      const result = await loadEnv(envPath);

      expect(result).toHaveProperty('TEST_VAR_1', 'value1');
      expect(result).toHaveProperty('TEST_VAR_2', 'value2');
      expect(result).toHaveProperty('TEST_VAR_3', 'value3');
    });

    it('should return empty object if .env file does not exist', async () => {
      const envPath = join(testDir, 'non-existent.env');
      const result = await loadEnv(envPath);

      expect(result).toEqual({});
    });

    it('should handle environment variables with quotes', async () => {
      const envPath = join(testDir, '.env-quotes');
      const envContent = `
TEST_QUOTED="quoted value"
TEST_SINGLE='single quoted'
`;
      await writeFile(envPath, envContent);

      const result = await loadEnv(envPath);

      expect(result).toHaveProperty('TEST_QUOTED', 'quoted value');
      expect(result).toHaveProperty('TEST_SINGLE', 'single quoted');
    });

    it('should handle empty lines and comments', async () => {
      const envPath = join(testDir, '.env-comments');
      const envContent = `
# This is a comment
TEST_VAR=value

# Another comment
TEST_VAR2=value2
`;
      await writeFile(envPath, envContent);

      const result = await loadEnv(envPath);

      expect(result).toHaveProperty('TEST_VAR', 'value');
      expect(result).toHaveProperty('TEST_VAR2', 'value2');
    });
  });

  describe('getEnv', () => {
    it('should get environment variable', () => {
      process.env.TEST_GET = 'test_value';
      const value = getEnv('TEST_GET');
      expect(value).toBe('test_value');
    });

    it('should return default value if variable not set', () => {
      const value = getEnv('NON_EXISTENT', 'default');
      expect(value).toBe('default');
    });

    it('should return undefined if variable not set and no default', () => {
      const value = getEnv('NON_EXISTENT');
      expect(value).toBeUndefined();
    });
  });

  describe('getRequiredEnv', () => {
    it('should get required environment variable', () => {
      process.env.TEST_REQUIRED = 'required_value';
      const value = getRequiredEnv('TEST_REQUIRED');
      expect(value).toBe('required_value');
    });

    it('should throw error if required variable not set', () => {
      expect(() => getRequiredEnv('NON_EXISTENT')).toThrow(
        'Required environment variable NON_EXISTENT is not set'
      );
    });

    it('should throw error if required variable is empty string', () => {
      process.env.TEST_EMPTY = '';
      expect(() => getRequiredEnv('TEST_EMPTY')).toThrow(
        'Required environment variable TEST_EMPTY is not set'
      );
    });
  });

  describe('getEnvNumber', () => {
    it('should parse number from environment variable', () => {
      process.env.TEST_NUMBER = '42';
      const value = getEnvNumber('TEST_NUMBER');
      expect(value).toBe(42);
    });

    it('should return default value if variable not set', () => {
      const value = getEnvNumber('NON_EXISTENT', 100);
      expect(value).toBe(100);
    });

    it('should throw error for invalid number', () => {
      process.env.TEST_INVALID_NUMBER = 'not_a_number';
      expect(() => getEnvNumber('TEST_INVALID_NUMBER')).toThrow(
        'Environment variable TEST_INVALID_NUMBER is not a valid number'
      );
    });

    it('should handle float numbers', () => {
      process.env.TEST_FLOAT = '3.14';
      const value = getEnvNumber('TEST_FLOAT');
      expect(value).toBe(3.14);
    });

    it('should handle negative numbers', () => {
      process.env.TEST_NEGATIVE = '-42';
      const value = getEnvNumber('TEST_NEGATIVE');
      expect(value).toBe(-42);
    });
  });

  describe('getEnvBoolean', () => {
    it('should parse true values', () => {
      process.env.TEST_BOOL_TRUE = 'true';
      expect(getEnvBoolean('TEST_BOOL_TRUE')).toBe(true);

      process.env.TEST_BOOL_1 = '1';
      expect(getEnvBoolean('TEST_BOOL_1')).toBe(true);

      process.env.TEST_BOOL_YES = 'yes';
      expect(getEnvBoolean('TEST_BOOL_YES')).toBe(true);

      process.env.TEST_BOOL_TRUE_UPPER = 'TRUE';
      expect(getEnvBoolean('TEST_BOOL_TRUE_UPPER')).toBe(true);
    });

    it('should parse false values', () => {
      process.env.TEST_BOOL_FALSE = 'false';
      expect(getEnvBoolean('TEST_BOOL_FALSE')).toBe(false);

      process.env.TEST_BOOL_0 = '0';
      expect(getEnvBoolean('TEST_BOOL_0')).toBe(false);

      process.env.TEST_BOOL_NO = 'no';
      expect(getEnvBoolean('TEST_BOOL_NO')).toBe(false);

      process.env.TEST_BOOL_RANDOM = 'random';
      expect(getEnvBoolean('TEST_BOOL_RANDOM')).toBe(false);
    });

    it('should return default value if variable not set', () => {
      expect(getEnvBoolean('NON_EXISTENT', true)).toBe(true);
      expect(getEnvBoolean('NON_EXISTENT', false)).toBe(false);
    });

    it('should return undefined if variable not set and no default', () => {
      expect(getEnvBoolean('NON_EXISTENT')).toBeUndefined();
    });
  });

  describe('validateEnv', () => {
    it('should validate required variables', () => {
      process.env.TEST_REQUIRED = 'value';

      const result = validateEnv([
        { key: 'TEST_REQUIRED', required: true },
      ]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.values).toHaveProperty('TEST_REQUIRED', 'value');
    });

    it('should return error for missing required variable', () => {
      const result = validateEnv([
        { key: 'MISSING_REQUIRED', required: true },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('MISSING_REQUIRED');
    });

    it('should use default values', () => {
      const result = validateEnv([
        { key: 'WITH_DEFAULT', default: 'default_value' },
      ]);

      expect(result.valid).toBe(true);
      expect(process.env.WITH_DEFAULT).toBe('default_value');
      expect(result.values).toHaveProperty('WITH_DEFAULT', 'default_value');
    });

    it('should validate number type', () => {
      process.env.TEST_NUM_VALID = '42';
      process.env.TEST_NUM_INVALID = 'not_a_number';

      const resultValid = validateEnv([
        { key: 'TEST_NUM_VALID', type: 'number' },
      ]);
      expect(resultValid.valid).toBe(true);

      const resultInvalid = validateEnv([
        { key: 'TEST_NUM_INVALID', type: 'number' },
      ]);
      expect(resultInvalid.valid).toBe(false);
      expect(resultInvalid.errors[0]).toContain('must be a number');
    });

    it('should validate boolean type', () => {
      process.env.TEST_BOOL_VALID = 'true';
      process.env.TEST_BOOL_INVALID = 'maybe';

      const resultValid = validateEnv([
        { key: 'TEST_BOOL_VALID', type: 'boolean' },
      ]);
      expect(resultValid.valid).toBe(true);

      const resultInvalid = validateEnv([
        { key: 'TEST_BOOL_INVALID', type: 'boolean' },
      ]);
      expect(resultInvalid.valid).toBe(false);
      expect(resultInvalid.errors[0]).toContain('must be a boolean');
    });

    it('should validate URL type', () => {
      process.env.TEST_URL_VALID = 'https://example.com';
      process.env.TEST_URL_INVALID = 'not-a-url';

      const resultValid = validateEnv([
        { key: 'TEST_URL_VALID', type: 'url' },
      ]);
      expect(resultValid.valid).toBe(true);

      const resultInvalid = validateEnv([
        { key: 'TEST_URL_INVALID', type: 'url' },
      ]);
      expect(resultInvalid.valid).toBe(false);
      expect(resultInvalid.errors[0]).toContain('must be a valid URL');
    });

    it('should use custom validator', () => {
      process.env.TEST_CUSTOM = 'test123';

      const result = validateEnv([
        {
          key: 'TEST_CUSTOM',
          validator: (value: string) => value.startsWith('test'),
          message: 'Must start with "test"',
        },
      ]);

      expect(result.valid).toBe(true);
    });

    it('should fail custom validator', () => {
      process.env.TEST_CUSTOM_FAIL = 'fail123';

      const result = validateEnv([
        {
          key: 'TEST_CUSTOM_FAIL',
          validator: (value: string) => value.startsWith('test'),
          message: 'Must start with "test"',
        },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toBe('Must start with "test"');
    });

    it('should skip validation for optional missing variables', () => {
      const result = validateEnv([
        { key: 'OPTIONAL_VAR', required: false },
      ]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateTruxeEnv', () => {
    it('should validate all Truxe required variables', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/truxe';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const result = validateTruxeEnv();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail without DATABASE_URL', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      delete process.env.DATABASE_URL;

      const result = validateTruxeEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);
    });

    it('should fail without REDIS_URL', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/truxe';
      delete process.env.REDIS_URL;

      const result = validateTruxeEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('REDIS_URL'))).toBe(true);
    });

    it('should accept optional JWT key paths', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/truxe';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.JWT_PRIVATE_KEY_PATH = './keys/private.pem';
      process.env.JWT_PUBLIC_KEY_PATH = './keys/public.pem';

      const result = validateTruxeEnv();

      expect(result.valid).toBe(true);
    });
  });

  describe('parseEnvFile', () => {
    it('should parse .env file content', async () => {
      const envPath = join(testDir, '.env-parse');
      const envContent = `
DATABASE_URL=postgresql://localhost:5432/test
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=development
`;
      await writeFile(envPath, envContent);

      const result = await parseEnvFile(envPath);

      expect(result).toHaveProperty('DATABASE_URL', 'postgresql://localhost:5432/test');
      expect(result).toHaveProperty('REDIS_URL', 'redis://localhost:6379');
      expect(result).toHaveProperty('PORT', '3000');
      expect(result).toHaveProperty('NODE_ENV', 'development');
    });

    it('should skip comments', async () => {
      const envPath = join(testDir, '.env-comments-parse');
      const envContent = `
# Database configuration
DATABASE_URL=postgresql://localhost:5432/test
# Redis configuration
REDIS_URL=redis://localhost:6379
`;
      await writeFile(envPath, envContent);

      const result = await parseEnvFile(envPath);

      expect(result).toHaveProperty('DATABASE_URL');
      expect(result).toHaveProperty('REDIS_URL');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should handle quoted values', async () => {
      const envPath = join(testDir, '.env-quoted-parse');
      const envContent = `
QUOTED_DOUBLE="double quoted"
QUOTED_SINGLE='single quoted'
NOT_QUOTED=no quotes
`;
      await writeFile(envPath, envContent);

      const result = await parseEnvFile(envPath);

      expect(result.QUOTED_DOUBLE).toBe('double quoted');
      expect(result.QUOTED_SINGLE).toBe('single quoted');
      expect(result.NOT_QUOTED).toBe('no quotes');
    });

    it('should return empty object for non-existent file', async () => {
      const result = await parseEnvFile('/non/existent/path/.env');
      expect(result).toEqual({});
    });

    it('should handle empty lines', async () => {
      const envPath = join(testDir, '.env-empty-lines');
      const envContent = `
VAR1=value1

VAR2=value2

`;
      await writeFile(envPath, envContent);

      const result = await parseEnvFile(envPath);

      expect(result).toHaveProperty('VAR1', 'value1');
      expect(result).toHaveProperty('VAR2', 'value2');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should handle values with equals signs', async () => {
      const envPath = join(testDir, '.env-equals');
      const envContent = `
CONNECTION_STRING=user=admin;password=pass=word
`;
      await writeFile(envPath, envContent);

      const result = await parseEnvFile(envPath);

      expect(result.CONNECTION_STRING).toBe('user=admin;password=pass=word');
    });
  });

  describe('edge cases', () => {
    it('should handle variables with special characters', async () => {
      const envPath = join(testDir, '.env-special');
      const envContent = `
SPECIAL_CHARS=value@#$%^&*()
URL_WITH_QUERY=https://example.com?param=value&other=123
`;
      await writeFile(envPath, envContent);

      const result = await parseEnvFile(envPath);

      expect(result.SPECIAL_CHARS).toBe('value@#$%^&*()');
      expect(result.URL_WITH_QUERY).toBe('https://example.com?param=value&other=123');
    });

    it('should handle very long values', async () => {
      const longValue = 'a'.repeat(10000);
      const envPath = join(testDir, '.env-long');
      const envContent = `LONG_VALUE=${longValue}`;
      await writeFile(envPath, envContent);

      const result = await parseEnvFile(envPath);

      expect(result.LONG_VALUE).toBe(longValue);
      expect(result.LONG_VALUE.length).toBe(10000);
    });
  });
});

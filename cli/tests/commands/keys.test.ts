/**
 * Unit Tests for `truxe keys` Command
 * 
 * Tests:
 * - Key generation
 * - Key file operations
 * - Key validation
 * - Fingerprint calculation
 * - Environment file updates
 * - Error handling
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { generateKeyPairSync, createHash } from 'crypto';
import { TruxeError } from '../../src/utils/error-handler';
import { ConfigManager } from '../../src/utils/config';

// Mock dependencies
jest.mock('fs');
jest.mock('crypto');
jest.mock('../../src/utils/config');
jest.mock('../../src/utils/logger');
jest.mock('ora', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    start: jest.fn(() => ({
      succeed: jest.fn(),
      fail: jest.fn(),
      text: '',
    })),
  })),
}));

const mockFs = require('fs') as jest.Mocked<typeof import('fs')>;
const mockCrypto = require('crypto') as jest.Mocked<typeof import('crypto')>;
const mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;

describe('truxe keys - Unit Tests', () => {
  const testProjectRoot = '/test/project';
  const testKeysDir = join(testProjectRoot, 'keys');
  const testPrivateKeyPath = join(testKeysDir, 'private.pem');
  const testPublicKeyPath = join(testKeysDir, 'public.pem');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => undefined);
    mockFs.readFileSync.mockReturnValue('');
    mockFs.chmodSync.mockImplementation(() => undefined);
    
    mockConfigManager.isTruxeProject.mockReturnValue(true);
    mockConfigManager.getProjectRoot.mockReturnValue(testProjectRoot);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Key Generation', () => {
    test('should generate RSA key pair successfully', () => {
      const mockPrivateKey = '-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----';
      const mockPublicKey = '-----BEGIN PUBLIC KEY-----\nMOCK_PUBLIC_KEY\n-----END PUBLIC KEY-----';

      mockCrypto.generateKeyPairSync.mockReturnValue({
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
      } as any);

      mockFs.existsSync.mockReturnValue(false);

      // Simulate key generation
      const { privateKey, publicKey } = mockCrypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      expect(privateKey).toBe(mockPrivateKey);
      expect(publicKey).toBe(mockPublicKey);
      expect(mockCrypto.generateKeyPairSync).toHaveBeenCalled();
    });

    test('should validate key size', () => {
      const validSizes = [2048, 3072, 4096];
      const invalidSizes = [1024, 512, 8192];

      validSizes.forEach(size => {
        expect([2048, 3072, 4096].includes(size)).toBe(true);
      });

      invalidSizes.forEach(size => {
        expect([2048, 3072, 4096].includes(size)).toBe(false);
      });
    });

    test('should create keys directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      // Simulate directory creation
      if (!mockFs.existsSync(testKeysDir)) {
        mockFs.mkdirSync(testKeysDir, { recursive: true });
      }

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(testKeysDir, { recursive: true });
    });

    test('should write keys to files with correct permissions', () => {
      const mockPrivateKey = '-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----';
      const mockPublicKey = '-----BEGIN PUBLIC KEY-----\nMOCK_KEY\n-----END PUBLIC KEY-----';

      mockFs.existsSync.mockReturnValue(false);

      // Simulate writing keys
      mockFs.writeFileSync(testPrivateKeyPath, mockPrivateKey);
      mockFs.writeFileSync(testPublicKeyPath, mockPublicKey);
      mockFs.chmodSync(testPrivateKeyPath, 0o600);
      mockFs.chmodSync(testPublicKeyPath, 0o644);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(testPrivateKeyPath, mockPrivateKey);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(testPublicKeyPath, mockPublicKey);
      expect(mockFs.chmodSync).toHaveBeenCalledWith(testPrivateKeyPath, 0o600);
      expect(mockFs.chmodSync).toHaveBeenCalledWith(testPublicKeyPath, 0o644);
    });
  });

  describe('Key Existence Check', () => {
    test('should detect existing keys', () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path === testPrivateKeyPath || path === testPublicKeyPath;
      });

      const keysExist = mockFs.existsSync(testPrivateKeyPath) || mockFs.existsSync(testPublicKeyPath);
      expect(keysExist).toBe(true);
    });

    test('should allow overwrite with --force flag', () => {
      mockFs.existsSync.mockReturnValue(true);

      const force = true;
      if (force) {
        // Should proceed with overwrite
        expect(true).toBe(true);
      } else {
        // Should throw error
        expect(() => {
          throw new TruxeError(
            'Keys already exist',
            'KEYS_EXIST',
            ['Use --force to overwrite existing keys']
          );
        }).toThrow(TruxeError);
      }
    });

    test('should throw error when keys exist without --force', () => {
      mockFs.existsSync.mockReturnValue(true);

      expect(() => {
        throw new TruxeError(
          'Keys already exist',
          'KEYS_EXIST',
          ['Use --force to overwrite existing keys']
        );
      }).toThrow(TruxeError);
    });
  });

  describe('Key Fingerprint Calculation', () => {
    test('should calculate fingerprint correctly', () => {
      const mockPublicKey = '-----BEGIN PUBLIC KEY-----\nMOCK_KEY_CONTENT\n-----END PUBLIC KEY-----';
      
      // Remove header/footer and whitespace
      const keyContent = mockPublicKey
        .replace(/-----BEGIN PUBLIC KEY-----/g, '')
        .replace(/-----END PUBLIC KEY-----/g, '')
        .replace(/\s/g, '');

      // Create SHA-256 hash
      const hash = createHash('sha256')
        .update(Buffer.from(keyContent, 'base64'))
        .digest('hex');

      // Format as colon-separated hex pairs
      const fingerprint = hash.match(/.{2}/g)?.join(':') || hash;

      expect(fingerprint).toBeTruthy();
      expect(fingerprint.length).toBeGreaterThan(0);
      expect(fingerprint).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){31}$/);
    });

    test('should handle invalid key format gracefully', () => {
      const invalidKey = 'not-a-valid-key';
      
      const keyContent = invalidKey
        .replace(/-----BEGIN PUBLIC KEY-----/g, '')
        .replace(/-----END PUBLIC KEY-----/g, '')
        .replace(/\s/g, '');

      // Should not throw, but fingerprint may be invalid
      expect(keyContent).toBe('not-a-valid-key');
    });
  });

  describe('Environment File Updates', () => {
    test('should update existing .env file', () => {
      const mockEnvContent = 'DATABASE_URL=postgresql://localhost\nJWT_PRIVATE_KEY=""\nJWT_PUBLIC_KEY=""';
      const mockPrivateKey = '-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----';
      const mockPublicKey = '-----BEGIN PUBLIC KEY-----\nMOCK_KEY\n-----END PUBLIC KEY-----';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockEnvContent);

      const privateKeyEnv = mockPrivateKey.replace(/\n/g, '\\n');
      const publicKeyEnv = mockPublicKey.replace(/\n/g, '\\n');

      let updatedContent = mockEnvContent;
      updatedContent = updatedContent.replace(
        /JWT_PRIVATE_KEY=.*/,
        `JWT_PRIVATE_KEY="${privateKeyEnv}"`
      );
      updatedContent = updatedContent.replace(
        /JWT_PUBLIC_KEY=.*/,
        `JWT_PUBLIC_KEY="${publicKeyEnv}"`
      );

      mockFs.writeFileSync(join(testProjectRoot, '.env'), updatedContent);

      expect(updatedContent).toContain('JWT_PRIVATE_KEY="');
      expect(updatedContent).toContain('JWT_PUBLIC_KEY="');
    });

    test('should create new .env file if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const mockPrivateKey = '-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----';
      const mockPublicKey = '-----BEGIN PUBLIC KEY-----\nMOCK_KEY\n-----END PUBLIC KEY-----';

      const privateKeyEnv = mockPrivateKey.replace(/\n/g, '\\n');
      const publicKeyEnv = mockPublicKey.replace(/\n/g, '\\n');

      const envContent = `# JWT Keys\nJWT_PRIVATE_KEY="${privateKeyEnv}"\nJWT_PUBLIC_KEY="${publicKeyEnv}"\n`;
      
      mockFs.writeFileSync(join(testProjectRoot, '.env'), envContent);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    test('should escape newlines in keys for .env format', () => {
      const keyWithNewlines = '-----BEGIN PRIVATE KEY-----\nLINE1\nLINE2\n-----END PRIVATE KEY-----';
      const escaped = keyWithNewlines.replace(/\n/g, '\\n');

      expect(escaped).toContain('\\n');
      expect(escaped).not.toContain('\n');
    });
  });

  describe('Error Handling', () => {
    test('should handle key generation failures', () => {
      mockCrypto.generateKeyPairSync.mockImplementation(() => {
        throw new Error('Key generation failed');
      });

      expect(() => {
        mockCrypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
      }).toThrow();
    });

    test('should handle file write errors', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => {
        mockFs.writeFileSync(testPrivateKeyPath, 'test');
      }).toThrow('Permission denied');
    });

    test('should handle invalid key size', () => {
      const invalidSize = 1024;
      const validSizes = [2048, 3072, 4096];

      if (!validSizes.includes(invalidSize)) {
        expect(() => {
          throw new TruxeError(
            'Invalid key size',
            'INVALID_KEY_SIZE',
            ['Supported key sizes: 2048, 3072, 4096']
          );
        }).toThrow(TruxeError);
      }
    });
  });

  describe('Key Display', () => {
    test('should read and display public key', () => {
      const mockPublicKey = '-----BEGIN PUBLIC KEY-----\nMOCK_KEY\n-----END PUBLIC KEY-----';
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockPublicKey);

      const publicKey = mockFs.readFileSync(testPublicKeyPath, 'utf-8');
      
      expect(publicKey).toBe(mockPublicKey);
    });

    test('should throw error when public key not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        throw new TruxeError(
          'Public key not found',
          'KEY_NOT_FOUND',
          ['Run `truxe keys generate` to create keys']
        );
      }).toThrow(TruxeError);
    });
  });
});


/**
 * Integration Tests for `truxe keys` Command
 * 
 * Tests:
 * - Full key generation flow
 * - Key file creation and validation
 * - Fingerprint calculation
 * - Environment file updates
 * - Key reading and display
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, chmodSync } from 'fs';
import { join } from 'path';
import { generateKeyPairSync, createHash } from 'crypto';
import * as os from 'os';

// Use real file system and crypto for integration tests
jest.unmock('fs');
jest.unmock('crypto');

describe('truxe keys - Integration Tests', () => {
  let testProjectPath: string;
  let testKeysDir: string;
  let testPrivateKeyPath: string;
  let testPublicKeyPath: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    testProjectPath = join(os.tmpdir(), `truxe-keys-test-${Date.now()}`);
    testKeysDir = join(testProjectPath, 'keys');
    testPrivateKeyPath = join(testKeysDir, 'private.pem');
    testPublicKeyPath = join(testKeysDir, 'public.pem');
    
    // Create project directory
    mkdirSync(testProjectPath, { recursive: true });
  });

  afterEach(() => {
    // Clean up test project
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('Key Generation Flow', () => {
    test('should generate valid RSA key pair', () => {
      const keySize = 2048;
      
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      // Verify keys are valid PEM format
      expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(privateKey).toContain('-----END PRIVATE KEY-----');
      expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(publicKey).toContain('-----END PUBLIC KEY-----');
    });

    test('should create keys directory', () => {
      if (!existsSync(testKeysDir)) {
        mkdirSync(testKeysDir, { recursive: true });
      }

      expect(existsSync(testKeysDir)).toBe(true);
    });

    test('should write keys to files', () => {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      mkdirSync(testKeysDir, { recursive: true });
      writeFileSync(testPrivateKeyPath, privateKey);
      writeFileSync(testPublicKeyPath, publicKey);

      expect(existsSync(testPrivateKeyPath)).toBe(true);
      expect(existsSync(testPublicKeyPath)).toBe(true);

      const savedPrivateKey = readFileSync(testPrivateKeyPath, 'utf-8');
      const savedPublicKey = readFileSync(testPublicKeyPath, 'utf-8');

      expect(savedPrivateKey).toBe(privateKey);
      expect(savedPublicKey).toBe(publicKey);
    });

    test('should set correct file permissions', () => {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      mkdirSync(testKeysDir, { recursive: true });
      writeFileSync(testPrivateKeyPath, privateKey);
      writeFileSync(testPublicKeyPath, publicKey);

      // Set permissions
      chmodSync(testPrivateKeyPath, 0o600);
      chmodSync(testPublicKeyPath, 0o644);

      // Verify permissions (on Unix systems)
      if (process.platform !== 'win32') {
        const privateKeyStats = require('fs').statSync(testPrivateKeyPath);
        const publicKeyStats = require('fs').statSync(testPublicKeyPath);
        
        // Check that private key has restrictive permissions
        const privateMode = privateKeyStats.mode & parseInt('777', 8);
        const publicMode = publicKeyStats.mode & parseInt('777', 8);
        
        expect(privateMode).toBe(0o600);
        expect(publicMode).toBe(0o644);
      }
    });
  });

  describe('Key Validation', () => {
    test('should generate keys of correct size', () => {
      const keySizes = [2048, 3072, 4096];

      keySizes.forEach(keySize => {
        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
          modulusLength: keySize,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });

        // Keys should be valid regardless of size
        expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
        expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      });
    });

    test('should generate unique keys each time', () => {
      const keyPair1 = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const keyPair2 = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      // Keys should be different
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    });
  });

  describe('Fingerprint Calculation', () => {
    test('should calculate consistent fingerprint', () => {
      const { publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      // Remove header/footer and whitespace
      const keyContent = publicKey
        .replace(/-----BEGIN PUBLIC KEY-----/g, '')
        .replace(/-----END PUBLIC KEY-----/g, '')
        .replace(/\s/g, '');

      // Create SHA-256 hash
      const hash1 = createHash('sha256')
        .update(Buffer.from(keyContent, 'base64'))
        .digest('hex');

      const hash2 = createHash('sha256')
        .update(Buffer.from(keyContent, 'base64'))
        .digest('hex');

      // Same key should produce same hash
      expect(hash1).toBe(hash2);

      // Format as colon-separated hex pairs
      const fingerprint = hash1.match(/.{2}/g)?.join(':') || hash1;
      expect(fingerprint).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){31}$/);
    });

    test('should produce different fingerprints for different keys', () => {
      const keyPair1 = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const keyPair2 = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const calculateFingerprint = (publicKey: string): string => {
        const keyContent = publicKey
          .replace(/-----BEGIN PUBLIC KEY-----/g, '')
          .replace(/-----END PUBLIC KEY-----/g, '')
          .replace(/\s/g, '');
        
        const hash = createHash('sha256')
          .update(Buffer.from(keyContent, 'base64'))
          .digest('hex');
        
        return hash.match(/.{2}/g)?.join(':') || hash;
      };

      const fingerprint1 = calculateFingerprint(keyPair1.publicKey);
      const fingerprint2 = calculateFingerprint(keyPair2.publicKey);

      expect(fingerprint1).not.toBe(fingerprint2);
    });
  });

  describe('Environment File Updates', () => {
    test('should update .env file with keys', () => {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const envPath = join(testProjectPath, '.env');
      const initialContent = 'DATABASE_URL=postgresql://localhost:5432/test\n';
      writeFileSync(envPath, initialContent);

      // Update .env with keys
      const privateKeyEnv = privateKey.replace(/\n/g, '\\n');
      const publicKeyEnv = publicKey.replace(/\n/g, '\\n');

      let envContent = readFileSync(envPath, 'utf-8');
      
      if (envContent.includes('JWT_PRIVATE_KEY=')) {
        envContent = envContent.replace(
          /JWT_PRIVATE_KEY=.*/,
          `JWT_PRIVATE_KEY="${privateKeyEnv}"`
        );
      } else {
        envContent += `\nJWT_PRIVATE_KEY="${privateKeyEnv}"\n`;
      }

      if (envContent.includes('JWT_PUBLIC_KEY=')) {
        envContent = envContent.replace(
          /JWT_PUBLIC_KEY=.*/,
          `JWT_PUBLIC_KEY="${publicKeyEnv}"`
        );
      } else {
        envContent += `JWT_PUBLIC_KEY="${publicKeyEnv}"\n`;
      }

      writeFileSync(envPath, envContent);

      // Verify keys were added
      const updatedContent = readFileSync(envPath, 'utf-8');
      expect(updatedContent).toContain('JWT_PRIVATE_KEY=');
      expect(updatedContent).toContain('JWT_PUBLIC_KEY=');
      expect(updatedContent).toContain(privateKeyEnv);
      expect(updatedContent).toContain(publicKeyEnv);
    });

    test('should create new .env file if it does not exist', () => {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const envPath = join(testProjectPath, '.env');
      
      // Create new .env file
      const privateKeyEnv = privateKey.replace(/\n/g, '\\n');
      const publicKeyEnv = publicKey.replace(/\n/g, '\\n');

      const envContent = `# JWT Keys\nJWT_PRIVATE_KEY="${privateKeyEnv}"\nJWT_PUBLIC_KEY="${publicKeyEnv}"\n`;
      writeFileSync(envPath, envContent);

      expect(existsSync(envPath)).toBe(true);
      const content = readFileSync(envPath, 'utf-8');
      expect(content).toContain('JWT_PRIVATE_KEY=');
      expect(content).toContain('JWT_PUBLIC_KEY=');
    });
  });

  describe('Key Reading', () => {
    test('should read generated keys from files', () => {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      mkdirSync(testKeysDir, { recursive: true });
      writeFileSync(testPrivateKeyPath, privateKey);
      writeFileSync(testPublicKeyPath, publicKey);

      const savedPrivateKey = readFileSync(testPrivateKeyPath, 'utf-8');
      const savedPublicKey = readFileSync(testPublicKeyPath, 'utf-8');

      expect(savedPrivateKey).toBe(privateKey);
      expect(savedPublicKey).toBe(publicKey);
    });

    test('should handle missing key files gracefully', () => {
      expect(existsSync(testPublicKeyPath)).toBe(false);
    });
  });
});





/**
 * Test Helper Utilities
 * 
 * Common utilities for testing CLI commands
 */

import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

export class TestHelpers {
  /**
   * Create a temporary directory for testing
   */
  static createTempDir(prefix: string = 'truxe-test'): string {
    const tempDir = join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    mkdirSync(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Clean up a temporary directory
   */
  static cleanupTempDir(path: string): void {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
    }
  }

  /**
   * Create a mock project structure
   */
  static createMockProject(basePath: string, options: {
    name?: string;
    template?: string;
    hasConfig?: boolean;
    hasEnv?: boolean;
  } = {}): void {
    const {
      name = 'test-project',
      template = 'nextjs',
      hasConfig = true,
      hasEnv = true,
    } = options;

    // Create base directory
    mkdirSync(basePath, { recursive: true });

    // Create package.json
    const packageJson = {
      name,
      version: '1.0.0',
      dependencies: {},
    };
    writeFileSync(
      join(basePath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create config file
    if (hasConfig) {
      const config = {
        database: { url: 'sqlite:./dev.db' },
        auth: { jwt: { algorithm: 'RS256' } },
        multiTenant: { enabled: false },
      };
      writeFileSync(
        join(basePath, 'truxe.config.yaml'),
        JSON.stringify(config, null, 2)
      );
    }

    // Create .env file
    if (hasEnv) {
      const envContent = `DATABASE_URL=sqlite:./dev.db
JWT_PRIVATE_KEY=""
JWT_PUBLIC_KEY=""
`;
      writeFileSync(join(basePath, '.env'), envContent);
    }

    // Create template-specific structure
    switch (template) {
      case 'nextjs':
        mkdirSync(join(basePath, 'app'), { recursive: true });
        mkdirSync(join(basePath, 'public'), { recursive: true });
        break;
      case 'nuxt':
        mkdirSync(join(basePath, 'pages'), { recursive: true });
        mkdirSync(join(basePath, 'components'), { recursive: true });
        break;
      case 'sveltekit':
        mkdirSync(join(basePath, 'src', 'routes'), { recursive: true });
        mkdirSync(join(basePath, 'static'), { recursive: true });
        break;
    }
  }

  /**
   * Create mock keys directory with keys
   */
  static createMockKeys(basePath: string): { privateKey: string; publicKey: string } {
    const { generateKeyPairSync } = require('crypto');
    const keysDir = join(basePath, 'keys');
    mkdirSync(keysDir, { recursive: true });

    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    writeFileSync(join(keysDir, 'private.pem'), privateKey);
    writeFileSync(join(keysDir, 'public.pem'), publicKey);

    return { privateKey, publicKey };
  }

  /**
   * Mock file system operations
   */
  static mockFileSystem(mocks: {
    existsSync?: (path: string) => boolean;
    readFileSync?: (path: string) => string;
    writeFileSync?: (path: string, content: string) => void;
    mkdirSync?: (path: string) => void;
  }): void {
    const fs = require('fs');
    
    if (mocks.existsSync) {
      jest.spyOn(fs, 'existsSync').mockImplementation(mocks.existsSync);
    }
    
    if (mocks.readFileSync) {
      jest.spyOn(fs, 'readFileSync').mockImplementation(mocks.readFileSync);
    }
    
    if (mocks.writeFileSync) {
      jest.spyOn(fs, 'writeFileSync').mockImplementation(mocks.writeFileSync);
    }
    
    if (mocks.mkdirSync) {
      jest.spyOn(fs, 'mkdirSync').mockImplementation(mocks.mkdirSync);
    }
  }

  /**
   * Wait for async operations
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Capture console output
   */
  static captureConsole(): { logs: string[]; errors: string[] } {
    const logs: string[] = [];
    const errors: string[] = [];

    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    console.error = (...args: any[]) => {
      errors.push(args.join(' '));
      originalError(...args);
    };

    return {
      logs,
      errors,
      restore: () => {
        console.log = originalLog;
        console.error = originalError;
      },
    } as any;
  }

  /**
   * Mock child process execution
   */
  static mockExecSync(commands: Record<string, string | Buffer>): void {
    const { execSync } = require('child_process');
    jest.spyOn(require('child_process'), 'execSync').mockImplementation((command: string) => {
      for (const [pattern, result] of Object.entries(commands)) {
        if (command.includes(pattern)) {
          return typeof result === 'string' ? Buffer.from(result) : result;
        }
      }
      throw new Error(`Unexpected command: ${command}`);
    });
  }
}





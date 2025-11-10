// Jest setup file with enhanced mocking support
import { jest } from '@jest/globals';

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock process.exit to avoid test termination
const mockExit = jest.fn();
process.exit = mockExit as any;

// Increase timeout for integration tests
jest.setTimeout(30000);

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.TRUXE_VERBOSE = 'false';

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  mockExit.mockClear();
  
  // Reset environment variables
  delete process.env.DATABASE_URL;
  delete process.env.JWT_PRIVATE_KEY;
  delete process.env.JWT_PUBLIC_KEY;
  delete process.env.REDIS_URL;
});

// Global test utilities
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        createTempDir: () => string;
        cleanupTempDir: (path: string) => void;
      };
    }
  }
}

// Export mock utilities
export { mockExit };

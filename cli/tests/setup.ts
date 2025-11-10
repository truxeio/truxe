// Jest setup file
import { jest } from '@jest/globals';

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock process.exit to avoid test termination
const mockExit = jest.fn();
process.exit = mockExit as any;

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  mockExit.mockClear();
});

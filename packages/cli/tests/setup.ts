// Vitest setup file
// This file runs before all tests

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to silence console.log during tests
  // log: vi.fn(),
  // debug: vi.fn(),
  // info: vi.fn(),
  // warn: vi.fn(),
  // error: vi.fn(),
};


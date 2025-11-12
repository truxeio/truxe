/**
 * Jest Configuration for Heimdall API
 *
 * Supports ES Modules with Babel transformation
 */

module.exports = {
  // Use Babel for ES modules transformation
  transform: {
    '^.+\\.js$': 'babel-jest',
  },

  // Test environment
  testEnvironment: 'node',

  // Module file extensions
  moduleFileExtensions: ['js', 'json'],

  // Test match patterns - exclude node:test files (*.node.test.js)
  testMatch: [
    '**/tests/**/!(*.node).test.js',
  ],

  // Coverage configuration
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/**/*.config.js',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module name mapper for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    // Exclude Node.js built-in test runner tests (use separate npm script)
    'github-actions\\.test\\.js',
    'github-app\\.test\\.js',
    'github-client\\.test\\.js',
    'github-repository-sync\\.test\\.js',
    'github-search\\.test\\.js',
    'github-templates\\.test\\.js',
    'oauth-apple-provider\\.test\\.js',
    'oauth-google-provider\\.test\\.js',
    'oauth-infrastructure\\.test\\.js',
    'oauth-microsoft-provider\\.test\\.js',
  ],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Reset mocks after each test
  resetMocks: true,

  // Timeout for tests
  testTimeout: 10000,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: false,
}

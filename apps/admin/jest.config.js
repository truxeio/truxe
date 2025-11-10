module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  
  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@truxe/ui$': '<rootDir>/src/index.ts'
  },
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Test patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.(ts|tsx)',
    '<rootDir>/src/**/*.(test|spec).(ts|tsx)'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.(ts|tsx)',
    '!src/**/*.d.ts',
    '!src/**/*.stories.(ts|tsx)',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/setupTests.ts'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Test timeout
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Module paths
  modulePaths: ['<rootDir>/src'],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@testing-library|@playwright))'
  ],
  
  // Globals
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },
  
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Error handling
  errorOnDeprecated: true,
  
  // Bail on first failure
  bail: false,
  
  // Max workers
  maxWorkers: '50%',
  
  // Cache
  cache: true,
  
  // Cache directory
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Reset modules
  resetModules: true,
  
  // Reset mocks
  resetMocks: true,
  
  // Clear mocks
  clearMocks: true,
  
  // Restore mocks
  restoreMocks: true,
  
  // Test results processor
  testResultsProcessor: 'jest-sonar-reporter',
  
  // Reporters
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'coverage', outputName: 'junit.xml' }],
    ['jest-html-reporters', { publicPath: 'coverage', filename: 'report.html' }]
  ],
  
  // Global setup
  globalSetup: '<rootDir>/src/setupTests.ts',
  
  // Global teardown
  globalTeardown: '<rootDir>/src/teardownTests.ts',
  
  // Test sequencer
  testSequencer: '@jest/test-sequencer',
  
  // Test timeout
  testTimeout: 10000,
  
  // Max concurrent
  maxConcurrency: 5,
  
  // Max workers
  maxWorkers: '50%',
  
  // Worker threads
  workerThreads: true,
  
  // Force exit
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: true,
  
  // Detect leaks
  detectLeaks: true,
  
  // Detect open handles timeout
  detectOpenHandlesTimeout: 10000,
  
  // Log heap usage
  logHeapUsage: true,
  
  // Pass with no tests
  passWithNoTests: true,
  
  // Preset
  preset: 'ts-jest',
  
  // Projects
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.(ts|tsx)'],
      testEnvironment: 'jsdom'
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.integration.test.(ts|tsx)'],
      testEnvironment: 'jsdom'
    }
  ],
  
  // Root directory
  rootDir: '.',
  
  // Roots
  roots: ['<rootDir>/src'],
  
  // Runner
  runner: 'jest-runner',
  
  // Test name pattern
  testNamePattern: '',
  
  // Test path pattern
  testPathPattern: '',
  
  // Test regex
  testRegex: '',
  
  // Test timeout
  testTimeout: 10000,
  
  // Timers
  timers: 'real',
  
  // Transform
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@testing-library|@playwright))'
  ],
  
  // Unmocked module path patterns
  unmockedModulePathPatterns: [
    'node_modules/react',
    'node_modules/react-dom'
  ],
  
  // Update snapshot
  updateSnapshot: false,
  
  // Use fake timers
  useStderr: false,
  
  // Verbose
  verbose: true,
  
  // Watch
  watch: false,
  
  // Watch all
  watchAll: false,
  
  // Watch path ignore patterns
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/dist/',
    '<rootDir>/.jest-cache/'
  ],
  
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};
module.exports = {
  displayName: 'Admin Components',
  testMatch: [
    '<rootDir>/src/components/admin/**/*.test.{ts,tsx}',
    '<rootDir>/src/hooks/useAdminNavigation.test.{ts,tsx}',
    '<rootDir>/src/providers/AdminProvider.test.{ts,tsx}',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@truxe/ui$': '<rootDir>/src/index.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/components/admin/**/*.{ts,tsx}',
    'src/hooks/useAdminNavigation.{ts,tsx}',
    'src/providers/AdminProvider.{ts,tsx}',
    '!src/components/admin/**/*.stories.{ts,tsx}',
    '!src/components/admin/**/*.test.{ts,tsx}',
    '!src/components/admin/**/index.ts',
  ],
  coverageDirectory: 'coverage/admin',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
};


# CLI Testing Guide

This directory contains comprehensive tests for the Truxe CLI tool, following best practices for testing command-line applications.

## Test Structure

```
tests/
├── commands/              # Unit tests for individual commands
│   ├── init.test.ts       # Tests for `truxe init`
│   ├── keys.test.ts       # Tests for `truxe keys`
│   ├── health.test.ts     # Tests for `truxe health`
│   └── migrate.test.ts    # Tests for `truxe migrate`
├── integration/           # Integration tests
│   ├── init.integration.test.ts
│   ├── keys.integration.test.ts
│   └── health.integration.test.ts
├── utils/                 # Test utilities and helpers
│   ├── config.test.ts
│   └── test-helpers.ts
├── setup.ts              # Jest setup and global mocks
└── README.md             # This file
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- init.test.ts
```

### Run integration tests only
```bash
npm test -- integration
```

## Test Categories

### Unit Tests

Unit tests focus on testing individual functions and methods in isolation:
- **Mocking**: External dependencies are mocked (file system, child processes, etc.)
- **Fast**: Tests run quickly without real I/O operations
- **Isolated**: Each test is independent and doesn't affect others

**Example**: Testing `ProjectUtils.validateProjectName()` with various inputs

### Integration Tests

Integration tests verify that multiple components work together:
- **Real operations**: Use actual file system and crypto operations
- **Full flows**: Test complete command execution paths
- **Temporary directories**: Create and clean up test directories

**Example**: Testing the full `truxe init` flow from start to finish

## Best Practices

### 1. Test Structure (AAA Pattern)

```typescript
test('should do something', () => {
  // Arrange: Set up test data and mocks
  const input = 'test-input';
  mockFunction.mockReturnValue('expected');
  
  // Act: Execute the code being tested
  const result = functionUnderTest(input);
  
  // Assert: Verify the results
  expect(result).toBe('expected');
  expect(mockFunction).toHaveBeenCalledWith(input);
});
```

### 2. Mocking Strategy

- **Mock external dependencies**: File system, network calls, child processes
- **Use real implementations**: For pure functions and utilities
- **Clean up mocks**: Reset mocks in `afterEach` hooks

### 3. Test Naming

- Use descriptive test names that explain what is being tested
- Include expected behavior in the name
- Group related tests using `describe` blocks

```typescript
describe('ProjectUtils.validateProjectName', () => {
  test('should accept valid project names', () => { ... });
  test('should reject invalid project names', () => { ... });
  test('should throw TruxeError with proper code', () => { ... });
});
```

### 4. Error Testing

Always test error cases:
- Invalid inputs
- Missing dependencies
- Permission errors
- Network failures

### 5. Edge Cases

Test boundary conditions:
- Empty strings
- Very long strings
- Special characters
- Null/undefined values

## Test Utilities

The `test-helpers.ts` file provides utilities for common testing tasks:

```typescript
import { TestHelpers } from './utils/test-helpers';

// Create temporary directory
const tempDir = TestHelpers.createTempDir();

// Create mock project structure
TestHelpers.createMockProject(tempDir, {
  name: 'test-project',
  template: 'nextjs',
  hasConfig: true,
});

// Clean up
TestHelpers.cleanupTempDir(tempDir);
```

## Coverage Goals

- **Unit Tests**: Aim for >80% code coverage
- **Integration Tests**: Cover all major user flows
- **Critical Paths**: 100% coverage for error handling

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Before publishing to npm

## Debugging Tests

### Run tests with verbose output
```bash
npm test -- --verbose
```

### Run a single test
```bash
npm test -- --testNamePattern="should accept valid project names"
```

### Debug with Node.js inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Common Issues

### Tests failing due to file system operations
- Ensure temporary directories are cleaned up in `afterEach`
- Use `TestHelpers.createTempDir()` for consistent temp directory handling

### Mock not working
- Check that mocks are set up in `beforeEach`
- Verify `jest.clearAllMocks()` is called in `afterEach`
- Ensure mocks are imported correctly

### Integration tests failing
- Check that required system tools are available (git, npm, etc.)
- Verify file permissions for temporary directories
- Ensure cleanup happens even if tests fail

## Adding New Tests

When adding tests for a new command:

1. Create unit test file: `tests/commands/[command].test.ts`
2. Create integration test file: `tests/integration/[command].integration.test.ts`
3. Follow existing patterns and structure
4. Add test utilities if needed
5. Update this README if adding new test categories

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [CLI Testing Guide](https://github.com/lerna/lerna/blob/main/guides/testing.md)


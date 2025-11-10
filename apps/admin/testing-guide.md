# Testing Guide

This guide provides comprehensive documentation for testing the Truxe Admin Dashboard, including unit tests, integration tests, E2E tests, and testing best practices.

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [E2E Testing](#e2e-testing)
5. [Accessibility Testing](#accessibility-testing)
6. [Performance Testing](#performance-testing)
7. [Test Configuration](#test-configuration)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Testing Strategy

### Testing Pyramid

The testing strategy follows the testing pyramid approach:

1. **Unit Tests (70%)**: Test individual components in isolation
2. **Integration Tests (20%)**: Test component interactions and data flow
3. **E2E Tests (10%)**: Test complete user workflows

### Testing Tools

- **Jest**: Unit and integration testing
- **React Testing Library**: Component testing utilities
- **Playwright**: E2E testing
- **Pa11y**: Accessibility testing
- **Lighthouse**: Performance testing
- **axe-core**: Accessibility testing library

## Unit Testing

### Component Testing

Test individual components in isolation with mocked dependencies.

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from '../DataTable';

describe('DataTable', () => {
  it('renders data correctly', () => {
    const data = [{ id: 1, name: 'John' }];
    const columns = [{ key: 'name', label: 'Name' }];
    
    render(<DataTable data={data} columns={columns} />);
    
    expect(screen.getByText('John')).toBeInTheDocument();
  });
});
```

### Hook Testing

Test custom hooks using `@testing-library/react-hooks`.

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useAdminNavigation } from '../useAdminNavigation';

describe('useAdminNavigation', () => {
  it('should navigate to new route', () => {
    const { result } = renderHook(() => useAdminNavigation());
    
    act(() => {
      result.current.navigateTo('/users');
    });
    
    expect(result.current.currentRoute).toBe('/users');
  });
});
```

### Utility Testing

Test utility functions and helpers.

```typescript
import { formatBytes, getRelativeLuminance } from '../utils';

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
  });
});
```

### Running Unit Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test DataTable.test.tsx

# Run tests matching pattern
npm run test -- --testNamePattern="DataTable"
```

## Integration Testing

### Component Integration

Test how components work together.

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AdminProvider } from '../AdminProvider';
import { AdminLayout } from '../AdminLayout';
import { DataTable } from '../DataTable';

describe('AdminLayout Integration', () => {
  it('should render data table within layout', () => {
    render(
      <AdminProvider>
        <AdminLayout>
          <DataTable data={data} columns={columns} />
        </AdminLayout>
      </AdminProvider>
    );
    
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
```

### Data Flow Testing

Test data flow between components.

```typescript
describe('Data Flow', () => {
  it('should update table when data changes', () => {
    const { rerender } = render(<DataTable data={initialData} columns={columns} />);
    
    expect(screen.getByText('John')).toBeInTheDocument();
    
    rerender(<DataTable data={updatedData} columns={columns} />);
    
    expect(screen.getByText('Jane')).toBeInTheDocument();
    expect(screen.queryByText('John')).not.toBeInTheDocument();
  });
});
```

### Context Testing

Test React Context providers and consumers.

```typescript
describe('AdminProvider', () => {
  it('should provide admin context to children', () => {
    render(
      <AdminProvider>
        <TestComponent />
      </AdminProvider>
    );
    
    expect(screen.getByText('Admin Context Available')).toBeInTheDocument();
  });
});
```

### Running Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run specific integration test
npm run test:integration AdminLayout.integration.test.tsx
```

## E2E Testing

### Playwright Setup

E2E tests use Playwright for cross-browser testing.

```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard E2E', () => {
  test('should load dashboard successfully', async ({ page }) => {
    await page.goto('/admin/dashboard');
    
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="topbar"]')).toBeVisible();
  });
});
```

### User Workflow Testing

Test complete user workflows.

```typescript
test('should create new user', async ({ page }) => {
  await page.goto('/admin/users');
  
  // Click add user button
  await page.click('text=Add User');
  
  // Fill form
  await page.fill('input[name="name"]', 'John Doe');
  await page.fill('input[name="email"]', 'john@example.com');
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Verify user was created
  await expect(page.locator('text=John Doe')).toBeVisible();
});
```

### Cross-Browser Testing

Test across different browsers and devices.

```typescript
test.describe('Cross-Browser Testing', () => {
  test('should work in Chrome', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
  
  test('should work in Firefox', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
  
  test('should work in Safari', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
});
```

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in headed mode
npm run test:e2e:headed

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run specific E2E test
npm run test:e2e admin-dashboard.spec.ts
```

## Accessibility Testing

### Automated Accessibility Testing

Use axe-core for automated accessibility testing.

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';
import { DataTable } from '../DataTable';

expect.extend(toHaveNoViolations);

test('should not have accessibility violations', async () => {
  const { container } = render(<DataTable data={data} columns={columns} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Manual Accessibility Testing

Test with screen readers and keyboard navigation.

```typescript
test('should be keyboard accessible', async ({ page }) => {
  await page.goto('/admin/dashboard');
  
  // Test tab navigation
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  
  // Test arrow key navigation
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  
  // Test enter key activation
  await page.keyboard.press('Enter');
});
```

### Running Accessibility Tests

```bash
# Run accessibility tests
npm run test:accessibility

# Run accessibility audit
npm run audit:accessibility

# Generate accessibility report
npm run generate:accessibility-report
```

## Performance Testing

### Performance Metrics Testing

Test performance metrics and thresholds.

```typescript
import { PerformanceTester } from '../PerformanceTester';

test('should meet performance thresholds', async () => {
  const tester = new PerformanceTester();
  const results = await tester.runComprehensiveTest();
  
  expect(results.every(result => result.passed)).toBe(true);
});
```

### Load Testing

Test component performance under load.

```typescript
test('should handle large datasets', async () => {
  const largeData = generateLargeDataset(10000);
  
  const startTime = performance.now();
  render(<DataTable data={largeData} columns={columns} />);
  const endTime = performance.now();
  
  expect(endTime - startTime).toBeLessThan(1000); // Should render in < 1s
});
```

### Running Performance Tests

```bash
# Run performance tests
npm run test:performance

# Run performance tests with custom thresholds
npm run test:performance:custom

# Generate performance report
npm run generate:performance-report
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverageFrom: [
    'src/**/*.(ts|tsx)',
    '!src/**/*.d.ts',
    '!src/**/*.stories.(ts|tsx)'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
```

## Best Practices

### 1. Test Structure

Follow the AAA pattern (Arrange, Act, Assert).

```typescript
test('should handle user interaction', () => {
  // Arrange
  const onSort = jest.fn();
  render(<DataTable data={data} columns={columns} onSort={onSort} />);
  
  // Act
  fireEvent.click(screen.getByText('Name'));
  
  // Assert
  expect(onSort).toHaveBeenCalledWith('name', 'asc');
});
```

### 2. Test Naming

Use descriptive test names that explain what is being tested.

```typescript
// Good
test('should display error message when form validation fails')

// Bad
test('should work')
```

### 3. Test Isolation

Each test should be independent and not rely on other tests.

```typescript
// Good
beforeEach(() => {
  jest.clearAllMocks();
});

// Bad
test('should work after previous test', () => {
  // This test depends on previous test state
});
```

### 4. Mocking

Mock external dependencies and focus on testing the component logic.

```typescript
// Mock external dependencies
jest.mock('../api', () => ({
  fetchUsers: jest.fn()
}));

// Test component logic
test('should display users when data is loaded', () => {
  // Test implementation
});
```

### 5. Accessibility Testing

Always test accessibility in your components.

```typescript
test('should be accessible', async () => {
  const { container } = render(<DataTable data={data} columns={columns} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 6. Performance Testing

Test performance-critical components.

```typescript
test('should render large datasets efficiently', () => {
  const largeData = generateLargeDataset(1000);
  
  const startTime = performance.now();
  render(<DataTable data={largeData} columns={columns} />);
  const endTime = performance.now();
  
  expect(endTime - startTime).toBeLessThan(100);
});
```

## Troubleshooting

### Common Issues

1. **Tests failing due to missing mocks**
   - Check if all external dependencies are mocked
   - Verify mock implementations are correct

2. **Tests timing out**
   - Increase test timeout
   - Check for infinite loops or long-running operations

3. **Accessibility tests failing**
   - Check ARIA attributes
   - Verify keyboard navigation
   - Test with screen readers

4. **Performance tests failing**
   - Check bundle size
   - Optimize component rendering
   - Use React.memo and useMemo

### Debugging Tips

1. **Use debug() to inspect rendered output**
   ```typescript
   import { debug } from '@testing-library/react';
   
   test('should render correctly', () => {
     render(<DataTable data={data} columns={columns} />);
     debug(); // Prints the rendered HTML
   });
   ```

2. **Use screen.logTestingPlaygroundURL() for Playwright**
   ```typescript
   test('should find element', async ({ page }) => {
     await page.goto('/admin/dashboard');
     await screen.logTestingPlaygroundURL();
   });
   ```

3. **Use --verbose flag for detailed output**
   ```bash
   npm run test -- --verbose
   ```

### Test Maintenance

1. **Keep tests up to date with component changes**
2. **Remove obsolete tests**
3. **Refactor tests when components are refactored**
4. **Add tests for new features**
5. **Review test coverage regularly**

## Conclusion

This testing guide provides a comprehensive approach to testing the Truxe Admin Dashboard. By following these practices and using the provided tools, you can ensure high-quality, reliable, and maintainable code.

For more information, see:
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [axe-core Documentation](https://github.com/dequelabs/axe-core)


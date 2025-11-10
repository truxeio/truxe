# API Reference

This document provides comprehensive API reference for all admin dashboard components, hooks, and utilities.

## Table of Contents

1. [Components](#components)
2. [Hooks](#hooks)
3. [Utilities](#utilities)
4. [Types](#types)
5. [Constants](#constants)

## Components

### AdminLayout

Main layout component for the admin dashboard.

```typescript
interface AdminLayoutProps {
  currentRoute?: string;
  onRouteChange?: (route: string) => void;
  children: React.ReactNode;
  className?: string;
}
```

**Example:**
```typescript
<AdminLayout
  currentRoute="/dashboard"
  onRouteChange={(route) => console.log('Route changed:', route)}
>
  <div>Dashboard content</div>
</AdminLayout>
```

### AccessibleAdminLayout

Enhanced layout with full accessibility support.

```typescript
interface AccessibleAdminLayoutProps {
  children: React.ReactNode;
  currentRoute?: string;
  onRouteChange?: (route: string) => void;
  showAccessibilityTester?: boolean;
  className?: string;
}
```

**Example:**
```typescript
<AccessibleAdminLayout
  currentRoute="/dashboard"
  onRouteChange={(route) => console.log('Route changed:', route)}
  showAccessibilityTester={true}
>
  <div>Accessible dashboard content</div>
</AccessibleAdminLayout>
```

### Sidebar

Navigation sidebar component.

```typescript
interface SidebarProps {
  currentRoute?: string;
  onRouteChange?: (route: string) => void;
  onClose?: () => void;
  className?: string;
}
```

**Example:**
```typescript
<Sidebar
  currentRoute="/dashboard"
  onRouteChange={(route) => console.log('Route changed:', route)}
  onClose={() => console.log('Sidebar closed')}
/>
```

### TopBar

Top navigation bar component.

```typescript
interface TopBarProps {
  onMenuClick?: () => void;
  currentRoute?: string;
  showMenuButton?: boolean;
  className?: string;
}
```

**Example:**
```typescript
<TopBar
  onMenuClick={() => console.log('Menu clicked')}
  currentRoute="/dashboard"
  showMenuButton={true}
/>
```

### Breadcrumb

Navigation breadcrumb component.

```typescript
interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

interface BreadcrumbItem {
  label: string;
  href: string;
}
```

**Example:**
```typescript
<Breadcrumb
  items={[
    { label: 'Admin', href: '/admin' },
    { label: 'Dashboard', href: '/admin/dashboard' }
  ]}
/>
```

### AdminRouter

Router component with role-based access control.

```typescript
interface AdminRouterProps {
  routes: AdminRoute[];
  userRole: string;
  onRouteChange?: (route: string) => void;
  className?: string;
}

interface AdminRoute {
  path: string;
  component: React.ComponentType;
  roles: string[];
}
```

**Example:**
```typescript
<AdminRouter
  routes={[
    { path: '/dashboard', component: Dashboard, roles: ['admin', 'user'] },
    { path: '/users', component: Users, roles: ['admin'] }
  ]}
  userRole="admin"
  onRouteChange={(route) => console.log('Route changed:', route)}
/>
```

### DataTable

Basic data table component.

```typescript
interface DataTableProps {
  data: any[];
  columns: Column[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: any) => void;
  className?: string;
}

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}
```

**Example:**
```typescript
<DataTable
  data={[
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ]}
  columns={[
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' }
  ]}
  onSort={(column, direction) => console.log('Sort:', column, direction)}
  onRowClick={(row) => console.log('Row clicked:', row)}
/>
```

### AccessibleDataTable

Enhanced data table with full accessibility support.

```typescript
interface AccessibleDataTableProps {
  data: any[];
  columns: Column[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: any) => void;
  onRowSelect?: (row: any, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}
```

**Example:**
```typescript
<AccessibleDataTable
  data={users}
  columns={columns}
  onSort={(column, direction) => console.log('Sort:', column, direction)}
  onRowClick={(row) => console.log('Row clicked:', row)}
  onRowSelect={(row, selected) => console.log('Row selected:', row, selected)}
  onSelectAll={(selected) => console.log('Select all:', selected)}
  aria-label="User management table"
/>
```

### StatsCard

Statistics display card.

```typescript
interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: string;
  className?: string;
}
```

**Example:**
```typescript
<StatsCard
  title="Total Users"
  value="1,234"
  change="+12%"
  changeType="positive"
  icon="👥"
/>
```

### Card

Generic card component.

```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
}
```

**Example:**
```typescript
<Card className="p-6">
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</Card>
```

### FormField

Form field component with validation.

```typescript
interface FormFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  helpText?: string;
  className?: string;
}
```

**Example:**
```typescript
<FormField
  label="Email Address"
  type="email"
  value={email}
  onChange={(value) => setEmail(value)}
  error="Invalid email format"
  required
  helpText="Enter your email address"
/>
```

### Modal

Modal dialog component.

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  className?: string;
}
```

**Example:**
```typescript
<Modal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="Confirm Action"
  size="md"
>
  <p>Are you sure you want to perform this action?</p>
</Modal>
```

### Badge

Status badge component.

```typescript
interface BadgeProps {
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'gray';
  children: React.ReactNode;
  className?: string;
}
```

**Example:**
```typescript
<Badge color="green">Active</Badge>
<Badge color="red">Inactive</Badge>
```

### PerformanceMonitor

Real-time performance monitoring component.

```typescript
interface PerformanceMonitorProps {
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
  showMetrics?: boolean;
  className?: string;
}
```

**Example:**
```typescript
<PerformanceMonitor
  onMetricsUpdate={(metrics) => console.log('Metrics:', metrics)}
  showMetrics={true}
/>
```

### PerformanceOptimizedAdmin

Performance-optimized admin dashboard.

```typescript
interface PerformanceOptimizedAdminProps {
  initialRoute?: string;
  enablePerformanceMonitoring?: boolean;
  preloadComponents?: boolean;
  className?: string;
}
```

**Example:**
```typescript
<PerformanceOptimizedAdmin
  initialRoute="/dashboard"
  enablePerformanceMonitoring={true}
  preloadComponents={true}
/>
```

### AccessibilityTester

Accessibility testing and validation component.

```typescript
interface AccessibilityTesterProps {
  showDetails?: boolean;
  className?: string;
}
```

**Example:**
```typescript
<AccessibilityTester
  showDetails={true}
/>
```

## Hooks

### useAdminNavigation

Navigation state management hook.

```typescript
interface UseAdminNavigationReturn {
  currentRoute: string;
  navigateTo: (route: string) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}
```

**Example:**
```typescript
const {
  currentRoute,
  navigateTo,
  goBack,
  goForward
} = useAdminNavigation();
```

### useAccessibility

Accessibility utilities hook.

```typescript
interface UseAccessibilityReturn {
  announce: (text: string, priority?: 'polite' | 'assertive') => void;
  announcePageChange: (title: string) => void;
  announceValidationError: (fieldName: string, error: string) => void;
  announceSuccess: (message: string) => void;
  announcements: string[];
}
```

**Example:**
```typescript
const {
  announce,
  announcePageChange,
  announceValidationError,
  announceSuccess
} = useAccessibility();
```

### useFocusTrap

Focus management hook.

```typescript
function useFocusTrap(isActive: boolean): RefObject<HTMLElement>;
```

**Example:**
```typescript
const containerRef = useFocusTrap(isActive);
```

### useKeyboardNavigation

Keyboard navigation hook.

```typescript
function useKeyboardNavigation(
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void
): void;
```

**Example:**
```typescript
useKeyboardNavigation((direction) => {
  console.log('Navigation:', direction);
});
```

### usePerformanceOptimization

Performance optimization hook.

```typescript
interface UsePerformanceOptimizationReturn {
  isOptimized: boolean;
  enableOptimizations: () => void;
  disableOptimizations: () => void;
  getOptimizationStatus: () => PerformanceOptimizationConfig;
}
```

**Example:**
```typescript
const {
  isOptimized,
  enableOptimizations,
  disableOptimizations
} = usePerformanceOptimization();
```

## Utilities

### Performance Utilities

#### measurePerformance

Measure performance of a function.

```typescript
function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): Promise<T>;
```

**Example:**
```typescript
const result = await measurePerformance('dashboard-load', async () => {
  return await loadDashboardData();
});
```

#### getPerformanceMetrics

Get current performance metrics.

```typescript
function getPerformanceMetrics(): Promise<PerformanceMetrics>;
```

**Example:**
```typescript
const metrics = await getPerformanceMetrics();
console.log('Load time:', metrics.loadTime);
```

#### createLazyComponent

Create a lazy-loaded component.

```typescript
function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
): T;
```

**Example:**
```typescript
const LazyDashboard = createLazyComponent(
  () => import('./Dashboard'),
  () => <LoadingSpinner />
);
```

#### preloadComponent

Preload a component.

```typescript
function preloadComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): Promise<T>;
```

**Example:**
```typescript
const Dashboard = await preloadComponent(() => import('./Dashboard'));
```

#### preloadComponents

Preload multiple components.

```typescript
function preloadComponents(
  components: Array<() => Promise<any>>
): Promise<void>;
```

**Example:**
```typescript
await preloadComponents([
  () => import('./Dashboard'),
  () => import('./Users'),
  () => import('./Settings')
]);
```

### Accessibility Utilities

#### focusManagement

Focus management utilities.

```typescript
const focusManagement = {
  getFocusableElements: (container: HTMLElement) => HTMLElement[];
  getFirstFocusable: (container: HTMLElement) => HTMLElement | null;
  getLastFocusable: (container: HTMLElement) => HTMLElement | null;
  focusFirst: (container: HTMLElement) => boolean;
  focusLast: (container: HTMLElement) => boolean;
  focusNext: (currentElement: HTMLElement) => boolean;
  focusPrevious: (currentElement: HTMLElement) => boolean;
};
```

**Example:**
```typescript
const firstElement = focusManagement.getFirstFocusable(container);
if (firstElement) {
  firstElement.focus();
}
```

#### screenReader

Screen reader utilities.

```typescript
const screenReader = {
  announce: (text: string, priority?: 'polite' | 'assertive') => void;
  announcePageChange: (title: string) => void;
  announceValidationError: (fieldName: string, error: string) => void;
  announceSuccess: (message: string) => void;
};
```

**Example:**
```typescript
screenReader.announce('Page changed to Dashboard', 'polite');
screenReader.announceValidationError('email', 'Invalid format');
```

#### colorContrast

Color contrast utilities.

```typescript
const colorContrast = {
  getRelativeLuminance: (r: number, g: number, b: number) => number;
  getContrastRatio: (color1: string, color2: string) => number;
  meetsWCAGAA: (foreground: string, background: string) => boolean;
  meetsWCAGAAA: (foreground: string, background: string) => boolean;
};
```

**Example:**
```typescript
const meetsAA = colorContrast.meetsWCAGAA('#000000', '#ffffff');
console.log('Meets WCAG AA:', meetsAA);
```

#### accessibilityTesting

Accessibility testing utilities.

```typescript
const accessibilityTesting = {
  hasProperARIA: (element: HTMLElement) => boolean;
  isKeyboardAccessible: (element: HTMLElement) => boolean;
  hasProperContrast: (element: HTMLElement) => boolean;
  runAccessibilityCheck: (element: HTMLElement) => AccessibilityCheckResult;
};
```

**Example:**
```typescript
const check = accessibilityTesting.runAccessibilityCheck(element);
console.log('Accessibility check:', check);
```

## Types

### Performance Types

```typescript
interface PerformanceMetrics {
  loadTime: number;
  bundleSize: number;
  memoryUsage: number;
  componentCount: number;
  renderTime: number;
  cacheHitRate: number;
}

interface PerformanceOptimizationConfig {
  enableCodeSplitting: boolean;
  enableLazyLoading: boolean;
  enableMemoization: boolean;
  enableCaching: boolean;
  enableCompression: boolean;
}

interface PerformanceTestResult {
  testName: string;
  passed: boolean;
  metrics: PerformanceMetrics;
  threshold: PerformanceThreshold;
  score: number;
  recommendations: string[];
}

interface PerformanceThreshold {
  maxLoadTime: number;
  maxBundleSize: number;
  maxMemoryUsage: number;
  minCacheHitRate: number;
  maxRenderTime: number;
}
```

### Accessibility Types

```typescript
interface AccessibilityCheckResult {
  hasProperARIA: boolean;
  isKeyboardAccessible: boolean;
  hasProperContrast: boolean;
  issues: string[];
}

interface AccessibilityIssue {
  element: string;
  type: 'aria' | 'keyboard' | 'contrast';
  severity: 'error' | 'warning' | 'info';
  message: string;
  recommendation: string;
}
```

### Admin Types

```typescript
interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AdminRoute {
  path: string;
  component: React.ComponentType;
  roles: string[];
  label?: string;
  icon?: string;
}

interface AdminRouterContextType {
  currentRoute: string;
  navigateTo: (route: string) => void;
  canAccess: (route: string) => boolean;
  userRole: string;
}
```

## Constants

### ARIA Constants

```typescript
const ARIA_ROLES = {
  BUTTON: 'button',
  MENU: 'menu',
  MENUITEM: 'menuitem',
  NAVIGATION: 'navigation',
  MAIN: 'main',
  BANNER: 'banner',
  CONTENTINFO: 'contentinfo',
  COMPLEMENTARY: 'complementary',
  SEARCH: 'search',
  FORM: 'form',
  TABLIST: 'tablist',
  TAB: 'tab',
  TABPANEL: 'tabpanel',
  DIALOG: 'dialog',
  ALERT: 'alert',
  STATUS: 'status',
  PROGRESSBAR: 'progressbar',
  TOOLTIP: 'tooltip',
  GRID: 'grid',
  ROW: 'row',
  CELL: 'cell',
  COLUMNHEADER: 'columnheader',
  ROWHEADER: 'rowheader'
} as const;
```

### Keyboard Constants

```typescript
const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace',
  F1: 'F1',
  F2: 'F2',
  F3: 'F3',
  F4: 'F4',
  F5: 'F5',
  F6: 'F6',
  F7: 'F7',
  F8: 'F8',
  F9: 'F9',
  F10: 'F10',
  F11: 'F11',
  F12: 'F12'
} as const;
```

### Performance Constants

```typescript
const DEFAULT_THRESHOLDS: PerformanceThreshold = {
  maxLoadTime: 2000, // 2 seconds
  maxBundleSize: 500 * 1024, // 500KB
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB
  minCacheHitRate: 0.8, // 80%
  maxRenderTime: 100, // 100ms
};
```

## Error Handling

### Common Errors

1. **Component not found**: Check imports and component names
2. **Type errors**: Verify prop types and interfaces
3. **Runtime errors**: Check component state and props
4. **Accessibility errors**: Use accessibility testing tools
5. **Performance issues**: Enable performance monitoring

### Error Boundaries

```typescript
import { ErrorBoundary, ErrorFallback } from '@truxe/ui';

<ErrorBoundary fallback={<ErrorFallback />}>
  <YourComponent />
</ErrorBoundary>
```

## Testing

### Unit Testing

```typescript
import { render, screen } from '@testing-library/react';
import { DataTable } from '@truxe/ui';

test('renders data table', () => {
  render(
    <DataTable
      data={[{ id: 1, name: 'John' }]}
      columns={[{ key: 'name', label: 'Name' }]}
    />
  );
  
  expect(screen.getByText('John')).toBeInTheDocument();
});
```

### Accessibility Testing

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';
import { DataTable } from '@truxe/ui';

expect.extend(toHaveNoViolations);

test('should not have accessibility violations', async () => {
  const { container } = render(
    <DataTable
      data={[{ id: 1, name: 'John' }]}
      columns={[{ key: 'name', label: 'Name' }]}
    />
  );
  
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Performance Testing

```typescript
import { PerformanceTester } from '@truxe/ui';

test('meets performance thresholds', async () => {
  const tester = new PerformanceTester();
  const results = await tester.runComprehensiveTest();
  
  expect(results.every(result => result.passed)).toBe(true);
});
```

## Migration Guide

### Upgrading Components

1. **Check breaking changes** in the changelog
2. **Update imports** if component names changed
3. **Update props** if interfaces changed
4. **Test thoroughly** after migration
5. **Update documentation** if needed

### Deprecation Warnings

- Components marked as deprecated will be removed in the next major version
- Use the recommended alternatives
- Update your code before upgrading

## Support

- **Documentation**: [Component Usage Guide](./COMPONENT-USAGE-GUIDE.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/truxe/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/truxe/discussions)
- **Email**: support@truxe.com


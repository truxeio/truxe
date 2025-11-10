# Component Usage Guide

This guide provides comprehensive documentation for all admin dashboard components, including usage examples, props, and best practices.

## Table of Contents

1. [Layout Components](#layout-components)
2. [Navigation Components](#navigation-components)
3. [Data Display Components](#data-display-components)
4. [Form Components](#form-components)
5. [UI Components](#ui-components)
6. [Performance Components](#performance-components)
7. [Accessibility Components](#accessibility-components)
8. [Best Practices](#best-practices)

## Layout Components

### AdminLayout

The main layout component for the admin dashboard.

```typescript
import { AdminLayout } from '@truxe/ui';

<AdminLayout
  currentRoute="/dashboard"
  onRouteChange={(route) => console.log('Route changed:', route)}
>
  <div>Your dashboard content</div>
</AdminLayout>
```

**Props:**
- `currentRoute?: string` - Current active route
- `onRouteChange?: (route: string) => void` - Route change handler
- `children: React.ReactNode` - Content to render
- `className?: string` - Additional CSS classes

### AccessibleAdminLayout

Enhanced layout with full accessibility support.

```typescript
import { AccessibleAdminLayout } from '@truxe/ui';

<AccessibleAdminLayout
  currentRoute="/dashboard"
  onRouteChange={(route) => console.log('Route changed:', route)}
  showAccessibilityTester={true}
>
  <div>Your accessible dashboard content</div>
</AccessibleAdminLayout>
```

**Props:**
- `currentRoute?: string` - Current active route
- `onRouteChange?: (route: string) => void` - Route change handler
- `showAccessibilityTester?: boolean` - Show accessibility tester
- `children: React.ReactNode` - Content to render
- `className?: string` - Additional CSS classes

## Navigation Components

### Sidebar

Navigation sidebar component.

```typescript
import { Sidebar } from '@truxe/ui';

<Sidebar
  currentRoute="/dashboard"
  onRouteChange={(route) => console.log('Route changed:', route)}
  onClose={() => console.log('Sidebar closed')}
/>
```

**Props:**
- `currentRoute?: string` - Current active route
- `onRouteChange?: (route: string) => void` - Route change handler
- `onClose?: () => void` - Close handler
- `className?: string` - Additional CSS classes

### TopBar

Top navigation bar component.

```typescript
import { TopBar } from '@truxe/ui';

<TopBar
  onMenuClick={() => console.log('Menu clicked')}
  currentRoute="/dashboard"
  showMenuButton={true}
/>
```

**Props:**
- `onMenuClick?: () => void` - Menu click handler
- `currentRoute?: string` - Current active route
- `showMenuButton?: boolean` - Show menu button
- `className?: string` - Additional CSS classes

### Breadcrumb

Navigation breadcrumb component.

```typescript
import { Breadcrumb } from '@truxe/ui';

<Breadcrumb
  items={[
    { label: 'Admin', href: '/admin' },
    { label: 'Dashboard', href: '/admin/dashboard' }
  ]}
/>
```

**Props:**
- `items: BreadcrumbItem[]` - Breadcrumb items
- `className?: string` - Additional CSS classes

### AdminRouter

Router component with role-based access control.

```typescript
import { AdminRouter } from '@truxe/ui';

<AdminRouter
  routes={[
    { path: '/dashboard', component: Dashboard, roles: ['admin', 'user'] },
    { path: '/users', component: Users, roles: ['admin'] }
  ]}
  userRole="admin"
  onRouteChange={(route) => console.log('Route changed:', route)}
/>
```

**Props:**
- `routes: AdminRoute[]` - Available routes
- `userRole: string` - Current user role
- `onRouteChange?: (route: string) => void` - Route change handler
- `className?: string` - Additional CSS classes

## Data Display Components

### DataTable

Basic data table component.

```typescript
import { DataTable } from '@truxe/ui';

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

**Props:**
- `data: any[]` - Table data
- `columns: Column[]` - Column definitions
- `onSort?: (column: string, direction: 'asc' | 'desc') => void` - Sort handler
- `onRowClick?: (row: any) => void` - Row click handler
- `className?: string` - Additional CSS classes

### AccessibleDataTable

Enhanced data table with full accessibility support.

```typescript
import { AccessibleDataTable } from '@truxe/ui';

<AccessibleDataTable
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
  onRowSelect={(row, selected) => console.log('Row selected:', row, selected)}
  onSelectAll={(selected) => console.log('Select all:', selected)}
  aria-label="User management table"
/>
```

**Props:**
- `data: any[]` - Table data
- `columns: Column[]` - Column definitions
- `onSort?: (column: string, direction: 'asc' | 'desc') => void` - Sort handler
- `onRowClick?: (row: any) => void` - Row click handler
- `onRowSelect?: (row: any, selected: boolean) => void` - Row selection handler
- `onSelectAll?: (selected: boolean) => void` - Select all handler
- `aria-label?: string` - Accessibility label
- `aria-labelledby?: string` - Accessibility label reference
- `className?: string` - Additional CSS classes

### StatsCard

Statistics display card.

```typescript
import { StatsCard } from '@truxe/ui';

<StatsCard
  title="Total Users"
  value="1,234"
  change="+12%"
  changeType="positive"
  icon="👥"
/>
```

**Props:**
- `title: string` - Card title
- `value: string | number` - Main value
- `change?: string` - Change indicator
- `changeType?: 'positive' | 'negative' | 'neutral'` - Change type
- `icon?: string` - Icon to display
- `className?: string` - Additional CSS classes

### Card

Generic card component.

```typescript
import { Card } from '@truxe/ui';

<Card className="p-6">
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</Card>
```

**Props:**
- `children: React.ReactNode` - Card content
- `className?: string` - Additional CSS classes

## Form Components

### FormField

Form field component with validation.

```typescript
import { FormField } from '@truxe/ui';

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

**Props:**
- `label: string` - Field label
- `type?: string` - Input type
- `value: string` - Field value
- `onChange: (value: string) => void` - Change handler
- `error?: string` - Error message
- `required?: boolean` - Required field
- `helpText?: string` - Help text
- `className?: string` - Additional CSS classes

### Modal

Modal dialog component.

```typescript
import { Modal } from '@truxe/ui';

<Modal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="Confirm Action"
  size="md"
>
  <p>Are you sure you want to perform this action?</p>
  <div className="flex gap-2 mt-4">
    <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
    <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
  </div>
</Modal>
```

**Props:**
- `isOpen: boolean` - Modal open state
- `onClose: () => void` - Close handler
- `title?: string` - Modal title
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Modal size
- `children: React.ReactNode` - Modal content
- `className?: string` - Additional CSS classes

## UI Components

### Button

Button component with variants.

```typescript
import { Button } from '@truxe/ui';

<Button
  variant="primary"
  size="md"
  onClick={() => console.log('Clicked')}
  disabled={false}
>
  Click Me
</Button>
```

**Props:**
- `variant?: 'primary' | 'secondary' | 'outline' | 'ghost'` - Button variant
- `size?: 'sm' | 'md' | 'lg'` - Button size
- `onClick?: () => void` - Click handler
- `disabled?: boolean` - Disabled state
- `children: React.ReactNode` - Button content
- `className?: string` - Additional CSS classes

### Badge

Status badge component.

```typescript
import { Badge } from '@truxe/ui';

<Badge color="green">Active</Badge>
<Badge color="red">Inactive</Badge>
<Badge color="yellow">Pending</Badge>
```

**Props:**
- `color?: 'green' | 'red' | 'yellow' | 'blue' | 'gray'` - Badge color
- `children: React.ReactNode` - Badge content
- `className?: string` - Additional CSS classes

## Performance Components

### LazyAdminComponents

Lazy-loaded admin components for performance optimization.

```typescript
import { LazyAdminComponents } from '@truxe/ui';

const { LazyAdminDashboard, LazyUserManagement } = LazyAdminComponents;

<LazyAdminDashboard />
<LazyUserManagement />
```

### PerformanceMonitor

Real-time performance monitoring component.

```typescript
import { PerformanceMonitor } from '@truxe/ui';

<PerformanceMonitor
  onMetricsUpdate={(metrics) => console.log('Metrics:', metrics)}
  showMetrics={true}
/>
```

**Props:**
- `onMetricsUpdate?: (metrics: PerformanceMetrics) => void` - Metrics update handler
- `showMetrics?: boolean` - Show metrics display
- `className?: string` - Additional CSS classes

### PerformanceOptimizedAdmin

Performance-optimized admin dashboard.

```typescript
import { PerformanceOptimizedAdmin } from '@truxe/ui';

<PerformanceOptimizedAdmin
  initialRoute="/dashboard"
  enablePerformanceMonitoring={true}
  preloadComponents={true}
/>
```

**Props:**
- `initialRoute?: string` - Initial route
- `enablePerformanceMonitoring?: boolean` - Enable performance monitoring
- `preloadComponents?: boolean` - Preload components
- `className?: string` - Additional CSS classes

## Accessibility Components

### AccessibilityTester

Accessibility testing and validation component.

```typescript
import { AccessibilityTester } from '@truxe/ui';

<AccessibilityTester
  showDetails={true}
/>
```

**Props:**
- `showDetails?: boolean` - Show detailed results
- `className?: string` - Additional CSS classes

## Hooks

### useAdminNavigation

Navigation state management hook.

```typescript
import { useAdminNavigation } from '@truxe/ui';

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
import { useAccessibility } from '@truxe/ui';

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
import { useFocusTrap } from '@truxe/ui';

const containerRef = useFocusTrap(isActive);
```

### useKeyboardNavigation

Keyboard navigation hook.

```typescript
import { useKeyboardNavigation } from '@truxe/ui';

useKeyboardNavigation((direction) => {
  console.log('Navigation:', direction);
});
```

## Best Practices

### 1. Component Composition

Use composition over inheritance for flexible component design.

```typescript
// Good: Composition
<Card>
  <Card.Header>
    <Card.Title>User Management</Card.Title>
  </Card.Header>
  <Card.Body>
    <DataTable data={users} columns={columns} />
  </Card.Body>
</Card>

// Avoid: Inheritance
class UserManagementCard extends Card {
  // Complex inheritance hierarchy
}
```

### 2. Props Interface Design

Design clear, consistent prop interfaces.

```typescript
// Good: Clear, specific props
interface DataTableProps {
  data: any[];
  columns: Column[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: any) => void;
}

// Avoid: Generic, unclear props
interface DataTableProps {
  config: any;
  handlers: any;
}
```

### 3. Accessibility First

Always consider accessibility when using components.

```typescript
// Good: Accessible implementation
<Button
  onClick={handleClick}
  aria-label="Delete user"
  aria-describedby="delete-help"
>
  Delete
</Button>
<div id="delete-help" className="sr-only">
  This will permanently delete the user
</div>

// Avoid: Inaccessible implementation
<Button onClick={handleClick}>🗑️</Button>
```

### 4. Performance Optimization

Use lazy loading and performance monitoring.

```typescript
// Good: Performance optimized
import { LazyAdminComponents } from '@truxe/ui';

const { LazyUserManagement } = LazyAdminComponents;

<LazyUserManagement />

// Avoid: Loading everything upfront
import { UserManagement } from '@truxe/ui';

<UserManagement />
```

### 5. Error Handling

Implement proper error boundaries and validation.

```typescript
// Good: Error handling
<ErrorBoundary fallback={<ErrorFallback />}>
  <DataTable data={users} columns={columns} />
</ErrorBoundary>

// Avoid: No error handling
<DataTable data={users} columns={columns} />
```

### 6. Responsive Design

Ensure components work on all screen sizes.

```typescript
// Good: Responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <StatsCard title="Users" value="1,234" />
  <StatsCard title="Orders" value="567" />
  <StatsCard title="Revenue" value="$12,345" />
</div>

// Avoid: Fixed layout
<div className="flex gap-4">
  <StatsCard title="Users" value="1,234" />
  <StatsCard title="Orders" value="567" />
  <StatsCard title="Revenue" value="$12,345" />
</div>
```

## Common Patterns

### 1. Data Loading Pattern

```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await api.getUsers();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);

if (loading) return <LoadingSpinner />;
if (error) return <ErrorFallback error={error} />;

return <DataTable data={data} columns={columns} />;
```

### 2. Form Handling Pattern

```typescript
const [formData, setFormData] = useState({});
const [errors, setErrors] = useState({});

const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    await api.createUser(formData);
    announceSuccess('User created successfully');
  } catch (err) {
    setErrors(err.errors);
    announceValidationError('form', 'Please check the errors below');
  }
};

return (
  <form onSubmit={handleSubmit}>
    <FormField
      label="Name"
      value={formData.name}
      onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
      error={errors.name}
      required
    />
    <Button type="submit">Create User</Button>
  </form>
);
```

### 3. Modal Pattern

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState(null);

const handleItemClick = (item) => {
  setSelectedItem(item);
  setIsModalOpen(true);
};

return (
  <>
    <DataTable
      data={data}
      columns={columns}
      onRowClick={handleItemClick}
    />
    
    <Modal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      title="Item Details"
    >
      {selectedItem && <ItemDetails item={selectedItem} />}
    </Modal>
  </>
);
```

## Troubleshooting

### Common Issues

1. **Components not rendering**: Check imports and prop types
2. **Styling issues**: Verify Tailwind classes and custom CSS
3. **Accessibility warnings**: Use accessibility testing tools
4. **Performance issues**: Enable performance monitoring
5. **Type errors**: Check TypeScript configuration and types

### Debug Tools

- React DevTools for component inspection
- Accessibility testing tools (axe, pa11y)
- Performance monitoring (Lighthouse, bundle analyzer)
- TypeScript compiler for type checking

## Resources

- [Component Library Documentation](../docs/)
- [Design System Guide](./DESIGN-SYSTEM.md)
- [Accessibility Guide](./ACCESSIBILITY-COMPLIANCE.md)
- [Performance Guide](./PERFORMANCE-OPTIMIZATION.md)
- [API Reference](../docs/api/)


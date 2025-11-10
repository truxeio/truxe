# Admin Dashboard Components

A comprehensive set of React components for building powerful admin dashboards with Truxe authentication platform.

## 🚀 Quick Start

```tsx
import { AdminLayout, AdminDashboard, UserManagement } from '@truxe/ui';

function App() {
  const user = {
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    avatar: 'https://example.com/avatar.jpg'
  };

  return (
    <AdminLayout user={user} onLogout={() => console.log('logout')}>
      <AdminDashboard />
    </AdminLayout>
  );
}
```

## 📦 Components

### Layout Components

#### AdminLayout
The main layout wrapper that provides the admin dashboard structure with sidebar, top bar, and content area.

```tsx
<AdminLayout
  user={user}
  onLogout={handleLogout}
  className="custom-class"
>
  <YourContent />
</AdminLayout>
```

**Props:**
- `user` - User object with id, name, email, role, and optional avatar
- `onLogout` - Function called when logout is triggered
- `className` - Additional CSS classes

#### Sidebar
Collapsible sidebar navigation component.

```tsx
<Sidebar
  isCollapsed={false}
  onToggle={() => setCollapsed(!collapsed)}
  user={user}
  onLogout={handleLogout}
/>
```

#### TopBar
Top navigation bar with search, notifications, and user menu.

```tsx
<TopBar
  onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
  user={user}
  onLogout={handleLogout}
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
/>
```

### Dashboard Components

#### AdminDashboard
Main dashboard with stats cards, recent activity, and security alerts.

```tsx
<AdminDashboard className="custom-dashboard" />
```

#### StatsCard
Individual stat card component for displaying metrics.

```tsx
<StatsCard
  title="Total Users"
  value="2,847"
  change={{ value: 12.5, type: 'increase', period: 'last month' }}
  icon={Users}
  color="blue"
/>
```

### Data Management

#### DataTable
Powerful data table with sorting, filtering, pagination, and selection.

```tsx
const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'role', label: 'Role', render: (value) => <Badge>{value}</Badge> }
];

<DataTable
  data={users}
  columns={columns}
  searchable={true}
  pagination={true}
  selectable={true}
  onRowSelect={setSelectedUsers}
  onExport={handleExport}
/>
```

#### UserManagement
Complete user management interface with search, filters, and bulk actions.

```tsx
<UserManagement className="user-management" />
```

#### SecurityMonitoring
Security events monitoring with real-time alerts and threat detection.

```tsx
<SecurityMonitoring className="security-monitoring" />
```

### UI Components

#### Modal
Flexible modal dialog component.

```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Edit User"
  size="md"
>
  <form>...</form>
</Modal>
```

#### FormField
Form input component with validation and error handling.

```tsx
<FormField
  label="Email Address"
  name="email"
  type="email"
  value={email}
  onChange={setEmail}
  required={true}
  error={emailError}
  helpText="Enter a valid email address"
/>
```

#### Badge
Status and category badges.

```tsx
<Badge variant="success" size="md">Active</Badge>
<Badge variant="error" size="sm">Error</Badge>
```

#### Card
Content container with optional header and actions.

```tsx
<Card
  title="User Details"
  subtitle="Manage user information"
  actions={<Button>Edit</Button>}
>
  <p>User content here</p>
</Card>
```

## 🎨 Theming

All components support theming through Tailwind CSS classes and can be customized using the `className` prop.

### Color Variants

Components support multiple color variants:
- `blue` - Primary actions and information
- `green` - Success states and positive metrics
- `yellow` - Warnings and caution states
- `red` - Errors and critical states
- `purple` - Special features and premium content
- `gray` - Neutral and secondary content

### Size Variants

Most components support size variants:
- `sm` - Small size for compact layouts
- `md` - Medium size (default)
- `lg` - Large size for emphasis

## ♿ Accessibility

All components are built with accessibility in mind:

- **WCAG 2.1 AA Compliance** - Meets accessibility standards
- **Keyboard Navigation** - Full keyboard support
- **Screen Reader Support** - Proper ARIA labels and descriptions
- **Focus Management** - Clear focus indicators and logical tab order
- **High Contrast Support** - Works with high contrast themes

## 📱 Responsive Design

Components are mobile-first and responsive:

- **Mobile (320px+)** - Optimized for touch interactions
- **Tablet (768px+)** - Balanced layout with sidebar
- **Desktop (1024px+)** - Full feature set with expanded sidebar
- **Large Desktop (1920px+)** - Maximum content width with optimal spacing

## 🔧 Customization

### CSS Custom Properties

You can customize the appearance using CSS custom properties:

```css
:root {
  --admin-primary: #3b82f6;
  --admin-secondary: #6b7280;
  --admin-success: #10b981;
  --admin-warning: #f59e0b;
  --admin-error: #ef4444;
}
```

### Component Variants

Many components support variant props for different styles:

```tsx
<Button variant="outline" size="lg">Click me</Button>
<Badge variant="success" size="sm">Status</Badge>
<Card shadow="lg" padding="sm">Content</Card>
```

## 🧪 Testing

Components include comprehensive testing:

```tsx
import { render, screen } from '@testing-library/react';
import { AdminLayout } from '@truxe/ui';

test('renders admin layout', () => {
  render(<AdminLayout user={mockUser}>Content</AdminLayout>);
  expect(screen.getByText('Content')).toBeInTheDocument();
});
```

## 📚 Examples

### Complete Admin Dashboard

```tsx
import { 
  AdminLayout, 
  AdminDashboard, 
  UserManagement, 
  SecurityMonitoring 
} from '@truxe/ui';

function AdminApp() {
  const [currentView, setCurrentView] = useState('dashboard');
  
  const user = {
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin'
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <AdminDashboard />;
      case 'users': return <UserManagement />;
      case 'security': return <SecurityMonitoring />;
      default: return <AdminDashboard />;
    }
  };

  return (
    <AdminLayout user={user} onLogout={handleLogout}>
      {renderContent()}
    </AdminLayout>
  );
}
```

### Custom Data Table

```tsx
import { DataTable, Badge, Button } from '@truxe/ui';

const columns = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    render: (value, row) => (
      <div className="flex items-center">
        <img src={row.avatar} className="w-8 h-8 rounded-full mr-3" />
        <span>{value}</span>
      </div>
    )
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => (
      <Badge variant={value === 'active' ? 'success' : 'error'}>
        {value}
      </Badge>
    )
  },
  {
    key: 'actions',
    label: 'Actions',
    render: (value, row) => (
      <div className="flex space-x-2">
        <Button size="sm" variant="outline">Edit</Button>
        <Button size="sm" variant="outline">Delete</Button>
      </div>
    )
  }
];

<DataTable
  data={users}
  columns={columns}
  searchable={true}
  pagination={true}
  selectable={true}
  onRowSelect={setSelectedUsers}
  onExport={handleExport}
/>
```

## 🚀 Performance

- **Code Splitting** - Components are optimized for lazy loading
- **Bundle Size** - Minimal bundle impact with tree shaking
- **Rendering** - Optimized re-renders with React.memo where appropriate
- **Loading States** - Built-in loading indicators for better UX

## 🔒 Security

- **XSS Protection** - All user input is properly sanitized
- **CSRF Protection** - Forms include CSRF tokens
- **Role-Based Access** - Components respect user permissions
- **Secure Defaults** - Security-first approach to all components

## 📖 API Reference

For detailed API documentation, see the individual component files or the generated TypeScript definitions.

## 🤝 Contributing

When contributing to admin components:

1. Follow the existing component patterns
2. Include comprehensive TypeScript types
3. Add accessibility features
4. Write tests for new components
5. Update documentation

## 📄 License

MIT License - see LICENSE file for details.


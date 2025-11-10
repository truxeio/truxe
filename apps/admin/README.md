# @truxe/ui

A comprehensive, accessible React UI component library for Truxe authentication that works across all major React frameworks.

[![npm version](https://badge.fury.io/js/@truxe/ui.svg)](https://www.npmjs.com/package/@truxe/ui)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Accessibility](https://img.shields.io/badge/a11y-WCAG%202.1%20AA-green.svg)](https://www.w3.org/WAI/WCAG21/quickref/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔐 **Complete Authentication Components** - Login forms, user menus, organization switchers
- ♿ **WCAG 2.1 AA Compliant** - Full accessibility support with screen readers and keyboard navigation
- 🎨 **Multiple Themes** - Light, dark, and high-contrast modes with customizable colors
- 📱 **Responsive Design** - Works seamlessly across all device sizes
- ⚡ **Framework Agnostic** - Works with Next.js, Remix, Vite, and more
- 🎭 **Headless & Styled** - Use headless hooks or pre-built components
- 📚 **Storybook Documentation** - Interactive examples and documentation
- 🧪 **Comprehensive Testing** - Unit tests and accessibility validation
- 🔧 **TypeScript First** - Full type safety and IntelliSense support

## 🚀 Quick Start

### Installation

```bash
npm install @truxe/ui
# or
yarn add @truxe/ui
# or
pnpm add @truxe/ui
```

### Basic Setup

```tsx
import { AuthProvider, ThemeProvider, ToastProvider } from '@truxe/ui';
import '@truxe/ui/styles.css';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider
          apiConfig={{
            baseUrl: 'https://your-api.com',
            timeout: 10000,
          }}
        >
          <YourApp />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
```

### Login Form Example

```tsx
import { LoginForm } from '@truxe/ui';

function LoginPage() {
  return (
    <div className="max-w-md mx-auto mt-8">
      <LoginForm
        showOrganization={true}
        onSuccess={(result) => {
          console.log('Login successful:', result);
          // Redirect to dashboard
        }}
        onError={(error) => {
          console.error('Login failed:', error);
        }}
      />
    </div>
  );
}
```

### Protected Routes

```tsx
import { ProtectedRoute, withAuth } from '@truxe/ui';

// Using component
function Dashboard() {
  return (
    <ProtectedRoute requiredRole="member">
      <div>Protected dashboard content</div>
    </ProtectedRoute>
  );
}

// Using HOC
const ProtectedDashboard = withAuth(Dashboard, {
  requiredRole: 'admin',
  requireEmailVerification: true,
});
```

## 📦 Components

### Authentication Components

- **`LoginForm`** - Magic link authentication form
- **`UserMenu`** - User profile dropdown with actions
- **`OrganizationSwitcher`** - Multi-tenant organization selector
- **`ProtectedRoute`** - Route protection wrapper

### UI Components

- **`Button`** - Accessible button with multiple variants
- **`Input`** - Form input with validation states
- **`LoadingSpinner`** - Loading indicators and skeletons
- **`ErrorBoundary`** - Error handling components
- **`Toast`** - Notification system

### Providers

- **`AuthProvider`** - Authentication context and state management
- **`ThemeProvider`** - Theme and styling configuration
- **`ToastProvider`** - Toast notification system

## 🎨 Theming

### Default Themes

```tsx
import { ThemeProvider, THEME_VARIANTS } from '@truxe/ui';

<ThemeProvider defaultTheme={THEME_VARIANTS.DARK}>
  <App />
</ThemeProvider>
```

### Custom Theme Configuration

```tsx
import { ThemeProvider } from '@truxe/ui';

const customTheme = {
  colors: {
    primary: '#your-primary-color',
    secondary: '#your-secondary-color',
    success: '#your-success-color',
    warning: '#your-warning-color',
    error: '#your-error-color',
  },
  borderRadius: '12px',
  fontFamily: 'Inter, sans-serif',
};

<ThemeProvider config={customTheme}>
  <App />
</ThemeProvider>
```

### CSS Custom Properties

The library uses CSS custom properties for easy theming:

```css
:root {
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --border-radius: 0.5rem;
  --font-family: 'Inter', sans-serif;
}
```

## ♿ Accessibility

This library is built with accessibility as a first-class citizen:

### WCAG 2.1 AA Compliance

- ✅ **Color Contrast** - All text meets 4.5:1 contrast ratio
- ✅ **Keyboard Navigation** - Full keyboard support for all interactive elements
- ✅ **Screen Reader Support** - Proper ARIA labels and descriptions
- ✅ **Focus Management** - Visible focus indicators and logical tab order
- ✅ **Semantic HTML** - Uses proper HTML elements and roles

### Accessibility Features

```tsx
import { useAccessibility } from '@truxe/ui';

function MyComponent() {
  const { preferences, announce } = useAccessibility();
  
  // Respect user preferences
  if (preferences.reducedMotion) {
    // Disable animations
  }
  
  if (preferences.highContrast) {
    // Apply high contrast styles
  }
  
  // Announce to screen readers
  announce('Form submitted successfully', 'polite');
}
```

### Testing Accessibility

```bash
# Run accessibility tests
npm run accessibility-test

# Run with specific browser
npm run accessibility-test -- --browser=chrome

# Generate accessibility report
npm run accessibility-test -- --reporter=html
```

## 🔧 Framework Integration

### Next.js

```tsx
import { withAuth, useNextjsAuth } from '@truxe/ui/adapters/nextjs';

// Protect pages
export default withAuth(MyPage, {
  requiredRole: 'admin',
  redirectTo: '/login',
});

// Use in components
function MyComponent() {
  const { loginAndRedirect, logoutAndRedirect } = useNextjsAuth();
  
  const handleLogin = async (email: string) => {
    await loginAndRedirect(email, undefined, '/dashboard');
  };
}
```

### Remix

```tsx
import { requireAuth } from '@truxe/ui/adapters/remix';

// Protect loaders
export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireAuth(request, {
    apiUrl: process.env.TRUXE_API_URL!,
    requiredRole: 'member',
  });
  
  return json({ user });
}
```

### Vite/React Router

```tsx
import { createReactRouterAdapter } from '@truxe/ui/adapters/vite';

const { ProtectedRoute, useAuth } = createReactRouterAdapter();

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}
```

## 🧪 Testing

### Unit Tests

```bash
npm test                 # Run all tests
npm test -- --watch     # Run in watch mode
npm test -- --coverage  # Generate coverage report
```

### Accessibility Tests

```bash
npm run accessibility-test  # Run pa11y accessibility tests
npm run test:a11y           # Run jest-axe tests
```

### Storybook

```bash
npm run storybook        # Start Storybook
npm run build-storybook  # Build static Storybook
```

## 📚 API Reference

### Hooks

#### `useAuth()`

Main authentication hook providing user state and actions.

```tsx
const {
  user,                    // Current user or null
  organization,           // Current organization or null
  membership,             // User's membership in current org
  isLoading,              // Loading state
  isAuthenticated,        // Boolean authentication status
  login,                  // Login function
  logout,                 // Logout function
  verifyMagicLink,        // Verify magic link token
  switchOrganization,     // Switch organization context
} = useAuth();
```

#### `useForm()`

Form state management with validation.

```tsx
const {
  values,                 // Form values
  errors,                 // Validation errors
  touched,                // Touched fields
  isSubmitting,           // Submission state
  handleSubmit,           // Submit handler
  getFieldProps,          // Field props helper
  reset,                  // Reset form
} = useForm(initialValues, fieldConfigs);
```

#### `useToast()`

Toast notification management.

```tsx
const {
  success,                // Show success toast
  error,                  // Show error toast
  warning,                // Show warning toast
  info,                   // Show info toast
  removeToast,            // Remove specific toast
  clearToasts,            // Clear all toasts
} = useToast();
```

### Components API

#### `LoginForm`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showOrganization` | `boolean` | `false` | Show organization input field |
| `autoFocus` | `boolean` | `true` | Auto-focus email input |
| `submitText` | `string` | `'Send magic link'` | Submit button text |
| `loadingText` | `string` | `'Sending magic link...'` | Loading button text |
| `onSuccess` | `(result: AuthResult) => void` | - | Success callback |
| `onError` | `(error: Error) => void` | - | Error callback |

#### `Button`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'success' \| 'warning' \| 'error' \| 'outline' \| 'ghost' \| 'link'` | `'primary'` | Button variant |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| 'icon'` | `'md'` | Button size |
| `loading` | `boolean` | `false` | Show loading state |
| `disabled` | `boolean` | `false` | Disable button |
| `fullWidth` | `boolean` | `false` | Full width button |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/truxe-auth/truxe.git
cd truxe/ui

# Install dependencies
npm install

# Start development
npm run dev

# Run tests
npm test

# Start Storybook
npm run storybook
```

## 📄 License

MIT © [Truxe Team](https://github.com/truxe-auth)

## 🔗 Links

- [Documentation](https://docs.truxe.io)
- [Storybook](https://storybook.truxe.io)
- [GitHub](https://github.com/truxe-auth/truxe)
- [NPM](https://www.npmjs.com/package/@truxe/ui)
- [Discord](https://discord.gg/truxe)

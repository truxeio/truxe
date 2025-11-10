# Truxe – Complete Quick Start Guide

Get production-ready authentication running in your application in **5 minutes** with comprehensive examples and troubleshooting.

## 🎯 What You'll Build

By the end of this guide, you'll have:
- ✅ **Passwordless Authentication** with magic links
- ✅ **Protected Routes** with automatic redirects  
- ✅ **User Session Management** with token refresh
- ✅ **Multi-tenant Support** (optional)
- ✅ **Production-ready Security** with rate limiting

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm/yarn/pnpm
- PostgreSQL 15+ (for production) or SQLite (for development)
- Email service account (Resend recommended, free tier available)

### 1. Install Truxe CLI
```bash
# Install globally
npm install -g @truxe/cli

# Or use without installing
npx @truxe/cli@latest

# Verify installation
truxe --version
```

### 2. Initialize Your Project

#### Option A: New Project
```bash
# Create new project with authentication
truxe init my-app --template=nextjs

# Quick setup with defaults (recommended for testing)
truxe init my-app --template=nextjs --yes

# Advanced setup with custom options
truxe init my-app --template=nextjs \
  --database=postgresql \
  --email-provider=resend \
  --multi-tenant=true
```

#### Option B: Existing Project
```bash
cd my-existing-app
truxe init --template=nextjs

# The CLI will detect your framework and adapt accordingly
```

#### Available Templates
- `nextjs` - Next.js 14+ with App Router (recommended)
- `nuxt` - Nuxt 3 with SSR support
- `sveltekit` - SvelteKit with TypeScript
- `express` - Express.js API protection

### 3. Start Development Environment
```bash
cd my-app

# Start your application
npm run dev

# In another terminal, start Truxe API
npm run truxe.io
# or directly: truxe.io --port=3001
```

🎉 **That's it!** Your app now has authentication at `http://localhost:3000`

### Development URLs
- **Application**: http://localhost:3000
- **Truxe API**: http://localhost:3001  
- **API Documentation**: http://localhost:3001/docs
- **Admin Dashboard**: http://localhost:3001/admin
- **Development Email Inbox**: http://localhost:3001/dev/inbox
- **Health Check**: http://localhost:3001/health

---

## 🏗️ What Just Happened?

The `truxe init` command set up:

### ✅ Backend Infrastructure
- **Authentication API** running on `http://localhost:3001`
- **SQLite database** with user tables and security policies
- **Email service** with development inbox (no SMTP needed)
- **JWT/JWKS** endpoint for token verification

### ✅ Frontend Integration
- **Login/logout pages** with magic link authentication
- **Protected routes** with automatic redirects
- **User session management** with automatic token refresh
- **UI components** ready to customize

### ✅ Developer Tools
- **Development inbox** at `http://localhost:3001/dev/inbox`
- **Admin panel** at `http://localhost:3001/admin`
- **API documentation** at `http://localhost:3001/docs`

---

## 🔐 Complete Authentication Flow

### 1. User Login Experience
```typescript
// app/auth/login/page.tsx (automatically generated)
'use client';

import { useState } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [emailSent, setEmailSent] = useState(false);
  
  // Redirect if already authenticated
  if (isLoading) return <div className="flex justify-center p-8"><LoadingSpinner /></div>;
  if (user) router.push('/dashboard');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
          <p className="text-gray-600">Sign in to your account</p>
        </div>
        
        {emailSent ? (
          <div className="text-center">
            <div className="text-green-600 mb-4">
              ✅ Magic link sent! Check your email.
            </div>
            <p className="text-sm text-gray-600">
              Didn't receive it? <button onClick={() => setEmailSent(false)} className="text-blue-600 hover:underline">Try again</button>
            </p>
          </div>
        ) : (
          <LoginForm 
            onSuccess={() => setEmailSent(true)}
            onError={(error) => console.error('Login error:', error)}
            showOrganization={true}
            className="space-y-4"
          />
        )}
      </div>
    </div>
  );
}
```

### 2. Magic Link Verification Handler
```typescript
// app/auth/verify/page.tsx (automatically generated)
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { verifyMagicLink } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setError('Invalid verification link');
      return;
    }

    // Verify the magic link token
    verifyMagicLink(token)
      .then(() => {
        setStatus('success');
        // Redirect to dashboard after 2 seconds
        setTimeout(() => router.push('/dashboard'), 2000);
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || 'Verification failed');
      });
  }, [searchParams, verifyMagicLink, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow text-center">
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600">Verifying your login...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="text-green-600 text-6xl">✅</div>
            <h2 className="text-2xl font-bold text-gray-900">Login Successful!</h2>
            <p className="text-gray-600">Redirecting to your dashboard...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="text-red-600 text-6xl">❌</div>
            <h2 className="text-2xl font-bold text-gray-900">Verification Failed</h2>
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => router.push('/auth/login')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

### 2. Protected Routes
```typescript
// pages/dashboard.tsx
import { withAuth } from '@truxe/nextjs';

function Dashboard({ user }) {
  return (
    <div>
      <h1>Welcome, {user.email}!</h1>
      <p>Organization: {user.org?.name}</p>
    </div>
  );
}

export default withAuth(Dashboard);
```

### 3. API Protection
```typescript
// pages/api/protected.ts
import { verifyToken } from '@truxe/nextjs';

export default async function handler(req, res) {
  const user = await verifyToken(req);
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  res.json({ message: `Hello ${user.email}!` });
}
```

---

## 🏢 Multi-Tenant Setup (Optional)

Enable multi-tenancy for B2B SaaS applications:

### 1. Enable Multi-Tenancy
```bash
# Update configuration
truxe config set multi-tenant=true
```

### 2. Organization Management
```typescript
// Create organization
import { useOrganizations } from '@truxe/react';

function CreateOrgForm() {
  const { createOrganization } = useOrganizations();
  
  const handleSubmit = async (data) => {
    await createOrganization({
      name: data.name,
      slug: data.slug
    });
  };
  
  return <OrganizationForm onSubmit={handleSubmit} />;
}
```

### 3. Role-Based Access Control
```typescript
// Protect routes by role
import { withRole } from '@truxe/nextjs';

function AdminPanel() {
  return <div>Admin only content</div>;
}

export default withRole(AdminPanel, 'admin');
```

---

## 🎨 UI Customization with @truxe/ui

### Installing the UI Library

```bash
npm install @truxe/ui
# or
yarn add @truxe/ui
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
            baseUrl: process.env.NEXT_PUBLIC_TRUXE_URL || 'http://localhost:3001',
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

### Using Pre-built Components

```tsx
import { LoginForm, UserMenu, ProtectedRoute } from '@truxe/ui';

// Login page with full functionality
function LoginPage() {
  return (
    <div className="max-w-md mx-auto mt-8">
      <LoginForm
        showOrganization={true}
        onSuccess={(result) => {
          console.log('Login successful:', result);
          // Automatic redirect handled by framework adapters
        }}
        onError={(error) => {
          console.error('Login failed:', error);
        }}
      />
    </div>
  );
}

// Protected dashboard with user menu
function Dashboard() {
  return (
    <ProtectedRoute requiredRole="member">
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold">Dashboard</h1>
              </div>
              <div className="flex items-center">
                <UserMenu showOrganization={true} />
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96">
              <p className="text-center text-gray-500 mt-8">Your dashboard content here</p>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
```

### Custom Theme Configuration

```tsx
import { ThemeProvider } from '@truxe/ui';

const customTheme = {
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
  },
  borderRadius: '8px',
  fontFamily: 'Inter, sans-serif',
};

<ThemeProvider config={customTheme}>
  <App />
</ThemeProvider>
```

### Headless Components for Full Control

```tsx
import { useAuth, useForm, useToast } from '@truxe/ui';

function CustomLoginForm() {
  const { login, isLoading } = useAuth();
  const { success, error } = useToast();
  
  const {
    values,
    errors,
    handleSubmit,
    getFieldProps,
  } = useForm(
    { email: '', orgSlug: '' },
    [
      {
        name: 'email',
        label: 'Email',
        type: 'email',
        required: true,
        validation: { required: true },
      },
    ]
  );

  const handleLoginSubmit = async (data: { email: string; orgSlug: string }) => {
    try {
      const result = await login(data.email, data.orgSlug || undefined);
      if (result.success) {
        success('Magic link sent! Check your email.');
      } else {
        error('Login failed', result.message);
      }
    } catch (err) {
      error('Login failed', err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <form onSubmit={handleSubmit(handleLoginSubmit)} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email address
        </label>
        <input
          {...getFieldProps('email')}
          type="email"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Enter your email"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>
      
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {isLoading ? 'Sending...' : 'Send Magic Link'}
      </button>
    </form>
  );
}
```

### Framework-Specific Integration

#### Next.js

```tsx
import { withAuth, useNextjsAuth } from '@truxe/ui/adapters/nextjs';

// Protect pages with HOC
export default withAuth(Dashboard, {
  requiredRole: 'admin',
  redirectTo: '/login',
});

// Or use the hook
function MyComponent() {
  const { loginAndRedirect, logoutAndRedirect } = useNextjsAuth();
  
  const handleLogin = async (email: string) => {
    await loginAndRedirect(email, undefined, '/dashboard');
  };
}
```

#### Remix

```tsx
import { requireAuth } from '@truxe/ui/adapters/remix';

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireAuth(request, {
    apiUrl: process.env.TRUXE_API_URL!,
    requiredRole: 'member',
  });
  
  return json({ user });
}
```

#### Vite/React Router

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

### Accessibility Features

The UI library includes comprehensive accessibility features:

- **WCAG 2.1 AA compliance** - All components meet accessibility standards
- **Keyboard navigation** - Full keyboard support for all interactive elements
- **Screen reader support** - Proper ARIA labels and announcements
- **High contrast mode** - Automatic support for high contrast preferences
- **Reduced motion** - Respects user's motion preferences

```tsx
import { useAccessibility } from '@truxe/ui';

function MyComponent() {
  const { preferences, announce } = useAccessibility();
  
  // Respect user preferences
  if (preferences.reducedMotion) {
    // Disable animations
  }
  
  // Announce to screen readers
  announce('Form submitted successfully', 'polite');
}
```
```

---

## 🚀 Production Deployment

### 1. Environment Setup
```bash
# Set production environment variables
cp .env.example .env.production

# Configure database
DATABASE_URL=postgresql://user:pass@host:5432/truxe

# Configure email service
EMAIL_PROVIDER=resend
EMAIL_API_KEY=your-api-key
EMAIL_FROM=noreply@yourapp.com

# Configure JWT keys
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
```

### 2. Database Migration
```bash
# Run database migrations
truxe migrate --env=production

# Verify setup
truxe status --env=production
```

### 3. Deploy Options

#### Option A: Docker
```bash
# Build and deploy with Docker
truxe deploy --provider=docker

# Or use provided Dockerfile
docker build -t my-app-auth .
docker run -p 3001:3001 my-app-auth
```

#### Option B: Cloud Platforms
```bash
# Deploy to Railway
truxe deploy --provider=railway

# Deploy to Fly.io
truxe deploy --provider=fly

# Deploy to Vercel (API routes)
truxe deploy --provider=vercel
```

#### Option C: Kubernetes
```bash
# Generate Kubernetes manifests
truxe deploy --provider=k8s --output=./k8s/

# Apply to cluster
kubectl apply -f ./k8s/
```

---

## 🔧 Configuration Reference

### Core Settings
```javascript
// truxe.config.js
export default {
  // Database
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
  },
  
  // Authentication
  auth: {
    magicLink: {
      enabled: true,
      expiryMinutes: 15
    },
    jwt: {
      algorithm: 'RS256',
      accessTokenTTL: '15m',
      refreshTokenTTL: '30d'
    },
    session: {
      maxConcurrent: 5,
      deviceTracking: true
    }
  },
  
  // Multi-tenancy
  multiTenant: {
    enabled: false,
    defaultRole: 'member',
    allowSignup: true
  },
  
  // Email
  email: {
    provider: 'resend', // 'resend' | 'ses' | 'smtp'
    from: 'noreply@yourapp.com'
  },
  
  // Rate limiting
  rateLimit: {
    magicLink: '5/minute',
    apiRequests: '1000/hour'
  }
};
```

### Environment Variables
```bash
# Core
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# JWT
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
JWT_ALGORITHM=RS256

# Email
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_...
EMAIL_FROM=noreply@yourapp.com

# Features
ENABLE_SIGNUP=true
ENABLE_MULTI_TENANT=false
ENABLE_WEBHOOKS=true

# Security
CORS_ORIGIN=https://yourapp.com
TRUSTED_PROXIES=1
```

---

## 🛠️ CLI Commands Reference

### Project Management
```bash
# Initialize new project
truxe init [name] --template=nextjs|nuxt|sveltekit

# Interactive setup
truxe init my-app  # Will prompt for options

# Quick setup with defaults
truxe init my-app --template=nextjs --yes

# Start development server
truxe.io --port=3001 --db=sqlite

# Check project status
truxe status --check-all
```

### Database Management
```bash
# Run migrations
truxe migrate up --env=production

# Create new migration
truxe migrate create add_user_preferences

# Rollback migration
truxe migrate down --steps=1

# Check migration status
truxe migrate status
```

### Configuration Management
```bash
# Set configuration values
truxe config set database.url "postgresql://..."
truxe config set multiTenant.enabled true

# Get configuration values
truxe config get database.url
truxe config get --all

# List all configuration keys
truxe config list

# Validate configuration
truxe config validate

# Reset to defaults
truxe config reset --confirm
```

### Health Monitoring
```bash
# Check all services
truxe status --check-all

# Check specific services
truxe status --check-db
truxe status --check-email
truxe status --check-jwt

# JSON output for scripting
truxe status --format=json
```

---

## 🆘 Troubleshooting

### Common Issues

#### Magic Links Not Working
```bash
# Check email configuration
truxe status --check-email

# View development inbox
open http://localhost:3001/dev/inbox

# Test email delivery
truxe test email --to=test@example.com
```

#### Database Connection Issues
```bash
# Test database connection
truxe status --check-db

# View database logs
truxe logs --service=database

# Reset database
truxe db reset --confirm
```

#### JWT Token Issues
```bash
# Verify JWT configuration
truxe status --check-jwt

# Test token generation
truxe test jwt --user=test@example.com

# View JWKS endpoint
curl http://localhost:3001/.well-known/jwks.json
```

### Getting Help

- **Documentation:** [https://docs.truxe.io](https://docs.truxe.io)
- **GitHub Issues:** [https://github.com/truxe-auth/truxe](https://github.com/truxe-auth/truxe)
- **Discord Community:** [https://discord.gg/truxe](https://discord.gg/truxe)
- **Email Support:** support@truxe.io

---

## 🎯 Next Steps

### Learn More
- [Multi-tenancy Guide](./multi-tenancy.md)
- [Security Best Practices](./security.md)
- [API Reference](./api-reference.md)
- [Migration Guides](./migration/)

### Upgrade to Pro
- Remove "Powered by Truxe" branding
- Custom domains and white-labeling
- Advanced analytics and webhooks
- Priority support

[**Start Free Trial →**](https://truxe.io/pricing)

---

**Questions?** Join our [Discord community](https://discord.gg/truxe) or check out the [full documentation](https://docs.truxe.io).

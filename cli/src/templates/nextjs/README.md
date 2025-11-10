# Truxe Next.js Template

A production-ready Next.js template with complete Truxe authentication integration.

## 🚀 Quick Start

```bash
# Initialize project with Truxe CLI
npx @truxe/cli init my-app --template=nextjs

# Start development
cd my-app
npm run dev          # Next.js app (port 3000)
npm run truxe.io # Truxe API (port 3001)
```

🎉 **That's it!** Your app now has secure authentication at `http://localhost:3000`

## 📋 What's Included

### ✅ Authentication Pages
- **`/auth/login`** - Magic link authentication with organization support
- **`/auth/verify`** - Magic link verification handler with loading states
- **`/auth/callback`** - Authentication callback handler for redirects
- **`/profile`** - User profile management with session controls

### ✅ Protected Routes
- **`/dashboard`** - Example protected dashboard with user info
- **Automatic redirects** - Unauthenticated users redirected to login
- **Role-based access** - Support for organization roles and permissions

### ✅ Authentication Components
- **`AuthProvider`** - React context for authentication state
- **`ProtectedRoute`** - Route protection wrapper component
- **`LoginForm`** - Magic link request form with validation
- **`UserMenu`** - User profile dropdown with logout
- **`LoadingSpinner`** - Loading states throughout the app

### ✅ Security Features
- **CSRF Protection** - Built into middleware and forms
- **Secure Cookies** - HTTP-only cookies for token storage
- **Automatic Token Refresh** - Background token refresh every 14 minutes
- **Session Management** - View and revoke active sessions
- **Security Headers** - CSP, HSTS, and other security headers

### ✅ UI & UX
- **Responsive Design** - Mobile-first responsive layouts
- **Accessibility** - WCAG 2.1 AA compliant components
- **Modern UI** - Clean, professional design with Tailwind CSS
- **Error Handling** - Comprehensive error boundaries and feedback
- **Loading States** - Smooth loading indicators and transitions

### ✅ Developer Experience
- **TypeScript** - Full type safety throughout
- **ESLint + Prettier** - Code formatting and linting
- **Error Boundaries** - Graceful error handling
- **Environment Variables** - Configurable API endpoints
- **Hot Reload** - Fast development with Next.js

## 🏗️ Project Structure

```
my-app/
├── app/                          # Next.js App Router
│   ├── auth/                     # Authentication pages
│   │   ├── login/page.tsx       # Magic link login
│   │   ├── verify/page.tsx      # Magic link verification
│   │   └── callback/page.tsx    # Auth callback handler
│   ├── dashboard/page.tsx        # Protected dashboard
│   ├── profile/page.tsx          # User profile management
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Home page
│   └── globals.css              # Global styles
├── components/                   # React components
│   ├── auth/                    # Authentication components
│   │   ├── AuthProvider.tsx     # Auth context provider
│   │   ├── ProtectedRoute.tsx   # Route protection
│   │   ├── LoginForm.tsx        # Login form
│   │   └── UserMenu.tsx         # User menu dropdown
│   └── ui/                      # UI components
│       ├── Button.tsx           # Button component
│       ├── LoadingSpinner.tsx   # Loading spinner
│       └── ErrorBoundary.tsx    # Error boundary
├── lib/                         # Utility functions
│   └── utils.ts                 # Common utilities
├── types/                       # TypeScript definitions
│   └── index.ts                 # Type definitions
├── middleware.ts                # Next.js middleware
├── next.config.js               # Next.js configuration
├── tailwind.config.js           # Tailwind CSS config
└── package.json                 # Dependencies and scripts
```

## 🔐 Authentication Flow

### 1. Login Request
```typescript
const { login } = useAuth();

const result = await login('user@example.com', 'org-slug');
if (result.success) {
  // Magic link sent to email
  console.log(result.message);
}
```

### 2. Magic Link Verification
When user clicks the magic link:
1. Redirected to `/auth/verify?token=xxx`
2. Token automatically verified with Truxe API
3. HTTP-only cookies set for secure session
4. User redirected to dashboard or intended page

### 3. Automatic Token Refresh
- Access tokens refresh every 14 minutes automatically
- Refresh happens in background without user interaction
- Failed refresh redirects to login page

### 4. Protected Routes
```typescript
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AdminPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  );
}
```

## 🎨 Customization

### Styling
The template uses Tailwind CSS with a custom design system:

```typescript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: { /* Blue color palette */ },
        success: { /* Green color palette */ },
        warning: { /* Yellow color palette */ },
        error: { /* Red color palette */ },
      }
    }
  }
}
```

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_TRUXE_URL=http://localhost:3001  # Truxe API URL
TRUXE_URL=http://localhost:3001              # Server-side API URL
```

### Authentication Provider
```typescript
// app/layout.tsx
<AuthProvider
  apiUrl={process.env.NEXT_PUBLIC_TRUXE_URL}
  redirectTo="/dashboard"
  loginPath="/auth/login"
>
  {children}
</AuthProvider>
```

## 🛡️ Security

### Built-in Security Features
- **CSRF Protection** - Validates CSRF tokens on state-changing requests
- **Secure Cookies** - HTTP-only, secure, SameSite cookies
- **Security Headers** - CSP, X-Frame-Options, HSTS, etc.
- **Input Validation** - Email validation and sanitization
- **Error Handling** - Secure error messages without data leakage

### Session Management
- **Automatic Refresh** - Tokens refresh before expiration
- **Session Limits** - Configurable concurrent session limits
- **Device Tracking** - Track and manage user sessions
- **Logout All** - Revoke all sessions across devices

## 📱 Responsive Design

The template is fully responsive with:
- **Mobile-first** - Designed for mobile, enhanced for desktop
- **Breakpoints** - sm, md, lg, xl breakpoints
- **Touch-friendly** - Appropriate touch targets and interactions
- **Accessibility** - Screen reader support and keyboard navigation

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🚀 Deployment

### Environment Setup
```bash
# Production environment variables
NEXT_PUBLIC_TRUXE_URL=https://api.yourapp.com
TRUXE_URL=https://api.yourapp.com
NODE_ENV=production
```

### Build and Deploy
```bash
# Build for production
npm run build

# Start production server
npm start

# Or deploy to Vercel, Netlify, etc.
```

## 🆘 Troubleshooting

### Common Issues

#### Authentication Not Working
1. Check `NEXT_PUBLIC_TRUXE_URL` is set correctly
2. Ensure Truxe API is running on the specified URL
3. Check browser console for CORS errors

#### Styling Issues
1. Ensure Tailwind CSS is properly configured
2. Check if custom styles are being purged
3. Verify component imports are correct

#### TypeScript Errors
1. Run `npm run type-check` to see all errors
2. Check that all imports have proper type definitions
3. Ensure `@types/*` packages are installed

### Support
- **Documentation**: [https://truxe.io/docs](https://truxe.io/docs)
- **GitHub Issues**: [https://github.com/truxe/truxe](https://github.com/truxe/truxe)
- **Discord**: [https://discord.gg/truxe](https://discord.gg/truxe)
- **Email**: support@truxe.io

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ by the Truxe Team**

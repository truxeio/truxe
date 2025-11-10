# Framework Integration Examples

Complete integration guides with working examples for Next.js, Nuxt, SvelteKit, and other popular frameworks.

## 🎯 Overview

This guide provides comprehensive, production-ready integration examples for major web frameworks. Each example includes:
- ✅ **Complete setup instructions**
- ✅ **Working code examples**
- ✅ **Error handling**
- ✅ **TypeScript support**
- ✅ **Best practices**

---

## ⚛️ Next.js Integration

### Setup & Installation

```bash
# Create Next.js project with Truxe
npx truxe init my-nextjs-app --template=nextjs
cd my-nextjs-app

# Or add to existing project
npm install @truxe/nextjs @truxe/react
```

### Environment Configuration

```bash
# .env.local
NEXT_PUBLIC_TRUXE_URL=http://localhost:3001
TRUXE_API_KEY=your-server-side-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Authentication Provider Setup

```typescript
// app/providers.tsx
'use client';

import { TruxeProvider } from '@truxe/react';
import { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <TruxeProvider
      config={{
        apiUrl: process.env.NEXT_PUBLIC_TRUXE_URL!,
        redirectUrl: process.env.NEXT_PUBLIC_APP_URL + '/dashboard',
        autoRefresh: true,
        debugMode: process.env.NODE_ENV === 'development'
      }}
    >
      {children}
    </TruxeProvider>
  );
}
```

```typescript
// app/layout.tsx
import { Providers } from './providers';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

### Middleware for Route Protection

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@truxe/nextjs';

export async function middleware(request: NextRequest) {
  // Public routes that don't require authentication
  const publicPaths = ['/', '/auth/login', '/auth/verify', '/api/webhook'];
  const isPublicPath = publicPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Verify authentication for protected routes
  try {
    const user = await verifyToken(request);
    
    if (!user) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Add user info to headers for server components
    const response = NextResponse.next();
    response.headers.set('x-user-id', user.id);
    response.headers.set('x-user-email', user.email);
    
    return response;
  } catch (error) {
    console.error('Authentication error:', error);
    const loginUrl = new URL('/auth/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Login Page

```typescript
// app/auth/login/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@truxe/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  
  const { requestMagicLink, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Redirect if already authenticated
  if (user) {
    const redirectTo = searchParams.get('redirect') || '/dashboard';
    router.push(redirectTo);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await requestMagicLink({
        email,
        redirectUrl: process.env.NEXT_PUBLIC_APP_URL + '/dashboard'
      });
      setEmailSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <div className="text-green-600 text-6xl mb-4">📧</div>
            <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
            <p className="text-gray-600 mt-2">
              We've sent a magic link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Didn't receive it? 
              <button 
                onClick={() => setEmailSent(false)}
                className="text-blue-600 hover:underline ml-1"
              >
                Try again
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
          <p className="text-gray-600 mt-2">Sign in to your account</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1"
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || !email}
            className="w-full"
            loading={isLoading}
          >
            {isLoading ? 'Sending magic link...' : 'Send magic link'}
          </Button>
        </form>

        <div className="text-center text-sm text-gray-600">
          <p>
            Don't have an account? 
            <a href="/auth/signup" className="text-blue-600 hover:underline ml-1">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Magic Link Verification

```typescript
// app/auth/verify/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@truxe/react';

export default function VerifyPage() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');
  
  const { verifyMagicLink } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get('token');
    const redirectTo = searchParams.get('redirect') || '/dashboard';
    
    if (!token) {
      setStatus('error');
      setError('Invalid verification link');
      return;
    }

    verifyMagicLink(token)
      .then(() => {
        setStatus('success');
        setTimeout(() => router.push(redirectTo), 2000);
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
            <h2 className="text-2xl font-bold text-gray-900">Verifying...</h2>
            <p className="text-gray-600">Please wait while we sign you in</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="text-green-600 text-6xl">✅</div>
            <h2 className="text-2xl font-bold text-gray-900">Success!</h2>
            <p className="text-gray-600">Redirecting to your dashboard...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="text-red-600 text-6xl">❌</div>
            <h2 className="text-2xl font-bold text-gray-900">Verification Failed</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button 
              onClick={() => router.push('/auth/login')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

### Protected Dashboard

```typescript
// app/dashboard/page.tsx
'use client';

import { useAuth, useUser } from '@truxe/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function DashboardPage() {
  const { user, isLoading } = useUser();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/auth/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                Welcome, {user.email}
              </span>
              <Button onClick={handleLogout} variant="outline">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to your dashboard!
            </h2>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                User Information
              </h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="text-sm text-gray-900">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Verified</dt>
                  <dd className="text-sm text-gray-900">
                    {user.emailVerified ? '✅ Verified' : '❌ Not verified'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Joined</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

### API Route Protection

```typescript
// app/api/protected/route.ts
import { NextRequest } from 'next/server';
import { verifyToken } from '@truxe/nextjs';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    
    if (!user) {
      return Response.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Your protected API logic here
    return Response.json({
      message: `Hello ${user.email}!`,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    return Response.json(
      { error: 'Authentication failed' }, 
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyToken(request);
  
  if (!user) {
    return Response.json(
      { error: 'Unauthorized' }, 
      { status: 401 }
    );
  }

  const body = await request.json();
  
  // Process authenticated request
  return Response.json({
    success: true,
    data: body,
    userId: user.id
  });
}
```

---

## 🟢 Nuxt Integration

### Setup & Installation

```bash
# Create Nuxt project with Truxe
npx truxe init my-nuxt-app --template=nuxt
cd my-nuxt-app

# Or add to existing project
npm install @truxe/nuxt @truxe/vue
```

### Nuxt Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@truxe/nuxt'
  ],
  
  truxe: {
    apiUrl: process.env.TRUXE_API_URL || 'http://localhost:3001',
    redirectUrl: process.env.NUXT_PUBLIC_SITE_URL + '/dashboard',
    autoRefresh: true
  },
  
  runtimeConfig: {
    truxeApiKey: process.env.TRUXE_API_KEY,
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      truxeUrl: process.env.TRUXE_API_URL || 'http://localhost:3001'
    }
  }
});
```

### Authentication Plugin

```typescript
// plugins/truxe.client.ts
import { TruxePlugin } from '@truxe/vue';

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  
  nuxtApp.vueApp.use(TruxePlugin, {
    apiUrl: config.public.truxeUrl,
    redirectUrl: config.public.siteUrl + '/dashboard',
    autoRefresh: true
  });
});
```

### Server-side Authentication Middleware

```typescript
// server/api/auth/[...].ts
import { verifyToken } from '@truxe/nuxt/server';

export default defineEventHandler(async (event) => {
  // Only handle auth-required endpoints
  if (!event.node.req.url?.startsWith('/api/protected/')) {
    return;
  }

  try {
    const user = await verifyToken(event);
    
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    // Add user to context
    event.context.user = user;
  } catch (error) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication failed'
    });
  }
});
```

### Login Page

```vue
<!-- pages/auth/login.vue -->
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
      <div class="text-center">
        <h2 class="text-3xl font-bold text-gray-900">Welcome back</h2>
        <p class="text-gray-600 mt-2">Sign in to your account</p>
      </div>
      
      <div v-if="emailSent" class="text-center">
        <div class="text-green-600 text-6xl mb-4">📧</div>
        <h3 class="text-xl font-semibold text-gray-900">Check your email</h3>
        <p class="text-gray-600 mt-2">
          We've sent a magic link to <strong>{{ email }}</strong>
        </p>
        <button 
          @click="emailSent = false"
          class="text-blue-600 hover:underline text-sm mt-4"
        >
          Try again
        </button>
      </div>
      
      <form v-else @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            :disabled="loading"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your email"
          >
        </div>

        <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-4">
          <p class="text-red-600 text-sm">{{ error }}</p>
        </div>

        <button
          type="submit"
          :disabled="loading || !email"
          class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {{ loading ? 'Sending...' : 'Send magic link' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { useAuth } from '@truxe/vue';

definePageMeta({
  auth: false
});

const { requestMagicLink, user } = useAuth();
const router = useRouter();

const email = ref('');
const loading = ref(false);
const emailSent = ref(false);
const error = ref('');

// Redirect if already authenticated
if (user.value) {
  await navigateTo('/dashboard');
}

const handleLogin = async () => {
  loading.value = true;
  error.value = '';

  try {
    await requestMagicLink({
      email: email.value,
      redirectUrl: useRuntimeConfig().public.siteUrl + '/dashboard'
    });
    emailSent.value = true;
  } catch (err) {
    error.value = err.message || 'Failed to send magic link';
  } finally {
    loading.value = false;
  }
};
</script>
```

### Protected Dashboard

```vue
<!-- pages/dashboard/index.vue -->
<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-semibold">Dashboard</h1>
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-gray-700">Welcome, {{ user?.email }}</span>
            <button 
              @click="handleLogout"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-2xl font-bold text-gray-900 mb-4">
            Welcome to your dashboard!
          </h2>
          
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 class="text-sm font-medium text-gray-500">Email</h3>
              <p class="text-lg text-gray-900">{{ user?.email }}</p>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Status</h3>
              <p class="text-lg text-gray-900">
                {{ user?.emailVerified ? '✅ Verified' : '❌ Not verified' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { useAuth } from '@truxe/vue';

definePageMeta({
  middleware: 'auth'
});

const { user, logout } = useAuth();

const handleLogout = async () => {
  await logout();
  await navigateTo('/');
};
</script>
```

---

## 🧡 SvelteKit Integration

### Setup & Installation

```bash
# Create SvelteKit project with Truxe
npx truxe init my-sveltekit-app --template=sveltekit
cd my-sveltekit-app

# Or add to existing project
npm install @truxe/sveltekit @truxe/svelte
```

### App Configuration

```typescript
// src/app.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
      } | null;
    }
  }
}

export {};
```

### Authentication Hook

```typescript
// src/hooks.server.ts
import { verifyToken } from '@truxe/sveltekit/server';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Try to authenticate the user
  try {
    const user = await verifyToken(event.request);
    event.locals.user = user;
  } catch {
    event.locals.user = null;
  }

  // Check if route requires authentication
  const protectedRoutes = ['/dashboard', '/profile'];
  const isProtectedRoute = protectedRoutes.some(route => 
    event.url.pathname.startsWith(route)
  );

  if (isProtectedRoute && !event.locals.user) {
    return new Response(null, {
      status: 302,
      headers: {
        location: `/auth/login?redirect=${encodeURIComponent(event.url.pathname)}`
      }
    });
  }

  return resolve(event);
};
```

### Login Page

```svelte
<!-- src/routes/auth/login/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { requestMagicLink } from '@truxe/svelte';

  let email = '';
  let loading = false;
  let emailSent = false;
  let error = '';

  const handleSubmit = async () => {
    loading = true;
    error = '';

    try {
      await requestMagicLink({
        email,
        redirectUrl: window.location.origin + '/dashboard'
      });
      emailSent = true;
    } catch (err: any) {
      error = err.message || 'Failed to send magic link';
    } finally {
      loading = false;
    }
  };
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
  <div class="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
    <div class="text-center">
      <h2 class="text-3xl font-bold text-gray-900">Welcome back</h2>
      <p class="text-gray-600 mt-2">Sign in to your account</p>
    </div>
    
    {#if emailSent}
      <div class="text-center">
        <div class="text-green-600 text-6xl mb-4">📧</div>
        <h3 class="text-xl font-semibold text-gray-900">Check your email</h3>
        <p class="text-gray-600 mt-2">
          We've sent a magic link to <strong>{email}</strong>
        </p>
        <button 
          on:click={() => emailSent = false}
          class="text-blue-600 hover:underline text-sm mt-4"
        >
          Try again
        </button>
      </div>
    {:else}
      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            id="email"
            bind:value={email}
            type="email"
            required
            disabled={loading}
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your email"
          />
        </div>

        {#if error}
          <div class="bg-red-50 border border-red-200 rounded-md p-4">
            <p class="text-red-600 text-sm">{error}</p>
          </div>
        {/if}

        <button
          type="submit"
          disabled={loading || !email}
          class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send magic link'}
        </button>
      </form>
    {/if}
  </div>
</div>
```

### Dashboard with Server-side Data

```typescript
// src/routes/dashboard/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // User is guaranteed to exist due to hooks.server.ts
  return {
    user: locals.user
  };
};
```

```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  import { logout } from '@truxe/svelte';
  import { goto } from '$app/navigation';

  export let data: PageData;

  const handleLogout = async () => {
    await logout();
    goto('/');
  };
</script>

<div class="min-h-screen bg-gray-50">
  <nav class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <h1 class="text-xl font-semibold">Dashboard</h1>
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-gray-700">Welcome, {data.user?.email}</span>
          <button 
            on:click={handleLogout}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </nav>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <div class="px-4 py-6 sm:px-0">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">
          Welcome to your dashboard!
        </h2>
        
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <h3 class="text-sm font-medium text-gray-500">Email</h3>
            <p class="text-lg text-gray-900">{data.user?.email}</p>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-500">Status</h3>
            <p class="text-lg text-gray-900">
              {data.user?.emailVerified ? '✅ Verified' : '❌ Not verified'}
            </p>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

---

## 🟦 Express.js Integration

### Setup & Installation

```bash
npm install @truxe/express express
npm install -D @types/express
```

### Basic Express Setup

```typescript
// src/app.ts
import express from 'express';
import { authMiddleware, verifyToken } from '@truxe/express';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Truxe authentication middleware
app.use('/api', authMiddleware({
  apiUrl: process.env.TRUXE_API_URL || 'http://localhost:3001',
  publicPaths: ['/api/health', '/api/webhook'],
  onError: (error, req, res) => {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}));

// Public routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes
app.get('/api/profile', async (req, res) => {
  try {
    const user = await verifyToken(req);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/data', async (req, res) => {
  const user = await verifyToken(req);
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Process authenticated request
  res.json({
    success: true,
    data: req.body,
    userId: user.id
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 🔧 Advanced Integration Patterns

### Multi-tenant Applications

```typescript
// Organization switching in Next.js
'use client';

import { useOrganization, useAuth } from '@truxe/react';

export function OrganizationSwitcher() {
  const { currentOrg, organizations, switchOrganization } = useOrganization();
  const { user } = useAuth();

  if (!user || organizations.length <= 1) return null;

  return (
    <select
      value={currentOrg?.id || ''}
      onChange={(e) => switchOrganization(e.target.value)}
      className="border border-gray-300 rounded px-3 py-2"
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
```

### Role-based Route Protection

```typescript
// Higher-order component for role protection
import { useAuth } from '@truxe/react';
import { useRouter } from 'next/navigation';

interface WithRoleProps {
  requiredRole: string;
  fallbackPath?: string;
}

export function withRole<P extends object>(
  Component: React.ComponentType<P>,
  { requiredRole, fallbackPath = '/unauthorized' }: WithRoleProps
) {
  return function ProtectedComponent(props: P) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!user || user.role !== requiredRole) {
      router.push(fallbackPath);
      return null;
    }

    return <Component {...props} />;
  };
}

// Usage
const AdminPanel = withRole(AdminPanelComponent, { 
  requiredRole: 'admin' 
});
```

### Error Boundaries

```typescript
// Error boundary for authentication errors
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Auth error:', error, errorInfo);
    
    // Log to monitoring service
    if (error.message.includes('Authentication')) {
      // Handle auth-specific errors
      window.location.href = '/auth/login';
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Authentication Error
            </h2>
            <p className="text-gray-600 mb-4">
              Something went wrong with authentication.
            </p>
            <button
              onClick={() => window.location.href = '/auth/login'}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Login Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 🧪 Testing Integration

### Jest Testing Setup

```typescript
// jest.setup.ts
import { setupTruxeTesting } from '@truxe/testing';

setupTruxeTesting({
  apiUrl: 'http://localhost:3001',
  testUser: {
    email: 'test@example.com',
    id: 'test-user-id'
  }
});
```

### Component Testing

```typescript
// __tests__/LoginForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TruxeProvider } from '@truxe/react';
import LoginForm from '../components/LoginForm';

const mockRequestMagicLink = jest.fn();

jest.mock('@truxe/react', () => ({
  ...jest.requireActual('@truxe/react'),
  useAuth: () => ({
    requestMagicLink: mockRequestMagicLink,
    user: null,
    isLoading: false
  })
}));

describe('LoginForm', () => {
  beforeEach(() => {
    mockRequestMagicLink.mockReset();
  });

  it('should send magic link on form submission', async () => {
    mockRequestMagicLink.mockResolvedValueOnce({ success: true });

    render(
      <TruxeProvider config={{ apiUrl: 'http://localhost:3001' }}>
        <LoginForm />
      </TruxeProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send magic link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRequestMagicLink).toHaveBeenCalledWith({
        email: 'test@example.com',
        redirectUrl: expect.any(String)
      });
    });
  });
});
```

---

## 📚 Additional Resources

### Framework-Specific Guides
- **[Next.js App Router Guide](./nextjs-app-router.md)** - Advanced Next.js patterns
- **[Nuxt 3 Composables](./nuxt-composables.md)** - Custom composables and utilities
- **[SvelteKit Actions](./sveltekit-actions.md)** - Form actions and server-side logic

### Example Applications
- **[Next.js E-commerce](https://github.com/truxe-auth/examples/tree/main/nextjs-ecommerce)** - Full e-commerce with multi-tenant support
- **[Nuxt Blog Platform](https://github.com/truxe-auth/examples/tree/main/nuxt-blog)** - Content management with role-based access
- **[SvelteKit Dashboard](https://github.com/truxe-auth/examples/tree/main/sveltekit-dashboard)** - Admin dashboard with real-time features

### Community Examples
- **[Discord Community](https://discord.gg/truxe)** - Share and discuss integration patterns
- **[GitHub Discussions](https://github.com/truxe-auth/truxe/discussions)** - Technical discussions and Q&A

---

**Need help with your integration?** Join our [Discord community](https://discord.gg/truxe) or check the [troubleshooting guide](./troubleshooting.md) for common integration issues.

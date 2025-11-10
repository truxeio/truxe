import React from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute, type ProtectedRouteProps } from '../components/auth/ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
import type { User, Membership } from '../types';

/**
 * Next.js specific protected route component
 */
export function NextjsProtectedRoute(props: Omit<ProtectedRouteProps, 'onRedirect'>) {
  const router = useRouter();
  
  return (
    <ProtectedRoute
      {...props}
      onRedirect={(path: string) => router.push(path)}
    />
  );
}

/**
 * Higher-order component for protecting Next.js pages
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  protectionProps?: Omit<ProtectedRouteProps, 'children' | 'onRedirect'>
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <NextjsProtectedRoute {...protectionProps}>
        <Component {...props} />
      </NextjsProtectedRoute>
    );
  };
}

/**
 * Higher-order component for role-based protection
 */
export function withRole<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole: Membership['role'],
  additionalProps?: Omit<ProtectedRouteProps, 'children' | 'requiredRole' | 'onRedirect'>
) {
  return function RoleProtectedComponent(props: P) {
    return (
      <NextjsProtectedRoute
        requiredRole={requiredRole}
        {...additionalProps}
      >
        <Component {...props} />
      </NextjsProtectedRoute>
    );
  };
}

/**
 * Higher-order component for permission-based protection
 */
export function withPermissions<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions: string[],
  additionalProps?: Omit<ProtectedRouteProps, 'children' | 'requiredPermissions' | 'onRedirect'>
) {
  return function PermissionProtectedComponent(props: P) {
    return (
      <NextjsProtectedRoute
        requiredPermissions={requiredPermissions}
        {...additionalProps}
      >
        <Component {...props} />
      </NextjsProtectedRoute>
    );
  };
}

/**
 * Next.js middleware helper for server-side protection
 */
export interface NextjsMiddlewareConfig {
  apiUrl: string;
  publicPaths?: string[];
  protectedPaths?: string[];
  loginPath?: string;
  afterLoginPath?: string;
}

export function createNextjsMiddleware(config: NextjsMiddlewareConfig) {
  return async (request: any) => {
    const { pathname } = request.nextUrl;
    const { publicPaths = ['/auth'], protectedPaths = ['/dashboard'], loginPath = '/auth/login' } = config;
    
    // Check if path is public
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
    if (isPublicPath) {
      return;
    }
    
    // Check if path needs protection
    const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
    if (!isProtectedPath) {
      return;
    }
    
    // Get auth token from cookies
    const token = request.cookies.get('truxe_access_token')?.value;
    
    if (!token) {
      // Redirect to login
      const loginUrl = new URL(loginPath, request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return Response.redirect(loginUrl);
    }
    
    try {
      // Verify token with API
      const response = await fetch(`${config.apiUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': request.headers.get('cookie') || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Token verification failed');
      }
      
      // Token is valid, continue
      return;
    } catch (error) {
      // Token is invalid, redirect to login
      const loginUrl = new URL(loginPath, request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return Response.redirect(loginUrl);
    }
  };
}

/**
 * Server-side token verification for API routes
 */
export async function verifyToken(
  request: any,
  apiUrl: string
): Promise<{ user: User | null; error?: string }> {
  try {
    // Get token from Authorization header or cookies
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || 
                 request.cookies.get('truxe_access_token')?.value;
    
    if (!token) {
      return { user: null, error: 'No token provided' };
    }
    
    // Verify token with API
    const response = await fetch(`${apiUrl}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': request.headers.get('cookie') || '',
      },
    });
    
    if (!response.ok) {
      return { user: null, error: 'Token verification failed' };
    }
    
    const data = await response.json();
    return { user: data.user };
  } catch (error) {
    return { user: null, error: 'Token verification error' };
  }
}

/**
 * Hook for Next.js router integration
 */
export function useNextjsAuth() {
  const auth = useAuth();
  const router = useRouter();
  
  const loginAndRedirect = async (email: string, orgSlug?: string, redirectTo?: string) => {
    const result = await auth.login(email, orgSlug);
    
    if (result.success && redirectTo) {
      router.push(redirectTo);
    }
    
    return result;
  };
  
  const logoutAndRedirect = async (redirectTo?: string) => {
    await auth.logout();
    router.push(redirectTo || '/auth/login');
  };
  
  return {
    ...auth,
    loginAndRedirect,
    logoutAndRedirect,
    router,
  };
}

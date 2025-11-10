import React from 'react';
import { useNavigate, useLocation } from '@remix-run/react';
import { ProtectedRoute, type ProtectedRouteProps } from '../components/auth/ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
import type { User, Membership } from '../types';

/**
 * Remix specific protected route component
 */
export function RemixProtectedRoute(props: Omit<ProtectedRouteProps, 'onRedirect'>) {
  const navigate = useNavigate();
  
  return (
    <ProtectedRoute
      {...props}
      onRedirect={(path: string) => navigate(path)}
    />
  );
}

/**
 * Higher-order component for protecting Remix routes
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  protectionProps?: Omit<ProtectedRouteProps, 'children' | 'onRedirect'>
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <RemixProtectedRoute {...protectionProps}>
        <Component {...props} />
      </RemixProtectedRoute>
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
      <RemixProtectedRoute
        requiredRole={requiredRole}
        {...additionalProps}
      >
        <Component {...props} />
      </RemixProtectedRoute>
    );
  };
}

/**
 * Remix loader helper for server-side authentication
 */
export interface RemixLoaderConfig {
  apiUrl: string;
  loginPath?: string;
  requiredRole?: Membership['role'];
  requiredPermissions?: string[];
}

export async function requireAuth(
  request: Request,
  config: RemixLoaderConfig
): Promise<{ user: User; redirect?: never } | { user?: never; redirect: Response }> {
  const { apiUrl, loginPath = '/auth/login' } = config;
  
  try {
    // Get token from cookies
    const cookieHeader = request.headers.get('Cookie');
    const token = parseCookie(cookieHeader, 'truxe_access_token');
    
    if (!token) {
      const url = new URL(request.url);
      const loginUrl = new URL(loginPath, url.origin);
      loginUrl.searchParams.set('redirect', url.pathname + url.search);
      
      return {
        redirect: new Response(null, {
          status: 302,
          headers: {
            Location: loginUrl.toString(),
          },
        }),
      };
    }
    
    // Verify token with API
    const response = await fetch(`${apiUrl}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': cookieHeader || '',
      },
    });
    
    if (!response.ok) {
      throw new Error('Token verification failed');
    }
    
    const data = await response.json();
    const user = data.user;
    
    // Check role requirements
    if (config.requiredRole && data.membership) {
      const hasRole = checkRole(data.membership.role, config.requiredRole);
      if (!hasRole) {
        throw new Error('Insufficient role');
      }
    }
    
    // Check permission requirements
    if (config.requiredPermissions && data.membership) {
      const hasPermissions = checkPermissions(data.membership.permissions, config.requiredPermissions);
      if (!hasPermissions) {
        throw new Error('Insufficient permissions');
      }
    }
    
    return { user };
  } catch (error) {
    const url = new URL(request.url);
    const loginUrl = new URL(loginPath, url.origin);
    loginUrl.searchParams.set('redirect', url.pathname + url.search);
    
    return {
      redirect: new Response(null, {
        status: 302,
        headers: {
          Location: loginUrl.toString(),
        },
      }),
    };
  }
}

/**
 * Remix action helper for protected actions
 */
export async function requireAuthForAction(
  request: Request,
  config: RemixLoaderConfig
): Promise<{ user: User; error?: never } | { user?: never; error: Response }> {
  const result = await requireAuth(request, config);
  
  if ('redirect' in result) {
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    };
  }
  
  return result;
}

/**
 * Hook for Remix navigation integration
 */
export function useRemixAuth() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const loginAndRedirect = async (email: string, orgSlug?: string, redirectTo?: string) => {
    const result = await auth.login(email, orgSlug);
    
    if (result.success) {
      const redirect = redirectTo || new URLSearchParams(location.search).get('redirect') || '/dashboard';
      navigate(redirect);
    }
    
    return result;
  };
  
  const logoutAndRedirect = async (redirectTo?: string) => {
    await auth.logout();
    navigate(redirectTo || '/auth/login');
  };
  
  return {
    ...auth,
    loginAndRedirect,
    logoutAndRedirect,
    navigate,
    location,
  };
}

/**
 * Utility functions
 */
function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const cookie = cookies.find(c => c.startsWith(`${name}=`));
  
  return cookie ? cookie.substring(name.length + 1) : null;
}

function checkRole(userRole: Membership['role'], requiredRole: Membership['role']): boolean {
  const roleHierarchy: Record<Membership['role'], number> = {
    viewer: 1,
    member: 2,
    admin: 3,
    owner: 4,
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

function checkPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.every(permission => userPermissions.includes(permission));
}

/**
 * Remix cookie helpers
 */
export function createAuthCookies() {
  return {
    setTokenCookies: (accessToken: string, refreshToken: string) => {
      const isProduction = process.env.NODE_ENV === 'production';
      
      return [
        `truxe_access_token=${accessToken}; HttpOnly; Path=/; ${isProduction ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${15 * 60}`,
        `truxe_refresh_token=${refreshToken}; HttpOnly; Path=/; ${isProduction ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
      ];
    },
    clearTokenCookies: () => {
      return [
        'truxe_access_token=; HttpOnly; Path=/; Max-Age=0',
        'truxe_refresh_token=; HttpOnly; Path=/; Max-Age=0',
      ];
    },
  };
}

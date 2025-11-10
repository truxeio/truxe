import React from 'react';
import { ProtectedRoute, type ProtectedRouteProps } from '../components/auth/ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
import type { User, Membership } from '../types';

// Type for router navigation function (compatible with React Router, Wouter, etc.)
type NavigateFunction = (path: string, options?: { replace?: boolean; state?: any }) => void;

/**
 * Vite/React Router specific protected route component
 */
export function ViteProtectedRoute(
  props: Omit<ProtectedRouteProps, 'onRedirect'> & {
    navigate?: NavigateFunction;
  }
) {
  const { navigate, ...restProps } = props;
  
  return (
    <ProtectedRoute
      {...restProps}
      onRedirect={(path: string) => {
        if (navigate) {
          navigate(path);
        } else {
          // Fallback to window.location if no navigate function provided
          window.location.href = path;
        }
      }}
    />
  );
}

/**
 * Higher-order component for protecting Vite/React Router routes
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  protectionProps?: Omit<ProtectedRouteProps, 'children' | 'onRedirect'> & {
    navigate?: NavigateFunction;
  }
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <ViteProtectedRoute {...protectionProps}>
        <Component {...props} />
      </ViteProtectedRoute>
    );
  };
}

/**
 * Higher-order component for role-based protection
 */
export function withRole<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole: Membership['role'],
  additionalProps?: Omit<ProtectedRouteProps, 'children' | 'requiredRole' | 'onRedirect'> & {
    navigate?: NavigateFunction;
  }
) {
  return function RoleProtectedComponent(props: P) {
    return (
      <ViteProtectedRoute
        requiredRole={requiredRole}
        {...additionalProps}
      >
        <Component {...props} />
      </ViteProtectedRoute>
    );
  };
}

/**
 * React Router v6 specific hooks and components
 */
export function createReactRouterAdapter() {
  // These will be imported dynamically when used with React Router
  let useNavigate: () => NavigateFunction;
  let useLocation: () => { pathname: string; search: string; state: any };
  
  try {
    const reactRouter = require('react-router-dom');
    useNavigate = reactRouter.useNavigate;
    useLocation = reactRouter.useLocation;
  } catch (error) {
    // React Router not available, provide fallbacks
    useNavigate = () => (path: string) => {
      window.location.href = path;
    };
    useLocation = () => ({
      pathname: window.location.pathname,
      search: window.location.search,
      state: null,
    });
  }
  
  function ReactRouterProtectedRoute(props: Omit<ProtectedRouteProps, 'onRedirect'>) {
    const navigate = useNavigate();
    
    return (
      <ProtectedRoute
        {...props}
        onRedirect={(path: string) => navigate(path)}
      />
    );
  }
  
  function useReactRouterAuth() {
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
  
  return {
    ProtectedRoute: ReactRouterProtectedRoute,
    useAuth: useReactRouterAuth,
  };
}

/**
 * Wouter specific hooks and components
 */
export function createWouterAdapter() {
  // These will be imported dynamically when used with Wouter
  let useLocation: () => [string, (path: string) => void];
  
  try {
    const wouter = require('wouter');
    useLocation = wouter.useLocation;
  } catch (error) {
    // Wouter not available, provide fallback
    useLocation = () => [
      window.location.pathname,
      (path: string) => {
        window.location.href = path;
      },
    ];
  }
  
  function WouterProtectedRoute(props: Omit<ProtectedRouteProps, 'onRedirect'>) {
    const [, navigate] = useLocation();
    
    return (
      <ProtectedRoute
        {...props}
        onRedirect={(path: string) => navigate(path)}
      />
    );
  }
  
  function useWouterAuth() {
    const auth = useAuth();
    const [location, navigate] = useLocation();
    
    const loginAndRedirect = async (email: string, orgSlug?: string, redirectTo?: string) => {
      const result = await auth.login(email, orgSlug);
      
      if (result.success) {
        const redirect = redirectTo || new URLSearchParams(window.location.search).get('redirect') || '/dashboard';
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
  
  return {
    ProtectedRoute: WouterProtectedRoute,
    useAuth: useWouterAuth,
  };
}

/**
 * Generic client-side route protection
 */
export function createClientSideGuard(config: {
  apiUrl: string;
  loginPath?: string;
  publicPaths?: string[];
  protectedPaths?: string[];
}) {
  const { apiUrl, loginPath = '/auth/login', publicPaths = ['/auth'], protectedPaths = ['/dashboard'] } = config;
  
  return async function checkRouteAccess(pathname: string): Promise<{ allowed: boolean; redirect?: string }> {
    // Check if path is public
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
    if (isPublicPath) {
      return { allowed: true };
    }
    
    // Check if path needs protection
    const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
    if (!isProtectedPath) {
      return { allowed: true };
    }
    
    try {
      // Check authentication status
      const response = await fetch(`${apiUrl}/auth/me`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        return { allowed: true };
      } else {
        return { 
          allowed: false, 
          redirect: `${loginPath}?redirect=${encodeURIComponent(pathname)}` 
        };
      }
    } catch (error) {
      return { 
        allowed: false, 
        redirect: `${loginPath}?redirect=${encodeURIComponent(pathname)}` 
      };
    }
  };
}

/**
 * Vite plugin for auth integration
 */
export function createViteAuthPlugin(config: {
  apiUrl: string;
  loginPath?: string;
  publicPaths?: string[];
  protectedPaths?: string[];
}) {
  const checkAccess = createClientSideGuard(config);
  
  return {
    name: 'truxe-auth',
    configureServer(server: any) {
      server.middlewares.use('/api/auth/check', async (req: any, res: any) => {
        const pathname = req.query.path || req.url;
        const result = await checkAccess(pathname);
        
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      });
    },
  };
}

/**
 * Environment-specific configuration helper
 */
export function createViteConfig() {
  const isDev = process.env.NODE_ENV === 'development';
  const apiUrl = process.env.VITE_TRUXE_API_URL || 'http://localhost:3001';
  
  return {
    apiUrl,
    isDev,
    publicPaths: ['/auth', '/public', '/'],
    protectedPaths: ['/dashboard', '/profile', '/admin'],
    loginPath: '/auth/login',
    afterLoginPath: '/dashboard',
  };
}

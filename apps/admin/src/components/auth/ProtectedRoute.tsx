import React, { ReactNode, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAccessibility } from '../../hooks/useAccessibility';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { cn } from '../../lib/utils';
import { ARIA_LABELS } from '../../lib/constants';
import type { BaseComponentProps, Membership } from '../../types';

export interface ProtectedRouteProps extends BaseComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
  unauthorizedComponent?: ReactNode;
  requiredRole?: Membership['role'];
  requiredPermissions?: string[];
  requireEmailVerification?: boolean;
  requireOrganization?: boolean;
  redirectTo?: string;
  onUnauthorized?: () => void;
  onRedirect?: (path: string) => void;
}

/**
 * Protected route component with role-based access control
 */
export function ProtectedRoute({
  children,
  className,
  fallback,
  loadingComponent,
  unauthorizedComponent,
  requiredRole,
  requiredPermissions = [],
  requireEmailVerification = false,
  requireOrganization = false,
  redirectTo = '/auth/login',
  onUnauthorized,
  onRedirect,
  ...props
}: ProtectedRouteProps) {
  const { 
    user, 
    organization, 
    membership, 
    isLoading, 
    isAuthenticated 
  } = useAuth();
  const { announce } = useAccessibility();

  // Handle redirects
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      onRedirect?.(redirectTo);
      announce('Please sign in to access this page', 'assertive');
    }
  }, [isLoading, isAuthenticated, redirectTo, onRedirect, announce]);

  // Check role hierarchy
  const hasRequiredRole = (userRole: Membership['role'], required: Membership['role']): boolean => {
    const roleHierarchy: Record<Membership['role'], number> = {
      viewer: 1,
      member: 2,
      admin: 3,
      owner: 4,
    };

    return roleHierarchy[userRole] >= roleHierarchy[required];
  };

  // Check permissions
  const hasRequiredPermissions = (userPermissions: string[], required: string[]): boolean => {
    return required.every(permission => userPermissions.includes(permission));
  };

  // Loading state
  if (isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div
        className={cn(
          'flex min-h-screen items-center justify-center bg-secondary-50 dark:bg-secondary-900',
          className
        )}
        {...props}
      >
        <div className="text-center">
          <LoadingSpinner size="lg" label="Loading..." />
          <p className="mt-4 text-sm text-secondary-600 dark:text-secondary-400">
            Verifying your access...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div
        className={cn(
          'flex min-h-screen items-center justify-center bg-secondary-50 dark:bg-secondary-900',
          className
        )}
        role="alert"
        aria-live="assertive"
        {...props}
      >
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-100 dark:bg-error-900/20">
            <svg
              className="h-6 w-6 text-error-600 dark:text-error-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-2">
            Authentication Required
          </h2>
          
          <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
            You need to sign in to access this page.
          </p>
          
          <button
            onClick={() => onRedirect?.(redirectTo)}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Check email verification requirement
  if (requireEmailVerification && !user.emailVerified) {
    if (unauthorizedComponent) {
      return <>{unauthorizedComponent}</>;
    }

    return (
      <div
        className={cn(
          'flex min-h-screen items-center justify-center bg-secondary-50 dark:bg-secondary-900',
          className
        )}
        role="alert"
        aria-live="assertive"
        {...props}
      >
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-100 dark:bg-warning-900/20">
            <svg
              className="h-6 w-6 text-warning-600 dark:text-warning-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-2">
            Email Verification Required
          </h2>
          
          <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
            Please verify your email address to access this page. Check your inbox for a verification email.
          </p>
          
          <div className="space-y-2">
            <button
              onClick={() => {/* Resend verification email */}}
              className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Resend Verification Email
            </button>
            
            <button
              onClick={() => onRedirect?.('/auth/profile')}
              className="block w-full text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400"
            >
              Go to Profile Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check organization requirement
  if (requireOrganization && !organization) {
    if (unauthorizedComponent) {
      return <>{unauthorizedComponent}</>;
    }

    return (
      <div
        className={cn(
          'flex min-h-screen items-center justify-center bg-secondary-50 dark:bg-secondary-900',
          className
        )}
        role="alert"
        aria-live="assertive"
        {...props}
      >
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-100 dark:bg-warning-900/20">
            <svg
              className="h-6 w-6 text-warning-600 dark:text-warning-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-2">
            Organization Required
          </h2>
          
          <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
            You need to be part of an organization to access this page.
          </p>
          
          <div className="space-y-2">
            <button
              onClick={() => {/* Create organization */}}
              className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Create Organization
            </button>
            
            <button
              onClick={() => onRedirect?.('/dashboard')}
              className="block w-full text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check role requirements
  if (requiredRole && membership && !hasRequiredRole(membership.role, requiredRole)) {
    onUnauthorized?.();
    
    if (unauthorizedComponent) {
      return <>{unauthorizedComponent}</>;
    }

    return (
      <div
        className={cn(
          'flex min-h-screen items-center justify-center bg-secondary-50 dark:bg-secondary-900',
          className
        )}
        role="alert"
        aria-live="assertive"
        {...props}
      >
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-100 dark:bg-error-900/20">
            <svg
              className="h-6 w-6 text-error-600 dark:text-error-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"
              />
            </svg>
          </div>
          
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-2">
            Insufficient Permissions
          </h2>
          
          <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
            You need <strong>{requiredRole}</strong> permissions to access this page. 
            Your current role is <strong>{membership.role}</strong>.
          </p>
          
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center rounded-md bg-secondary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check permission requirements
  if (requiredPermissions.length > 0 && membership && !hasRequiredPermissions(membership.permissions, requiredPermissions)) {
    onUnauthorized?.();
    
    if (unauthorizedComponent) {
      return <>{unauthorizedComponent}</>;
    }

    return (
      <div
        className={cn(
          'flex min-h-screen items-center justify-center bg-secondary-50 dark:bg-secondary-900',
          className
        )}
        role="alert"
        aria-live="assertive"
        {...props}
      >
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-100 dark:bg-error-900/20">
            <svg
              className="h-6 w-6 text-error-600 dark:text-error-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-2">
            Missing Permissions
          </h2>
          
          <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
            You don't have the required permissions to access this page. 
            Required: {requiredPermissions.join(', ')}
          </p>
          
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center rounded-md bg-secondary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // All checks passed - render children
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

/**
 * Higher-order component for protecting routes
 */
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  protectionProps?: Omit<ProtectedRouteProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute {...protectionProps}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

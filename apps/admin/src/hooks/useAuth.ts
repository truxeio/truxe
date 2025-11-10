import { useContext } from 'react';
import { AuthContext } from '../providers/AuthProvider';
import type { AuthContextType } from '../types';

/**
 * Hook to access authentication context
 * Throws an error if used outside of AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

/**
 * Hook to get current user
 */
export function useUser() {
  const { user, isLoading } = useAuth();
  return { user, isLoading };
}

/**
 * Hook to get current organization
 */
export function useOrganization() {
  const { organization, membership, switchOrganization, getUserOrganizations } = useAuth();
  
  return {
    organization,
    membership,
    switchOrganization,
    getUserOrganizations,
  };
}

/**
 * Hook for login functionality
 */
export function useLogin() {
  const { login, isLoading } = useAuth();
  
  return {
    login,
    isLoading,
  };
}

/**
 * Hook for logout functionality
 */
export function useLogout() {
  const { logout } = useAuth();
  
  return {
    logout,
  };
}

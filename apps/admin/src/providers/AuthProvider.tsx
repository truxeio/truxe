import React, { createContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { 
  AuthContextType, 
  User, 
  Organization, 
  Membership, 
  AuthResult,
  OrganizationWithMembership,
  CreateOrganizationData,
  InviteUserData,
  ApiConfig 
} from '../types';
import { formatErrorMessage } from '../lib/utils';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  apiConfig: ApiConfig;
  onAuthStateChange?: (user: User | null) => void;
  onError?: (error: Error) => void;
}

/**
 * Authentication provider with comprehensive state management
 */
export function AuthProvider({ 
  children, 
  apiConfig,
  onAuthStateChange,
  onError 
}: AuthProviderProps) {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const isAuthenticated = !!user;

  // API helper function
  const apiCall = useCallback(async (
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<any> => {
    const url = `${apiConfig.baseUrl}${endpoint}`;
    const config: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...apiConfig.headers,
        ...options.headers,
      },
      ...options,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeout || 10000);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        onError?.(error);
      }
      throw error;
    }
  }, [apiConfig, onError]);

  // Authentication methods
  const login = useCallback(async (email: string, orgSlug?: string): Promise<AuthResult> => {
    try {
      const response = await apiCall('/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email, orgSlug }),
      });

      return {
        success: true,
        message: response.message || 'Magic link sent! Check your email.',
      };
    } catch (error) {
      const message = formatErrorMessage(error);
      return {
        success: false,
        message,
      };
    }
  }, [apiCall]);

  const verifyMagicLink = useCallback(async (token: string): Promise<AuthResult> => {
    try {
      const response = await apiCall(`/auth/verify?token=${encodeURIComponent(token)}`);

      if (response.mfaRequired && response.challengeId) {
        return {
          success: true,
          message: 'MFA required',
          mfaRequired: true,
          challengeId: response.challengeId,
        } as unknown as AuthResult;
      }

      setUser(response.user);
      setOrganization(response.organization || null);
      setMembership(response.membership || null);
      onAuthStateChange?.(response.user);

      return {
        success: true,
        message: 'Successfully authenticated',
        user: response.user,
        organization: response.organization,
        membership: response.membership,
        tokens: response.tokens,
      };
    } catch (error) {
      const message = formatErrorMessage(error);
      return {
        success: false,
        message,
      };
    }
  }, [apiCall, onAuthStateChange]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiCall('/auth/revoke', {
        method: 'POST',
        body: JSON.stringify({ revokeAll: false }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setOrganization(null);
      setMembership(null);
      
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      
      onAuthStateChange?.(null);
    }
  }, [apiCall, refreshInterval, onAuthStateChange]);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const response = await apiCall('/auth/me');
      setUser(response.user);
      
      // Update organization and membership if present
      if (response.session?.orgId) {
        // Fetch organization details if needed
        // This would depend on your API structure
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('401')) {
        // Token expired or invalid
        setUser(null);
        setOrganization(null);
        setMembership(null);
        onAuthStateChange?.(null);
      }
    }
  }, [apiCall, onAuthStateChange]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      await apiCall('/auth/refresh', {
        method: 'POST',
      });
      
      await refreshUser();
      return true;
    } catch (error) {
      setUser(null);
      setOrganization(null);
      setMembership(null);
      onAuthStateChange?.(null);
      return false;
    }
  }, [apiCall, refreshUser, onAuthStateChange]);

  const switchOrganization = useCallback(async (orgId: string): Promise<AuthResult> => {
    try {
      const response = await apiCall('/auth/switch-org', {
        method: 'POST',
        body: JSON.stringify({ orgId }),
      });

      setOrganization(response.organization);
      setMembership(response.membership);

      return {
        success: true,
        message: `Switched to ${response.organization.name}`,
        organization: response.organization,
        membership: response.membership,
        tokens: response.tokens,
      };
    } catch (error) {
      const message = formatErrorMessage(error);
      return {
        success: false,
        message,
      };
    }
  }, [apiCall]);

  // Organization management
  const createOrganization = useCallback(async (data: CreateOrganizationData): Promise<Organization> => {
    const response = await apiCall('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.organization;
  }, [apiCall]);

  const inviteUser = useCallback(async (data: InviteUserData): Promise<void> => {
    await apiCall(`/organizations/${data.organizationId}/invite`, {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        role: data.role,
      }),
    });
  }, [apiCall]);

  const getUserOrganizations = useCallback(async (): Promise<OrganizationWithMembership[]> => {
    const response = await apiCall('/auth/organizations');
    return response.organizations;
  }, [apiCall]);

  // Token refresh setup
  const setupTokenRefresh = useCallback(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    // Refresh token every 14 minutes (access tokens expire in 15 minutes)
    const interval = setInterval(async () => {
      if (user) {
        const success = await refreshToken();
        if (!success) {
          console.warn('Token refresh failed, user may need to re-authenticate');
        }
      }
    }, 14 * 60 * 1000); // 14 minutes

    setRefreshInterval(interval);
  }, [user, refreshToken, refreshInterval]);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      try {
        await refreshUser();
      } catch (error) {
        // User is not authenticated, which is fine
        console.debug('No active session found');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  // Setup token refresh when user is authenticated
  useEffect(() => {
    if (user) {
      setupTokenRefresh();
    }
  }, [user, setupTokenRefresh]);

  // Handle visibility change to refresh token when user returns
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        refreshToken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refreshToken]);

  const contextValue: AuthContextType = {
    // State
    user,
    organization,
    membership,
    isLoading,
    isAuthenticated,
    
    // Actions
    login,
    logout,
    verifyMagicLink,
    refreshUser,
    switchOrganization,
    
    // Organization management
    createOrganization,
    inviteUser,
    getUserOrganizations,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

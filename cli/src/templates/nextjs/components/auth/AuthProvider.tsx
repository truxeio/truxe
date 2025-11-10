'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt?: string;
  org?: {
    id: string;
    name: string;
    slug: string;
    role: string;
    permissions?: string[];
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, orgSlug?: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
  apiUrl?: string;
  redirectTo?: string;
  loginPath?: string;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  apiUrl = process.env.NEXT_PUBLIC_HEIMDALL_URL || 'http://localhost:3001',
  redirectTo = '/dashboard',
  loginPath = '/auth/login',
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Token refresh interval
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const isAuthenticated = !!user;

  const login = async (email: string, orgSlug?: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${apiUrl}/auth/magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, orgSlug }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          message: data.message || 'Magic link sent! Check your email.',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to send magic link.',
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Network error. Please try again.',
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch(`${apiUrl}/auth/revoke`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ revokeAll: false }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state
      setUser(null);
      
      // Clear refresh interval
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      
      // Redirect to login
      router.push(loginPath);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await fetch(`${apiUrl}/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      } else if (response.status === 401) {
        // Token expired or invalid
        setUser(null);
        if (refreshInterval) {
          clearInterval(refreshInterval);
          setRefreshInterval(null);
        }
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        await refreshUser(); // Refresh user data after token refresh
        return true;
      } else {
        // Refresh failed, user needs to login again
        setUser(null);
        if (refreshInterval) {
          clearInterval(refreshInterval);
          setRefreshInterval(null);
        }
        return false;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  };

  // Setup automatic token refresh
  const setupTokenRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    // Refresh token every 14 minutes (access tokens expire in 15 minutes)
    const interval = setInterval(async () => {
      if (user) {
        const success = await refreshToken();
        if (!success) {
          // Refresh failed, redirect to login
          router.push(loginPath);
        }
      }
    }, 14 * 60 * 1000); // 14 minutes

    setRefreshInterval(interval);
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      await refreshUser();
      setIsLoading(false);
    };

    initializeAuth();

    // Cleanup interval on unmount
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
  }, [user]);

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
  }, [user]);

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshUser,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

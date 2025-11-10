/**
 * useAuth Hook
 *
 * React hook for OAuth authentication
 * Provides: login, logout, user, loading, isAuthenticated
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getOAuthClient, UserInfo } from '../lib/oauth-client';

interface AuthContextValue {
  user: UserInfo | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const oauthClient = getOAuthClient();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    setLoading(true);
    try {
      if (oauthClient.isAuthenticated()) {
        const userInfo = await oauthClient.getUserInfo();
        setUser(userInfo);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  function login() {
    oauthClient.login();
  }

  async function logout() {
    try {
      await oauthClient.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear user on failure
      setUser(null);
    }
  }

  async function refreshUser() {
    try {
      const userInfo = await oauthClient.getUserInfo();
      setUser(userInfo);
    } catch (error) {
      console.error('User refresh failed:', error);
      setUser(null);
    }
  }

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
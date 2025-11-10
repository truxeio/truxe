import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { oauthClient } from '../lib/oauth-client';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  login: () => void;
  logout: () => void;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// For SPAs, storing tokens in memory is the most secure option.
// localStorage/sessionStorage are vulnerable to XSS.
let inMemoryToken: { accessToken: string; expiresAt: number; refreshToken?: string } | null = null;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This effect runs on initial load to check if we are already logged in.
    // In a real app, you might have a "silent refresh" mechanism here.
    if (inMemoryToken && inMemoryToken.expiresAt > Date.now()) {
        setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = () => {
    setLoading(true);
    const { codeVerifier, codeChallenge } = oauthClient.generatePkce();
    sessionStorage.setItem('oauth_code_verifier', codeVerifier); // Use sessionStorage for the short-lived verifier
    const url = oauthClient.getAuthorizationUrl(
      'random_state_string', // In a real app, generate and verify a random state
      codeChallenge
    );
    window.location.assign(url);
  };

  const logout = () => {
    inMemoryToken = null;
    setIsAuthenticated(false);
    // Optionally, redirect to a central logout endpoint
    // window.location.assign(`${import.meta.env.VITE_HEIMDALL_URL}/logout?client_id=...`);
  };

  const handleTokenExchange = async (code: string, codeVerifier: string) => {
    try {
        const tokens = await oauthClient.getTokens(code, codeVerifier);
        inMemoryToken = {
            accessToken: tokens.access_token,
            expiresAt: Date.now() + tokens.expires_in * 1000,
            refreshToken: tokens.refresh_token,
        };
        setIsAuthenticated(true);
    } catch (error) {
        console.error("Failed to exchange token", error);
        setIsAuthenticated(false);
    } finally {
        setLoading(false);
    }
  };
  
  const getAccessToken = (): string | null => {
    if (!inMemoryToken) return null;

    // Check for expiration and refresh if needed
    if (inMemoryToken.expiresAt < Date.now()) {
        if (inMemoryToken.refreshToken) {
            // Perform refresh
            oauthClient.refreshAccessToken(inMemoryToken.refreshToken).then(tokens => {
                inMemoryToken = {
                    accessToken: tokens.access_token,
                    expiresAt: Date.now() + tokens.expires_in * 1000,
                    refreshToken: tokens.refresh_token || inMemoryToken?.refreshToken,
                };
            }).catch(() => {
                // Refresh failed, log out
                logout();
            });
        } else {
            // No refresh token, log out
            logout();
            return null;
        }
    }
    return inMemoryToken.accessToken;
  }

  // This is a bit of a hack for the callback page to set the token
  // A better solution might involve a different architecture
  // but for this example it's simple enough.
  (window as any).handleTokenExchange = handleTokenExchange;

  const value = {
    isAuthenticated,
    loading,
    login,
    logout,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
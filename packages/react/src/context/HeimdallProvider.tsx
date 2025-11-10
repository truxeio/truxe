import React, { createContext, useCallback, useEffect, useState } from 'react';
import { HeimdallAPIClient } from '../utils/api-client';
import type {
  AuthState,
  HeimdallConfig,
  Organization,
  User,
} from '../types';

// ============================================
// Context Type
// ============================================

interface HeimdallContextValue extends AuthState {
  client: HeimdallAPIClient;
  organizations: Organization[];
  signIn: (email: string, password?: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    metadata?: Record<string, any>
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<User>;
  setActiveOrganization: (orgId: string) => Promise<void>;
  createOrganization: (data: {
    name: string;
    slug?: string;
  }) => Promise<Organization>;
}

export const HeimdallContext = createContext<HeimdallContextValue | null>(null);

// ============================================
// Provider Props
// ============================================

interface HeimdallProviderProps extends HeimdallConfig {
  children: React.ReactNode;
}

// ============================================
// Provider Component
// ============================================

/**
 * HeimdallProvider
 *
 * Root provider for Heimdall authentication.
 */
export function HeimdallProvider({
  publishableKey,
  apiUrl = 'http://localhost:3001',
  onTokenRefresh,
  onAuthChange,
  children,
}: HeimdallProviderProps) {
  const [client] = useState(
    () => new HeimdallAPIClient(apiUrl, publishableKey)
  );

  const [authState, setAuthState] = useState<AuthState>({
    isLoaded: false,
    isSignedIn: false,
    user: null,
    session: null,
    organization: null,
  });

  const [organizations, setOrganizations] = useState<Organization[]>([]);

  // ============================================
  // Load Initial State
  // ============================================

  const loadAuthState = useCallback(async () => {
    try {
      const [user, session, orgs] = await Promise.all([
        client.getUser().catch(() => null),
        client.getSession().catch(() => null),
        client.getOrganizations().catch(() => []),
      ]);

      const newState: AuthState = {
        isLoaded: true,
        isSignedIn: !!user,
        user,
        session,
        organization: orgs[0] || null,
      };

      setAuthState(newState);
      setOrganizations(orgs);

      if (onAuthChange) {
        onAuthChange(newState);
      }
    } catch (error) {
      console.error('Failed to load auth state:', error);
      setAuthState({
        isLoaded: true,
        isSignedIn: false,
        user: null,
        session: null,
        organization: null,
      });
    }
  }, [client, onAuthChange]);

  useEffect(() => {
    loadAuthState();
  }, [loadAuthState]);

  // ============================================
  // Auth Methods
  // ============================================

  const signIn = useCallback(
    async (email: string, password?: string) => {
      if (password) {
        const result = await client.signInWithPassword(email, password);
        if (onTokenRefresh) {
          onTokenRefresh(result.tokens);
        }
        await loadAuthState();
      } else {
        await client.signInWithMagicLink(email);
      }
    },
    [client, loadAuthState, onTokenRefresh]
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata?: Record<string, any>
    ) => {
      const result = await client.signUp(email, password, metadata);

      if (onTokenRefresh) {
        onTokenRefresh(result.tokens);
      }

      await loadAuthState();
    },
    [client, loadAuthState, onTokenRefresh]
  );

  const signOut = useCallback(async () => {
    await client.signOut();
    setAuthState({
      isLoaded: true,
      isSignedIn: false,
      user: null,
      session: null,
      organization: null,
    });
    setOrganizations([]);

    if (onAuthChange) {
      onAuthChange({
        isLoaded: true,
        isSignedIn: false,
        user: null,
        session: null,
        organization: null,
      });
    }
  }, [client, onAuthChange]);

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      const updatedUser = await client.updateUser(updates);
      setAuthState((prev) => ({ ...prev, user: updatedUser }));
      return updatedUser;
    },
    [client]
  );

  const setActiveOrganization = useCallback(
    async (orgId: string) => {
      await client.setActiveOrganization(orgId);
      const org = organizations.find((o) => o.id === orgId);
      if (org) {
        setAuthState((prev) => ({ ...prev, organization: org }));
      }
    },
    [client, organizations]
  );

  const createOrganization = useCallback(
    async (data: { name: string; slug?: string }) => {
      const org = await client.createOrganization(data);
      setOrganizations((prev) => [...prev, org]);
      return org;
    },
    [client]
  );

  const value: HeimdallContextValue = {
    ...authState,
    client,
    organizations,
    signIn,
    signUp,
    signOut,
    updateUser,
    setActiveOrganization,
    createOrganization,
  };

  return (
    <HeimdallContext.Provider value={value}>
      {children}
    </HeimdallContext.Provider>
  );
}

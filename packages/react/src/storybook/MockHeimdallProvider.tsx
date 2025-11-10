import React, { useMemo } from 'react';
import { TruxeContext } from '../context/TruxeProvider';
import type { Organization, User } from '../types';

interface MockTruxeProviderProps {
  children: React.ReactNode;
  isSignedIn?: boolean;
}

/**
 * Minimal mocked TruxeProvider for Storybook stories.
 * Provides a stable auth context without requiring API access.
 */
export function MockTruxeProvider({
  children,
  isSignedIn = false,
}: MockTruxeProviderProps) {
  const mockUser: User = {
    id: 'user_1',
    email: 'demo@truxe.io',
    emailVerified: true,
    firstName: 'Demo',
    lastName: 'User',
    fullName: 'Demo User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockOrganization: Organization = {
    id: 'org_1',
    name: 'Demo Organization',
    slug: 'demo-org',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const value = useMemo(() => ({
    isLoaded: true,
    isSignedIn,
    user: isSignedIn ? mockUser : null,
    session: null,
    organization: isSignedIn ? mockOrganization : null,
    organizations: isSignedIn ? [mockOrganization] : [],
    client: {} as any,
    signIn: async () => {},
    signUp: async () => {},
    signOut: async () => {},
    updateUser: async (updates: Partial<User>) => ({
      ...mockUser,
      ...updates,
    }),
    setActiveOrganization: async () => {},
    createOrganization: async () => mockOrganization,
  }), [isSignedIn, mockOrganization, mockUser]);

  return (
    <TruxeContext.Provider value={value}>
      {children}
    </TruxeContext.Provider>
  );
}

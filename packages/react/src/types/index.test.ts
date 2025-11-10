import { describe, it, expect } from 'vitest';
import type {
  User,
  Session,
  Organization,
  AuthState,
  TokenPair,
  TruxeConfig,
} from './index';

describe('Type Definitions', () => {
  it('should have correct User interface structure', () => {
    const user: User = {
      id: 'user-123',
      email: 'test@example.com',
      emailVerified: true,
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      imageUrl: 'https://example.com/avatar.jpg',
      metadata: { role: 'admin' },
      createdAt: '2025-11-07T00:00:00Z',
      updatedAt: '2025-11-07T00:00:00Z',
    };

    expect(user).toBeDefined();
    expect(user.id).toBe('user-123');
    expect(user.email).toBe('test@example.com');
  });

  it('should have correct Session interface structure', () => {
    const session: Session = {
      id: 'session-123',
      userId: 'user-123',
      status: 'active',
      expiresAt: '2025-11-08T00:00:00Z',
      lastActiveAt: '2025-11-07T00:00:00Z',
      createdAt: '2025-11-07T00:00:00Z',
    };

    expect(session).toBeDefined();
    expect(session.status).toBe('active');
  });

  it('should have correct Organization interface structure', () => {
    const org: Organization = {
      id: 'org-123',
      name: 'Test Org',
      slug: 'test-org',
      imageUrl: 'https://example.com/logo.png',
      metadata: { plan: 'pro' },
      createdAt: '2025-11-07T00:00:00Z',
      updatedAt: '2025-11-07T00:00:00Z',
    };

    expect(org).toBeDefined();
    expect(org.slug).toBe('test-org');
  });

  it('should have correct AuthState interface structure', () => {
    const authState: AuthState = {
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        createdAt: '2025-11-07T00:00:00Z',
        updatedAt: '2025-11-07T00:00:00Z',
      },
      session: null,
      organization: null,
    };

    expect(authState).toBeDefined();
    expect(authState.isSignedIn).toBe(true);
  });

  it('should have correct TokenPair interface structure', () => {
    const tokens: TokenPair = {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
      expiresIn: 3600,
    };

    expect(tokens).toBeDefined();
    expect(tokens.expiresIn).toBe(3600);
  });

  it('should have correct TruxeConfig interface structure', () => {
    const config: TruxeConfig = {
      publishableKey: 'pk_test_123',
      apiUrl: 'http://localhost:3001',
      onTokenRefresh: (tokens) => {
        console.log('Token refreshed:', tokens);
      },
      onAuthChange: (state) => {
        console.log('Auth state changed:', state);
      },
    };

    expect(config).toBeDefined();
    expect(config.publishableKey).toBe('pk_test_123');
  });
});
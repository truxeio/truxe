/**
 * Core Type Definitions for @heimdall/react
 */

// ============================================
// User Types
// ============================================

/**
 * Represents a Heimdall user record.
 */
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Session Types
// ============================================

/**
 * Session associated with the current authentication state.
 */
export interface Session {
  id: string;
  userId: string;
  status: 'active' | 'expired' | 'revoked';
  expiresAt: string;
  lastActiveAt: string;
  createdAt: string;
}

// ============================================
// Organization Types
// ============================================

/**
 * Organization that a user can belong to.
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a user's membership in an organization.
 */
export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

// ============================================
// Auth State
// ============================================

/**
 * High-level authentication state exposed by the provider.
 */
export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: User | null;
  session: Session | null;
  organization: Organization | null;
}

// ============================================
// Token Types
// ============================================

/**
 * Access and refresh token pair returned from the API.
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ============================================
// Configuration
// ============================================

/**
 * Configuration accepted by the HeimdallProvider.
 */
export interface HeimdallConfig {
  publishableKey: string;
  apiUrl?: string;
  onTokenRefresh?: (tokens: TokenPair) => void;
  onAuthChange?: (state: AuthState) => void;
}

// ============================================
// Component Props
// ============================================

export interface SignInProps {
  mode?: 'modal' | 'redirect';
  redirectUrl?: string;
  appearance?: AppearanceConfig;
  onSuccess?: (user: User) => void;
}

export interface SignUpProps {
  mode?: 'modal' | 'redirect';
  redirectUrl?: string;
  appearance?: AppearanceConfig;
  onSuccess?: (user: User) => void;
}

export interface UserButtonProps {
  appearance?: AppearanceConfig;
  showName?: boolean;
  userProfileMode?: 'modal' | 'navigation';
  afterSignOutUrl?: string;
}

export interface AppearanceConfig {
  baseTheme?: 'light' | 'dark';
  variables?: {
    colorPrimary?: string;
    colorBackground?: string;
    colorText?: string;
    fontFamily?: string;
    borderRadius?: string;
  };
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

export interface MagicLinkResponse {
  success: boolean;
  message: string;
  email: string;
  expiresIn: number;
}

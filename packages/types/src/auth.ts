/**
 * Authentication-related types for Truxe
 */

export interface Session {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  last_active_at?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MagicLinkToken {
  token: string;
  email: string;
  expires_at: string;
}

export interface TOTPSecret {
  id: string;
  user_id: string;
  secret: string;
  enabled: boolean;
  created_at: string;
}

export interface BackupCode {
  id: string;
  user_id: string;
  code_hash: string;
  used: boolean;
  used_at?: string | null;
  created_at: string;
}

export interface OAuthProvider {
  provider: 'google' | 'github' | 'apple' | 'microsoft';
  provider_user_id: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    email_verified: boolean;
  };
  tokens: TokenPair;
  session_id: string;
}

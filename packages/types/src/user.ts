/**
 * User-related types for Truxe authentication system
 */

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  email: string;
  email_verified: boolean;
  password_hash?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

export interface UserProfile {
  id: string;
  user_id: string;
  display_name?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  user_id: string;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  notifications_enabled: boolean;
  two_factor_enabled: boolean;
}

export interface CreateUserInput {
  email: string;
  password?: string;
  first_name?: string;
  last_name?: string;
}

export interface UpdateUserInput {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

/**
 * @truxe/react
 *
 * React components and hooks for Truxe authentication.
 *
 * @packageDocumentation
 */

// ============================================
// Provider
// ============================================
export { TruxeProvider } from './context/TruxeProvider';

// ============================================
// Hooks
// ============================================
export { useAuth } from './hooks/useAuth';
export { useUser } from './hooks/useUser';
export { useSession } from './hooks/useSession';
export { useOrganization } from './hooks/useOrganization';

// ============================================
// UI Components
// ============================================
export { Button } from './components/ui/Button';
export type { ButtonProps } from './components/ui/Button';
export { Input } from './components/ui/Input';
export type { InputProps } from './components/ui/Input';
export { Modal } from './components/ui/Modal';
export type { ModalProps } from './components/ui/Modal';

// ============================================
// Auth Components
// ============================================
export { SignIn } from './components/auth/SignIn/SignIn';
export { SignUp } from './components/auth/SignUp/SignUp';
export { SignInButton } from './components/auth/SignInButton/SignInButton';
export type { SignInButtonProps } from './components/auth/SignInButton/SignInButton';
export { SignUpButton } from './components/auth/SignUpButton/SignUpButton';
export type { SignUpButtonProps } from './components/auth/SignUpButton/SignUpButton';
export { SignOutButton } from './components/auth/SignOutButton/SignOutButton';
export type { SignOutButtonProps } from './components/auth/SignOutButton/SignOutButton';

// ============================================
// User Components
// ============================================
export { UserButton } from './components/user/UserButton/UserButton';
export { UserProfile } from './components/user/UserProfile/UserProfile';
export type { UserProfileProps } from './components/user/UserProfile/UserProfile';
export { UserAvatar } from './components/user/UserAvatar/UserAvatar';
export type { UserAvatarProps } from './components/user/UserAvatar/UserAvatar';

// ============================================
// Types
// ============================================
export type {
  ApiResponse,
  AppearanceConfig,
  AuthResponse,
  AuthState,
  TruxeConfig,
  MagicLinkResponse,
  Organization,
  OrganizationMembership,
  Session,
  SignInProps,
  SignUpProps,
  TokenPair,
  User,
  UserButtonProps,
} from './types';

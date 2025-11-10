import { ReactNode } from 'react';

/**
 * Base component props that all UI components should extend
 */
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
  id?: string;
  'data-testid'?: string;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
  };
  borderRadius: string;
  fontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
  };
}

/**
 * User interface
 */
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  avatar?: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

/**
 * Organization interface
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

/**
 * User membership in organization
 */
export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: string[];
  invitedAt?: string;
  joinedAt?: string;
  invitedBy?: string;
}

/**
 * Authentication context interface
 */
export interface AuthContextType {
  // State
  user: User | null;
  organization: Organization | null;
  membership: Membership | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  login: (email: string, orgSlug?: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  verifyMagicLink: (token: string) => Promise<AuthResult>;
  refreshUser: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<AuthResult>;
  
  // Organization management
  createOrganization: (data: CreateOrganizationData) => Promise<Organization>;
  inviteUser: (data: InviteUserData) => Promise<void>;
  getUserOrganizations: () => Promise<OrganizationWithMembership[]>;
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  message: string;
  user?: User;
  organization?: Organization;
  membership?: Membership;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  };
}

/**
 * Organization with membership info
 */
export interface OrganizationWithMembership extends Organization {
  membership: Membership;
}

/**
 * Create organization data
 */
export interface CreateOrganizationData {
  name: string;
  slug?: string;
  logo?: string;
  settings?: Record<string, any>;
}

/**
 * Invite user data
 */
export interface InviteUserData {
  email: string;
  role: Membership['role'];
  organizationId: string;
}

/**
 * Form field state
 */
export interface FieldState {
  value: string;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

/**
 * Form state
 */
export interface FormState<T = Record<string, any>> {
  fields: Record<keyof T, FieldState>;
  isSubmitting: boolean;
  isValid: boolean;
  errors: Record<keyof T, string>;
}

/**
 * API configuration
 */
export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * Component variant types
 */
export type ComponentVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost' | 'outline';
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ComponentState = 'default' | 'hover' | 'active' | 'disabled' | 'loading';

/**
 * Accessibility props
 */
export interface AccessibilityProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  'aria-atomic'?: boolean;
  role?: string;
  tabIndex?: number;
}

/**
 * Loading state interface
 */
export interface LoadingState {
  isLoading: boolean;
  loadingText?: string;
  progress?: number;
}

/**
 * Error state interface
 */
export interface ErrorState {
  hasError: boolean;
  error?: Error | string;
  errorCode?: string;
  retryable?: boolean;
}

/**
 * Toast notification interface
 */
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Modal props interface
 */
export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ComponentSize;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

/**
 * Dropdown menu item interface
 */
export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  href?: string;
  separator?: boolean;
}

/**
 * Form validation rule
 */
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
}

/**
 * Form field configuration
 */
export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'select' | 'checkbox' | 'textarea';
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  validation?: ValidationRule;
  options?: Array<{ value: string; label: string }>;
}

/**
 * Component event handlers
 */
export interface ComponentEventHandlers {
  onClick?: (event: React.MouseEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  onFocus?: (event: React.FocusEvent) => void;
  onBlur?: (event: React.FocusEvent) => void;
  onChange?: (event: React.ChangeEvent) => void;
  onSubmit?: (event: React.FormEvent) => void;
}

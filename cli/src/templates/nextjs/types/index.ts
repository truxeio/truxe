// User and Authentication Types
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt?: string;
  status?: 'active' | 'inactive' | 'suspended';
  org?: Organization;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Authentication Context Types
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, orgSlug?: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

export interface AuthResult {
  success: boolean;
  message: string;
  user?: User;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
}

export interface MagicLinkResponse {
  success: boolean;
  message: string;
  email: string;
  expiresIn: number;
}

export interface VerificationResponse {
  success: boolean;
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  };
}

// Session Types
export interface Session {
  id: string;
  userId: string;
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
    ip?: string;
  };
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
  revokedAt?: string;
}

// Component Props Types
export interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
  requiredRole?: string;
  requiredPermissions?: string[];
}

export interface LoginFormProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  className?: string;
  showOrganization?: boolean;
}

export interface UserMenuProps {
  user?: User;
  className?: string;
}

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: 'blue' | 'white' | 'gray';
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

// Error Types
export interface TruxeError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Utility Types
export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: Status;
  error: string | null;
}

// Environment Variables
export interface EnvironmentConfig {
  NEXT_PUBLIC_TRUXE_URL: string;
  TRUXE_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

// Middleware Types
export interface MiddlewareConfig {
  matcher: string[];
}

export interface CSRFConfig {
  secret: string;
  cookie: {
    name: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
}

// Form Types
export interface LoginFormData {
  email: string;
  orgSlug?: string;
}

export interface ProfileFormData {
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

// Navigation Types
export interface NavigationItem {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  current?: boolean;
  requiredRole?: string;
  requiredPermissions?: string[];
}

// Theme Types
export interface ThemeConfig {
  colors: {
    primary: Record<string, string>;
    gray: Record<string, string>;
    success: Record<string, string>;
    warning: Record<string, string>;
    error: Record<string, string>;
  };
  fonts: {
    sans: string[];
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  boxShadow: Record<string, string>;
}

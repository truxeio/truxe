// Core providers
export { AuthProvider } from './providers/AuthProvider';
export { ToastProvider } from './providers/ToastProvider';
export { ThemeProvider, useTheme } from './providers/ThemeProvider';
export { AdminProvider, useAdmin } from './providers/AdminProvider';

// Hooks
export { 
  useAuth, 
  useIsAuthenticated, 
  useUser, 
  useOrganization, 
  useLogin, 
  useLogout 
} from './hooks/useAuth';
export { useForm } from './hooks/useForm';
export { useToast } from './hooks/useToast';
export { 
  useAccessibility, 
  useFocusTrap, 
  useAriaLive, 
  useKeyboardNavigation 
} from './hooks/useAccessibility';
export { useAdminNavigation } from './hooks/useAdminNavigation';

// Authentication components
export { LoginForm } from './components/auth/LoginForm';
export { UserMenu } from './components/auth/UserMenu';
export { OrganizationSwitcher } from './components/auth/OrganizationSwitcher';
export { ProtectedRoute, withProtectedRoute } from './components/auth/ProtectedRoute';

// UI components
export { Button } from './components/ui/Button';
export { Input } from './components/ui/Input';
export { LoadingSpinner, Skeleton, LoadingOverlay, LoadingButton } from './components/ui/LoadingSpinner';
export { ErrorBoundary, ErrorFallback, useErrorHandler } from './components/ui/ErrorBoundary';
export { ToastContainer } from './components/ui/Toast';

// Admin components
export { 
  AdminLayout, 
  AdminDashboard, 
  DataTable, 
  UserManagement, 
  SecurityMonitoring,
  Sidebar,
  TopBar,
  StatsCard,
  Modal,
  FormField,
  Badge,
  Card,
  AdminDashboardExample,
  AdminRouter,
  Breadcrumb,
  AdminDashboardComplete,
  LazyAdminComponents,
  PerformanceMonitor,
  PerformanceOptimizedAdmin,
  AccessibilityTester,
  AccessibleAdminLayout,
  AccessibleDataTable
} from './components/admin';
export type { 
  AdminLayoutProps, 
  AdminDashboardProps, 
  DataTableProps, 
  Column, 
  UserManagementProps, 
  SecurityMonitoringProps,
  SidebarProps,
  TopBarProps,
  StatsCardProps,
  ModalProps,
  FormFieldProps,
  BadgeProps,
  CardProps,
  AdminDashboardExampleProps,
  AdminRouterProps,
  AdminUser,
  AdminRoute,
  AdminRouterContextType,
  BreadcrumbProps,
  BreadcrumbItem,
  AdminDashboardCompleteProps,
  PerformanceMonitorProps,
  PerformanceOptimizedAdminProps,
  AccessibilityTesterProps,
  AccessibleAdminLayoutProps,
  AccessibleDataTableProps
} from './components/admin';

// Utilities
export { cn, generateId, debounce, isFocusable, getFocusableElements, createFocusTrap, formatErrorMessage, isValidEmail, getInitials, prefersReducedMotion, prefersHighContrast, prefersDarkTheme, announceToScreenReader } from './lib/utils';
export { ARIA_LABELS, KEYS, THEME_VARIANTS, SIZES, ANIMATION_DURATION, BREAKPOINTS, Z_INDEX, FOCUS_STYLES, ERROR_MESSAGES, SUCCESS_MESSAGES } from './lib/constants';
export { 
  measurePerformance, 
  getPerformanceMetrics, 
  createLazyComponent, 
  preloadComponent, 
  preloadComponents,
  usePerformanceOptimization,
  PerformanceMetrics,
  PerformanceOptimizationConfig
} from './lib/performance-utils';
export { 
  PerformanceTester, 
  runQuickPerformanceTest, 
  runPerformanceTestWithCustomThresholds, 
  generatePerformanceReport,
  PerformanceTestResult,
  PerformanceThreshold,
  DEFAULT_THRESHOLDS
} from './lib/performance-testing';
export { 
  ARIA_ROLES,
  ARIA_STATES,
  ARIA_PROPERTIES,
  KEYBOARD_KEYS,
  focusManagement,
  screenReader,
  colorContrast,
  accessibilityTesting
} from './lib/accessibility-utils';

// Types
export type {
  BaseComponentProps,
  ThemeConfig,
  User,
  Organization,
  Membership,
  AuthContextType,
  AuthResult,
  OrganizationWithMembership,
  CreateOrganizationData,
  InviteUserData,
  FieldState,
  FormState,
  ApiConfig,
  ComponentVariant,
  ComponentSize,
  ComponentState,
  AccessibilityProps,
  LoadingState,
  ErrorState,
  Toast,
  ModalProps,
  DropdownItem,
  ValidationRule,
  FieldConfig,
  ComponentEventHandlers
} from './types';

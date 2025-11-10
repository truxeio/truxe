/**
 * Accessibility constants and ARIA labels
 */
export const ARIA_LABELS = {
  // Authentication
  LOGIN_FORM: 'Sign in to your account',
  SIGNUP_FORM: 'Create your account',
  EMAIL_INPUT: 'Email address',
  PASSWORD_INPUT: 'Password',
  SUBMIT_LOGIN: 'Sign in',
  SUBMIT_SIGNUP: 'Create account',
  LOADING: 'Loading...',
  
  // User menu
  USER_MENU: 'User account menu',
  USER_AVATAR: 'User avatar',
  LOGOUT: 'Sign out',
  PROFILE: 'View profile',
  SETTINGS: 'Account settings',
  
  // Organization
  ORG_SWITCHER: 'Switch organization',
  ORG_MENU: 'Organization menu',
  CREATE_ORG: 'Create organization',
  INVITE_USERS: 'Invite users',
  
  // Navigation
  CLOSE_MENU: 'Close menu',
  OPEN_MENU: 'Open menu',
  BACK: 'Go back',
  NEXT: 'Continue',
  
  // Status
  SUCCESS: 'Success',
  ERROR: 'Error',
  WARNING: 'Warning',
  INFO: 'Information',
  
  // Forms
  REQUIRED_FIELD: 'Required field',
  OPTIONAL_FIELD: 'Optional field',
  FORM_ERROR: 'Form contains errors',
  FORM_SUCCESS: 'Form submitted successfully',
} as const;

/**
 * Keyboard navigation constants
 */
export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  TAB: 'Tab',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

/**
 * Theme variants
 */
export const THEME_VARIANTS = {
  DEFAULT: 'default',
  DARK: 'dark',
  HIGH_CONTRAST: 'high-contrast',
  SYSTEM: 'system',
} as const;

/**
 * Component sizes
 */
export const SIZES = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
} as const;

/**
 * Animation durations (in milliseconds)
 */
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

/**
 * Breakpoints for responsive design
 */
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

/**
 * Z-index layers
 */
export const Z_INDEX = {
  DROPDOWN: 1000,
  STICKY: 1020,
  FIXED: 1030,
  MODAL_BACKDROP: 1040,
  MODAL: 1050,
  POPOVER: 1060,
  TOOLTIP: 1070,
  TOAST: 1080,
} as const;

/**
 * Focus ring styles for accessibility
 */
export const FOCUS_STYLES = {
  DEFAULT: 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  INSET: 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset',
  NONE: 'focus:outline-none',
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  NETWORK_ERROR: 'Network error. Please try again.',
  GENERIC_ERROR: 'An unexpected error occurred',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'The requested resource was not found',
  SERVER_ERROR: 'Server error. Please try again later.',
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  MAGIC_LINK_SENT: 'Magic link sent! Check your email.',
  ACCOUNT_CREATED: 'Account created successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  PASSWORD_CHANGED: 'Password changed successfully',
  INVITATION_SENT: 'Invitation sent successfully',
  ORGANIZATION_CREATED: 'Organization created successfully',
} as const;

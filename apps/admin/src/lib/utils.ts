import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx for conditional classes and tailwind-merge for deduplication
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a stable ID for accessibility purposes
 */
export function generateId(prefix = 'truxe') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Check if an element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  const focusableElements = [
    'input',
    'select',
    'textarea',
    'button',
    'a',
    '[tabindex]',
  ];
  
  const tagName = element.tagName.toLowerCase();
  const isTabIndexFocusable = element.tabIndex >= 0;
  const isNativelyFocusable = focusableElements.some(selector => {
    if (selector === '[tabindex]') return false;
    return element.matches(selector);
  });
  
  return (isNativelyFocusable || isTabIndexFocusable) &&
         !('disabled' in element && (element as any).disabled) &&
         !element.hidden &&
         element.offsetParent !== null;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'input:not([disabled]):not([hidden])',
    'select:not([disabled]):not([hidden])',
    'textarea:not([disabled]):not([hidden])',
    'button:not([disabled]):not([hidden])',
    'a[href]:not([disabled]):not([hidden])',
    '[tabindex]:not([tabindex="-1"]):not([disabled]):not([hidden])',
  ];
  
  const elements = container.querySelectorAll(focusableSelectors.join(', '));
  return Array.from(elements).filter(el => isFocusable(el as HTMLElement)) as HTMLElement[];
}

/**
 * Trap focus within a container (for modals, dropdowns, etc.)
 */
export function createFocusTrap(container: HTMLElement) {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  };
  
  container.addEventListener('keydown', handleKeyDown);
  
  // Focus the first element
  firstElement?.focus();
  
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Format error messages for user display
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get initials from email or name
 */
export function getInitials(text: string): string {
  if (text.includes('@')) {
    // Email - use part before @
    text = text.split('@')[0];
  }
  
  return text
    .split(/[\s\-_\.]/)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Check if user prefers dark theme
 */
export function prefersDarkTheme(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Announce to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

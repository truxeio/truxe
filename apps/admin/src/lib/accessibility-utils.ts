/**
 * Accessibility Utilities for Admin Dashboard
 * 
 * Provides utilities for WCAG 2.1 AA compliance, keyboard navigation,
 * screen reader support, and accessibility testing.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ARIA attributes and roles
export const ARIA_ROLES = {
  BUTTON: 'button',
  MENU: 'menu',
  MENUITEM: 'menuitem',
  NAVIGATION: 'navigation',
  MAIN: 'main',
  BANNER: 'banner',
  CONTENTINFO: 'contentinfo',
  COMPLEMENTARY: 'complementary',
  SEARCH: 'search',
  FORM: 'form',
  TABLIST: 'tablist',
  TAB: 'tab',
  TABPANEL: 'tabpanel',
  DIALOG: 'dialog',
  ALERT: 'alert',
  STATUS: 'status',
  PROGRESSBAR: 'progressbar',
  TOOLTIP: 'tooltip',
  GRID: 'grid',
  ROW: 'row',
  CELL: 'cell',
  COLUMNHEADER: 'columnheader',
  ROWHEADER: 'rowheader'
} as const;

export const ARIA_STATES = {
  EXPANDED: 'aria-expanded',
  SELECTED: 'aria-selected',
  CHECKED: 'aria-checked',
  DISABLED: 'aria-disabled',
  HIDDEN: 'aria-hidden',
  PRESSED: 'aria-pressed',
  INVALID: 'aria-invalid',
  REQUIRED: 'aria-required',
  READONLY: 'aria-readonly',
  MULTISELECTABLE: 'aria-multiselectable',
  ORIENTATION: 'aria-orientation',
  SORT: 'aria-sort',
  LEVEL: 'aria-level',
  POSINSET: 'aria-posinset',
  SETSIZE: 'aria-setsize'
} as const;

export const ARIA_PROPERTIES = {
  LABEL: 'aria-label',
  LABELLEDBY: 'aria-labelledby',
  DESCRIBEDBY: 'aria-describedby',
  CONTROLS: 'aria-controls',
  OWNS: 'aria-owns',
  FLOWTO: 'aria-flowto',
  ACTIVE: 'aria-activedescendant',
  AUTOMATIC: 'aria-autocomplete',
  COMPLETE: 'aria-complete',
  CURRENT: 'aria-current',
  DROPEFFECT: 'aria-dropeffect',
  GRABBED: 'aria-grabbed',
  HAS: 'aria-haspopup',
  LIVE: 'aria-live',
  MODAL: 'aria-modal',
  MULTILINE: 'aria-multiline',
  ORIENTATION: 'aria-orientation',
  PLACEHOLDER: 'aria-placeholder',
  RELEVANT: 'aria-relevant',
  SORT: 'aria-sort',
  VALUEMAX: 'aria-valuemax',
  VALUEMIN: 'aria-valuemin',
  VALUENOW: 'aria-valuenow',
  VALUETEXT: 'aria-valuetext'
} as const;

// Keyboard navigation keys
export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace',
  F1: 'F1',
  F2: 'F2',
  F3: 'F3',
  F4: 'F4',
  F5: 'F5',
  F6: 'F6',
  F7: 'F7',
  F8: 'F8',
  F9: 'F9',
  F10: 'F10',
  F11: 'F11',
  F12: 'F12'
} as const;

// Focus management utilities
export const focusManagement = {
  /**
   * Get all focusable elements within a container
   */
  getFocusableElements: (container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
  },

  /**
   * Get the first focusable element
   */
  getFirstFocusable: (container: HTMLElement): HTMLElement | null => {
    const focusableElements = focusManagement.getFocusableElements(container);
    return focusableElements[0] || null;
  },

  /**
   * Get the last focusable element
   */
  getLastFocusable: (container: HTMLElement): HTMLElement | null => {
    const focusableElements = focusManagement.getFocusableElements(container);
    return focusableElements[focusableElements.length - 1] || null;
  },

  /**
   * Focus the first focusable element
   */
  focusFirst: (container: HTMLElement): boolean => {
    const firstElement = focusManagement.getFirstFocusable(container);
    if (firstElement) {
      firstElement.focus();
      return true;
    }
    return false;
  },

  /**
   * Focus the last focusable element
   */
  focusLast: (container: HTMLElement): boolean => {
    const lastElement = focusManagement.getLastFocusable(container);
    if (lastElement) {
      lastElement.focus();
      return true;
    }
    return false;
  },

  /**
   * Focus the next focusable element
   */
  focusNext: (currentElement: HTMLElement): boolean => {
    const container = currentElement.closest('[role="menu"], [role="dialog"], body') as HTMLElement;
    const focusableElements = focusManagement.getFocusableElements(container);
    const currentIndex = focusableElements.indexOf(currentElement);
    
    if (currentIndex < focusableElements.length - 1) {
      focusableElements[currentIndex + 1].focus();
      return true;
    }
    return false;
  },

  /**
   * Focus the previous focusable element
   */
  focusPrevious: (currentElement: HTMLElement): boolean => {
    const container = currentElement.closest('[role="menu"], [role="dialog"], body') as HTMLElement;
    const focusableElements = focusManagement.getFocusableElements(container);
    const currentIndex = focusableElements.indexOf(currentElement);
    
    if (currentIndex > 0) {
      focusableElements[currentIndex - 1].focus();
      return true;
    }
    return false;
  }
};

// Screen reader utilities
export const screenReader = {
  /**
   * Announce text to screen readers
   */
  announce: (text: string, priority: 'polite' | 'assertive' = 'polite'): void => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = text;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  },

  /**
   * Announce page title change
   */
  announcePageChange: (title: string): void => {
    document.title = title;
    screenReader.announce(`Page changed to ${title}`);
  },

  /**
   * Announce form validation errors
   */
  announceValidationError: (fieldName: string, error: string): void => {
    screenReader.announce(`Error in ${fieldName}: ${error}`, 'assertive');
  },

  /**
   * Announce success messages
   */
  announceSuccess: (message: string): void => {
    screenReader.announce(`Success: ${message}`, 'polite');
  }
};

// Color contrast utilities
export const colorContrast = {
  /**
   * Calculate relative luminance
   */
  getRelativeLuminance: (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  },

  /**
   * Calculate contrast ratio
   */
  getContrastRatio: (color1: string, color2: string): number => {
    const parseColor = (color: string) => {
      const hex = color.replace('#', '');
      return {
        r: parseInt(hex.substr(0, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        b: parseInt(hex.substr(4, 2), 16)
      };
    };

    const c1 = parseColor(color1);
    const c2 = parseColor(color2);
    
    const l1 = colorContrast.getRelativeLuminance(c1.r, c1.g, c1.b);
    const l2 = colorContrast.getRelativeLuminance(c2.r, c2.g, c2.b);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  },

  /**
   * Check if contrast meets WCAG AA standards
   */
  meetsWCAGAA: (foreground: string, background: string): boolean => {
    const ratio = colorContrast.getContrastRatio(foreground, background);
    return ratio >= 4.5; // WCAG AA standard for normal text
  },

  /**
   * Check if contrast meets WCAG AAA standards
   */
  meetsWCAGAAA: (foreground: string, background: string): boolean => {
    const ratio = colorContrast.getContrastRatio(foreground, background);
    return ratio >= 7; // WCAG AAA standard for normal text
  }
};

// Accessibility testing utilities
export const accessibilityTesting = {
  /**
   * Check if element has proper ARIA attributes
   */
  hasProperARIA: (element: HTMLElement): boolean => {
    const role = element.getAttribute('role');
    const hasLabel = element.hasAttribute('aria-label') ||
                    element.hasAttribute('aria-labelledby') ||
                    Boolean(element.textContent?.trim());

    // Basic checks for interactive elements
    if (['button', 'link', 'menuitem'].includes(role || '')) {
      return hasLabel;
    }
    
    return true;
  },

  /**
   * Check if element is keyboard accessible
   */
  isKeyboardAccessible: (element: HTMLElement): boolean => {
    const tabIndex = element.getAttribute('tabindex');
    const role = element.getAttribute('role');
    
    // Check if element can receive focus
    if (tabIndex === '-1') {
      return false;
    }
    
    // Check if interactive elements have proper keyboard support
    if (['button', 'link', 'menuitem'].includes(role || '')) {
      return true;
    }
    
    return true;
  },

  /**
   * Check if element has proper color contrast
   */
  hasProperContrast: (element: HTMLElement): boolean => {
    const styles = window.getComputedStyle(element);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;
    
    if (color && backgroundColor) {
      return colorContrast.meetsWCAGAA(color, backgroundColor);
    }
    
    return true;
  },

  /**
   * Run comprehensive accessibility check
   */
  runAccessibilityCheck: (element: HTMLElement): {
    hasProperARIA: boolean;
    isKeyboardAccessible: boolean;
    hasProperContrast: boolean;
    issues: string[];
  } => {
    const issues: string[] = [];
    
    const hasProperARIA = accessibilityTesting.hasProperARIA(element);
    if (!hasProperARIA) {
      issues.push('Missing or improper ARIA attributes');
    }
    
    const isKeyboardAccessible = accessibilityTesting.isKeyboardAccessible(element);
    if (!isKeyboardAccessible) {
      issues.push('Not keyboard accessible');
    }
    
    const hasProperContrast = accessibilityTesting.hasProperContrast(element);
    if (!hasProperContrast) {
      issues.push('Insufficient color contrast');
    }
    
    return {
      hasProperARIA,
      isKeyboardAccessible,
      hasProperContrast,
      issues
    };
  }
};

// React hooks for accessibility
export const useAccessibility = () => {
  const [announcements, setAnnouncements] = useState<string[]>([]);

  const announce = useCallback((text: string, priority: 'polite' | 'assertive' = 'polite') => {
    screenReader.announce(text, priority);
    setAnnouncements(prev => [...prev, text]);
  }, []);

  const announcePageChange = useCallback((title: string) => {
    screenReader.announcePageChange(title);
  }, []);

  const announceValidationError = useCallback((fieldName: string, error: string) => {
    screenReader.announceValidationError(fieldName, error);
  }, []);

  const announceSuccess = useCallback((message: string) => {
    screenReader.announceSuccess(message);
  }, []);

  return {
    announce,
    announcePageChange,
    announceValidationError,
    announceSuccess,
    announcements
  };
};

export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the first focusable element
    focusManagement.focusFirst(containerRef.current);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYBOARD_KEYS.TAB) {
        const focusableElements = focusManagement.getFocusableElements(containerRef.current!);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previously focused element
      previousActiveElement.current?.focus();
    };
  }, [isActive]);

  return containerRef;
};

export const useKeyboardNavigation = (onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case KEYBOARD_KEYS.ARROW_UP:
        event.preventDefault();
        onNavigate('up');
        break;
      case KEYBOARD_KEYS.ARROW_DOWN:
        event.preventDefault();
        onNavigate('down');
        break;
      case KEYBOARD_KEYS.ARROW_LEFT:
        event.preventDefault();
        onNavigate('left');
        break;
      case KEYBOARD_KEYS.ARROW_RIGHT:
        event.preventDefault();
        onNavigate('right');
        break;
    }
  }, [onNavigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

export default {
  ARIA_ROLES,
  ARIA_STATES,
  ARIA_PROPERTIES,
  KEYBOARD_KEYS,
  focusManagement,
  screenReader,
  colorContrast,
  accessibilityTesting,
  useAccessibility,
  useFocusTrap,
  useKeyboardNavigation
};


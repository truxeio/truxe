import { useEffect, useState, useCallback } from 'react';
import { 
  prefersReducedMotion, 
  prefersHighContrast, 
  prefersDarkTheme,
  announceToScreenReader,
  createFocusTrap
} from '../lib/utils';

/**
 * Hook for managing accessibility preferences
 */
export function useAccessibility() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);
  
  useEffect(() => {
    // Initial values
    setReducedMotion(prefersReducedMotion());
    setHighContrast(prefersHighContrast());
    setDarkTheme(prefersDarkTheme());
    
    // Media query listeners
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    const darkThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleReducedMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    const handleHighContrastChange = (e: MediaQueryListEvent) => setHighContrast(e.matches);
    const handleDarkThemeChange = (e: MediaQueryListEvent) => setDarkTheme(e.matches);
    
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    highContrastQuery.addEventListener('change', handleHighContrastChange);
    darkThemeQuery.addEventListener('change', handleDarkThemeChange);
    
    return () => {
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
      darkThemeQuery.removeEventListener('change', handleDarkThemeChange);
    };
  }, []);
  
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceToScreenReader(message, priority);
  }, []);
  
  return {
    preferences: {
      reducedMotion,
      highContrast,
      darkTheme,
    },
    announce,
  };
}

/**
 * Hook for managing focus trap
 */
export function useFocusTrap(isActive: boolean = false) {
  const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);
  
  useEffect(() => {
    if (!isActive || !containerRef) return;
    
    const cleanup = createFocusTrap(containerRef);
    return cleanup;
  }, [isActive, containerRef]);
  
  return setContainerRef;
}

/**
 * Hook for managing ARIA live regions
 */
export function useAriaLive() {
  const [liveRegion, setLiveRegion] = useState<HTMLElement | null>(null);
  
  useEffect(() => {
    // Create live region if it doesn't exist
    if (!liveRegion) {
      const region = document.createElement('div');
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      region.className = 'sr-only';
      document.body.appendChild(region);
      setLiveRegion(region);
    }
    
    return () => {
      if (liveRegion && document.body.contains(liveRegion)) {
        document.body.removeChild(liveRegion);
      }
    };
  }, [liveRegion]);
  
  const announce = useCallback((message: string) => {
    if (liveRegion) {
      liveRegion.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        if (liveRegion) {
          liveRegion.textContent = '';
        }
      }, 1000);
    }
  }, [liveRegion]);
  
  return { announce };
}

/**
 * Hook for keyboard navigation
 */
export function useKeyboardNavigation(
  items: HTMLElement[],
  options: {
    loop?: boolean;
    orientation?: 'horizontal' | 'vertical' | 'both';
  } = {}
) {
  const { loop = true, orientation = 'vertical' } = options;
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key } = event;
    
    let newIndex = currentIndex;
    
    switch (key) {
      case 'ArrowDown':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault();
          newIndex = currentIndex + 1;
          if (newIndex >= items.length) {
            newIndex = loop ? 0 : items.length - 1;
          }
        }
        break;
        
      case 'ArrowUp':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault();
          newIndex = currentIndex - 1;
          if (newIndex < 0) {
            newIndex = loop ? items.length - 1 : 0;
          }
        }
        break;
        
      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault();
          newIndex = currentIndex + 1;
          if (newIndex >= items.length) {
            newIndex = loop ? 0 : items.length - 1;
          }
        }
        break;
        
      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault();
          newIndex = currentIndex - 1;
          if (newIndex < 0) {
            newIndex = loop ? items.length - 1 : 0;
          }
        }
        break;
        
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
        
      case 'End':
        event.preventDefault();
        newIndex = items.length - 1;
        break;
        
      default:
        return;
    }
    
    setCurrentIndex(newIndex);
    items[newIndex]?.focus();
  }, [currentIndex, items, loop, orientation]);
  
  return {
    currentIndex,
    setCurrentIndex,
    handleKeyDown,
  };
}

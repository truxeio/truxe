import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { ThemeConfig } from '../types';
import { THEME_VARIANTS } from '../lib/constants';

type ThemeVariant = typeof THEME_VARIANTS[keyof typeof THEME_VARIANTS];

interface ThemeContextType {
  theme: ThemeVariant;
  setTheme: (theme: ThemeVariant) => void;
  config: ThemeConfig;
  updateConfig: (config: Partial<ThemeConfig>) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const defaultThemeConfig: ThemeConfig = {
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  borderRadius: '0.5rem',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
  },
};

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeVariant;
  config?: Partial<ThemeConfig>;
  storageKey?: string;
}

/**
 * Theme provider with dark mode and accessibility support
 */
export function ThemeProvider({
  children,
  defaultTheme = THEME_VARIANTS.SYSTEM,
  config: userConfig = {},
  storageKey = 'truxe-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeVariant>(defaultTheme);
  const [config, setConfig] = useState<ThemeConfig>({
    ...defaultThemeConfig,
    ...userConfig,
  });

  // Load theme from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && Object.values(THEME_VARIANTS).includes(stored as ThemeVariant)) {
        setThemeState(stored as ThemeVariant);
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    }
  }, [storageKey]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('theme-default', 'theme-dark', 'theme-high-contrast');
    
    let effectiveTheme = theme;
    
    // Handle system theme
    if (theme === THEME_VARIANTS.SYSTEM) {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? THEME_VARIANTS.DARK 
        : THEME_VARIANTS.DEFAULT;
    }
    
    // Apply theme class
    root.classList.add(`theme-${effectiveTheme}`);
    
    // Apply CSS custom properties
    root.style.setProperty('--color-primary', config.colors.primary);
    root.style.setProperty('--color-secondary', config.colors.secondary);
    root.style.setProperty('--color-success', config.colors.success);
    root.style.setProperty('--color-warning', config.colors.warning);
    root.style.setProperty('--color-error', config.colors.error);
    root.style.setProperty('--border-radius', config.borderRadius);
    root.style.setProperty('--font-family', config.fontFamily);
    
    Object.entries(config.fontSize).forEach(([key, value]) => {
      root.style.setProperty(`--font-size-${key}`, value);
    });
    
  }, [theme, config]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== THEME_VARIANTS.SYSTEM) return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Force re-render to apply new system theme
      setThemeState(THEME_VARIANTS.SYSTEM);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = (newTheme: ThemeVariant) => {
    setThemeState(newTheme);
    
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  };

  const updateConfig = (newConfig: Partial<ThemeConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...newConfig,
      colors: {
        ...prev.colors,
        ...newConfig.colors,
      },
      fontSize: {
        ...prev.fontSize,
        ...newConfig.fontSize,
      },
    }));
  };

  const contextValue: ThemeContextType = {
    theme,
    setTheme,
    config,
    updateConfig,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}

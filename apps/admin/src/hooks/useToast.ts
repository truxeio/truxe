import { useContext } from 'react';
import { ToastContext } from '../providers/ToastProvider';
import type { Toast } from '../types';

/**
 * Hook to access toast notifications
 */
export function useToast() {
  const context = useContext(ToastContext);
  
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  const { toasts, addToast, removeToast, clearToasts } = context;
  
  // Helper functions for different toast types
  const success = (title: string, description?: string, options?: Partial<Toast>) => {
    addToast({
      type: 'success',
      title,
      description,
      duration: 5000,
      ...options,
    });
  };
  
  const error = (title: string, description?: string, options?: Partial<Toast>) => {
    addToast({
      type: 'error',
      title,
      description,
      duration: 7000,
      ...options,
    });
  };
  
  const warning = (title: string, description?: string, options?: Partial<Toast>) => {
    addToast({
      type: 'warning',
      title,
      description,
      duration: 6000,
      ...options,
    });
  };
  
  const info = (title: string, description?: string, options?: Partial<Toast>) => {
    addToast({
      type: 'info',
      title,
      description,
      duration: 5000,
      ...options,
    });
  };
  
  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
  };
}

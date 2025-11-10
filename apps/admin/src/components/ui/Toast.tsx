import React, { useEffect, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import type { Toast as ToastType } from '../../types';

interface ToastProps {
  toast: ToastType;
  onClose: () => void;
}

/**
 * Individual toast notification component
 */
function Toast({ toast, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Match animation duration
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg
            className="h-5 w-5 text-success-600"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'error':
        return (
          <svg
            className="h-5 w-5 text-error-600"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg
            className="h-5 w-5 text-warning-600"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'info':
        return (
          <svg
            className="h-5 w-5 text-primary-600"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const getStyles = () => {
    const baseStyles = 'border-l-4 bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-secondary-800 dark:ring-secondary-700';
    
    switch (toast.type) {
      case 'success':
        return `${baseStyles} border-success-500`;
      case 'error':
        return `${baseStyles} border-error-500`;
      case 'warning':
        return `${baseStyles} border-warning-500`;
      case 'info':
        return `${baseStyles} border-primary-500`;
      default:
        return `${baseStyles} border-secondary-500`;
    }
  };

  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg transition-all duration-300 ease-in-out',
        getStyles(),
        isVisible && !isExiting 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
      )}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
              {toast.title}
            </p>
            {toast.description && (
              <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
                {toast.description}
              </p>
            )}
            {toast.action && (
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={toast.action.onClick}
                  className="text-primary-600 hover:text-primary-500 dark:text-primary-400"
                >
                  {toast.action.label}
                </Button>
              </div>
            )}
          </div>
          
          <div className="ml-4 flex flex-shrink-0">
            <button
              type="button"
              className="inline-flex rounded-md text-secondary-400 hover:text-secondary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:text-secondary-500 dark:hover:text-secondary-300"
              onClick={handleClose}
              aria-label="Close notification"
            >
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Toast container component
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-6 sm:items-start sm:justify-end"
      aria-live="assertive"
      aria-label="Notifications"
    >
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Toast hook for programmatic usage
 */
export { useToast } from '../../hooks/useToast';

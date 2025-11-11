import React, { forwardRef, InputHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { FOCUS_STYLES } from '../../lib/constants';

const inputVariants = cva(
  [
    'flex w-full rounded-md border px-3 py-2 text-sm',
    'bg-white placeholder:text-secondary-500',
    'transition-colors duration-200',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-secondary-50',
    'read-only:cursor-default read-only:bg-secondary-50',
    FOCUS_STYLES.DEFAULT,
  ],
  {
    variants: {
      variant: {
        default: [
          'border-secondary-300 text-secondary-900',
          'hover:border-secondary-400',
          'focus:border-primary-500 focus:ring-primary-500',
          'dark:bg-secondary-900 dark:border-secondary-600 dark:text-secondary-100',
          'dark:placeholder:text-secondary-400',
        ],
        error: [
          'border-error-500 text-error-900',
          'hover:border-error-600',
          'focus:border-error-500 focus:ring-error-500',
          'bg-error-50 placeholder:text-error-400',
          'dark:bg-error-900/20 dark:border-error-400',
        ],
        success: [
          'border-success-500 text-success-900',
          'hover:border-success-600',
          'focus:border-success-500 focus:ring-success-500',
          'bg-success-50 placeholder:text-success-400',
          'dark:bg-success-900/20 dark:border-success-400',
        ],
      },
      size: {
        sm: 'h-8 px-2 py-1 text-xs',
        md: 'h-10 px-3 py-2 text-sm',
        lg: 'h-12 px-4 py-3 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

/**
 * Accessible input component with validation states
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      variant,
      size,
      label,
      description,
      error,
      success,
      leftIcon,
      rightIcon,
      id,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const successId = success ? `${inputId}-success` : undefined;
    
    // Determine variant based on validation state
    const effectiveVariant = error ? 'error' : success ? 'success' : variant;
    
    // Build aria-describedby
    const ariaDescribedBy = [descriptionId, errorId, successId]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className={cn('space-y-2', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-secondary-900 dark:text-secondary-100"
          >
            {label}
            {required && (
              <span className="ml-1 text-error-500" aria-label="required">
                *
              </span>
            )}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={cn(
              inputVariants({ variant: effectiveVariant, size }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={ariaDescribedBy}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400">
              {rightIcon}
            </div>
          )}
        </div>
        
        {description && !error && !success && (
          <p
            id={descriptionId}
            className="text-xs text-secondary-600 dark:text-secondary-400"
          >
            {description}
          </p>
        )}
        
        {error && (
          <p
            id={errorId}
            className="flex items-center text-xs text-error-600 dark:text-error-400"
            role="alert"
            aria-live="polite"
          >
            <svg
              className="mr-1 h-3 w-3 flex-shrink-0"
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
            {error}
          </p>
        )}
        
        {success && !error && (
          <p
            id={successId}
            className="flex items-center text-xs text-success-600 dark:text-success-400"
            role="status"
            aria-live="polite"
          >
            <svg
              className="mr-1 h-3 w-3 flex-shrink-0"
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
            {success}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/utils';
import { FOCUS_STYLES } from '../../lib/constants';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium',
    'transition-colors duration-200 ease-in-out',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-95 transform transition-transform',
    FOCUS_STYLES.DEFAULT,
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-primary-600 text-white shadow-sm',
          'hover:bg-primary-700 active:bg-primary-800',
          'border border-primary-600 hover:border-primary-700',
        ],
        secondary: [
          'bg-secondary-100 text-secondary-900 shadow-sm',
          'hover:bg-secondary-200 active:bg-secondary-300',
          'border border-secondary-200 hover:border-secondary-300',
          'dark:bg-secondary-800 dark:text-secondary-100',
          'dark:hover:bg-secondary-700 dark:border-secondary-700',
        ],
        success: [
          'bg-success-600 text-white shadow-sm',
          'hover:bg-success-700 active:bg-success-800',
          'border border-success-600 hover:border-success-700',
        ],
        warning: [
          'bg-warning-600 text-white shadow-sm',
          'hover:bg-warning-700 active:bg-warning-800',
          'border border-warning-600 hover:border-warning-700',
        ],
        error: [
          'bg-error-600 text-white shadow-sm',
          'hover:bg-error-700 active:bg-error-800',
          'border border-error-600 hover:border-error-700',
        ],
        outline: [
          'border border-secondary-300 bg-transparent text-secondary-700 shadow-sm',
          'hover:bg-secondary-50 active:bg-secondary-100',
          'dark:border-secondary-600 dark:text-secondary-300',
          'dark:hover:bg-secondary-800/50',
        ],
        ghost: [
          'bg-transparent text-secondary-700 shadow-none',
          'hover:bg-secondary-100 active:bg-secondary-200',
          'dark:text-secondary-300 dark:hover:bg-secondary-800',
        ],
        link: [
          'bg-transparent text-primary-600 underline-offset-4 shadow-none p-0',
          'hover:underline active:text-primary-800',
          'dark:text-primary-400',
        ],
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-6 text-base',
        xl: 'h-12 px-8 text-lg',
        icon: 'h-10 w-10 p-0',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Accessible button component with multiple variants and states
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!loading && leftIcon && (
          <span className="mr-2 flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <span className={cn(loading && 'opacity-70')}>
          {loading && loadingText ? loadingText : children}
        </span>
        {!loading && rightIcon && (
          <span className="ml-2 flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
        {loading && (
          <span className="sr-only">
            {loadingText || 'Loading...'}
          </span>
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

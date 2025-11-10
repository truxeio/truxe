import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { LoadingSpinner } from './LoadingSpinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 border-transparent',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 border-gray-300',
  destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border-transparent',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500 border-transparent',
  outline: 'bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-500 border-gray-300',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        ref={ref}
        {...props}
      >
        {loading && (
          <LoadingSpinner
            size="sm"
            color={variant === 'primary' || variant === 'destructive' ? 'white' : 'gray'}
            className="mr-2"
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

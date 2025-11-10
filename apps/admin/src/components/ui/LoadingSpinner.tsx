import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const spinnerVariants = cva(
  'animate-spin rounded-full border-solid border-current',
  {
    variants: {
      size: {
        xs: 'h-3 w-3 border',
        sm: 'h-4 w-4 border',
        md: 'h-6 w-6 border-2',
        lg: 'h-8 w-8 border-2',
        xl: 'h-12 w-12 border-4',
      },
      variant: {
        default: 'border-secondary-300 border-t-secondary-900 dark:border-secondary-600 dark:border-t-secondary-100',
        primary: 'border-primary-300 border-t-primary-600',
        white: 'border-white/30 border-t-white',
        black: 'border-black/30 border-t-black',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  }
);

export interface LoadingSpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string;
}

/**
 * Accessible loading spinner component
 */
export function LoadingSpinner({
  className,
  size,
  variant,
  label = 'Loading...',
  ...props
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn('flex items-center justify-center', className)}
      role="status"
      aria-live="polite"
      {...props}
    >
      <div className={spinnerVariants({ size, variant })} />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Loading skeleton component for content placeholders
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
  avatar?: boolean;
}

export function Skeleton({
  className,
  lines = 1,
  avatar = false,
  ...props
}: SkeletonProps) {
  return (
    <div className={cn('animate-pulse', className)} {...props}>
      {avatar && (
        <div className="mb-4 h-12 w-12 rounded-full bg-secondary-300 dark:bg-secondary-600" />
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'h-4 bg-secondary-300 rounded dark:bg-secondary-600',
              index === lines - 1 && lines > 1 && 'w-3/4'
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Loading overlay component
 */
export interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  spinnerSize?: VariantProps<typeof spinnerVariants>['size'];
  label?: string;
  backdrop?: boolean;
}

export function LoadingOverlay({
  isLoading,
  children,
  className,
  spinnerSize = 'lg',
  label = 'Loading...',
  backdrop = true,
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            backdrop && 'bg-white/80 dark:bg-secondary-900/80 backdrop-blur-sm'
          )}
          aria-hidden={!isLoading}
        >
          <LoadingSpinner size={spinnerSize} label={label} />
        </div>
      )}
    </div>
  );
}

/**
 * Loading button content component
 */
export interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  spinnerSize?: VariantProps<typeof spinnerVariants>['size'];
}

export function LoadingButton({
  isLoading,
  children,
  loadingText,
  spinnerSize = 'sm',
}: LoadingButtonProps) {
  return (
    <>
      {isLoading && (
        <LoadingSpinner
          size={spinnerSize}
          variant="white"
          className="mr-2"
          label={loadingText || 'Loading...'}
        />
      )}
      <span className={cn(isLoading && 'opacity-70')}>
        {isLoading && loadingText ? loadingText : children}
      </span>
    </>
  );
}

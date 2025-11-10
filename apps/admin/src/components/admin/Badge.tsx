import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary';
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  color,
  size = 'md',
  className
}: BadgeProps) {
  const getVariantClasses = (variant: string, color?: string) => {
    // If color is provided, use it instead of variant
    if (color) {
      switch (color) {
        case 'green':
          return 'bg-green-100 text-green-800 border-green-200';
        case 'yellow':
          return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'red':
          return 'bg-red-100 text-red-800 border-red-200';
        case 'blue':
          return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'purple':
          return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'gray':
          return 'bg-gray-100 text-gray-800 border-gray-200';
        default:
          return 'bg-blue-100 text-blue-800 border-blue-200';
      }
    }
    
    // Fallback to variant-based styling
    switch (variant) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'secondary':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return 'px-2 py-0.5 text-xs';
      case 'md':
        return 'px-2.5 py-0.5 text-sm';
      case 'lg':
        return 'px-3 py-1 text-base';
      default:
        return 'px-2.5 py-0.5 text-sm';
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        getVariantClasses(variant, color),
        getSizeClasses(size),
        className
      )}
    >
      {children}
    </span>
  );
}

export default Badge;


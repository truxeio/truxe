import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function Card({
  children,
  title,
  subtitle,
  actions,
  padding = 'md',
  shadow = 'md',
  className
}: CardProps) {
  const getPaddingClasses = (padding: string) => {
    switch (padding) {
      case 'none':
        return '';
      case 'sm':
        return 'p-4';
      case 'md':
        return 'p-6';
      case 'lg':
        return 'p-8';
      default:
        return 'p-6';
    }
  };

  const getShadowClasses = (shadow: string) => {
    switch (shadow) {
      case 'none':
        return '';
      case 'sm':
        return 'shadow-sm';
      case 'md':
        return 'shadow';
      case 'lg':
        return 'shadow-lg';
      default:
        return 'shadow';
    }
  };

  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-gray-200",
        getShadowClasses(shadow),
        className
      )}
    >
      {(title || subtitle || actions) && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              )}
              {subtitle && (
                <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center space-x-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className={cn(getPaddingClasses(padding))}>
        {children}
      </div>
    </div>
  );
}

export default Card;


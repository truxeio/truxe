import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  path: string;
  href?: string;
  isActive?: boolean;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate?: (path: string) => void;
  showHome?: boolean;
  homePath?: string;
  className?: string;
}

export function Breadcrumb({
  items,
  onNavigate,
  showHome = true,
  homePath = '/admin',
  className
}: BreadcrumbProps) {
  const handleItemClick = (item: BreadcrumbItem) => {
    if (!item.isActive && onNavigate) {
      onNavigate(item.path);
    }
  };

  const allItems = showHome 
    ? [{ label: 'Home', path: homePath, isActive: false }, ...items]
    : items;

  return (
    <nav className={cn("flex", className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {allItems.map((item, index) => (
          <li key={item.path} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
            )}
            
            {index === 0 && showHome && (
              <Home className="w-4 h-4 text-gray-400 mr-1" />
            )}
            
            {item.isActive ? (
              <span className="text-sm font-medium text-gray-900">
                {item.label}
              </span>
            ) : (
              <button
                onClick={() => handleItemClick(item)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumb;


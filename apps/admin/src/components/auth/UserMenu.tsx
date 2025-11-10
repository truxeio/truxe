import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAccessibility } from '../../hooks/useAccessibility';
import { Button } from '../ui/Button';
import { cn, getInitials } from '../../lib/utils';
import { ARIA_LABELS, KEYS } from '../../lib/constants';
import type { BaseComponentProps, User, DropdownItem } from '../../types';

export interface UserMenuProps extends BaseComponentProps {
  user?: User;
  showAvatar?: boolean;
  showEmail?: boolean;
  showRole?: boolean;
  customItems?: DropdownItem[];
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onLogout?: () => void;
  avatarSize?: 'sm' | 'md' | 'lg';
  placement?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

/**
 * Accessible user menu dropdown with customizable actions
 */
export function UserMenu({
  className,
  user: propUser,
  showAvatar = true,
  showEmail = true,
  showRole = true,
  customItems = [],
  onProfileClick,
  onSettingsClick,
  onLogout,
  avatarSize = 'md',
  placement = 'bottom-right',
  ...props
}: UserMenuProps) {
  const { user: contextUser, logout, organization, membership } = useAuth();
  const user = propUser || contextUser;
  const { announce } = useAccessibility();
  
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  if (!user) {
    return null;
  }

  // Default menu items
  const defaultItems: DropdownItem[] = [
    {
      id: 'profile',
      label: 'View Profile',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      onClick: onProfileClick,
    },
    {
      id: 'settings',
      label: 'Account Settings',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      onClick: onSettingsClick,
    },
    ...(organization ? [{
      id: 'organization',
      label: 'Organization',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      onClick: () => {/* Navigate to organization page */},
    }] : []),
    { id: 'separator-1', separator: true, label: '' },
    ...customItems,
    ...(customItems.length > 0 ? [{ id: 'separator-2', separator: true, label: '' }] : []),
    {
      id: 'logout',
      label: 'Sign Out',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
      danger: true,
      onClick: async () => {
        await logout();
        onLogout?.();
        announce('You have been signed out', 'polite');
      },
    },
  ];

  const allItems = defaultItems.filter(item => !item.separator);

  // Avatar size classes
  const avatarSizes = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  // Placement classes
  const placementClasses = {
    'bottom-left': 'top-full left-0 mt-2',
    'bottom-right': 'top-full right-0 mt-2',
    'top-left': 'bottom-full left-0 mb-2',
    'top-right': 'bottom-full right-0 mb-2',
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case KEYS.ESCAPE:
        event.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        triggerRef.current?.focus();
        break;
        
      case KEYS.ARROW_DOWN:
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
        } else {
          const nextIndex = focusedIndex < allItems.length - 1 ? focusedIndex + 1 : 0;
          setFocusedIndex(nextIndex);
          itemRefs.current[nextIndex]?.focus();
        }
        break;
        
      case KEYS.ARROW_UP:
        event.preventDefault();
        if (isOpen) {
          const prevIndex = focusedIndex > 0 ? focusedIndex - 1 : allItems.length - 1;
          setFocusedIndex(prevIndex);
          itemRefs.current[prevIndex]?.focus();
        }
        break;
        
      case KEYS.ENTER:
      case KEYS.SPACE:
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
        } else if (focusedIndex >= 0) {
          const item = allItems[focusedIndex];
          item.onClick?.();
          setIsOpen(false);
          setFocusedIndex(-1);
        }
        break;
    }
  };

  const handleItemClick = (item: DropdownItem) => {
    item.onClick?.();
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  return (
    <div className={cn('relative', className)} {...props}>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={ARIA_LABELS.USER_MENU}
        className="flex items-center space-x-2 rounded-full p-1"
      >
        {showAvatar && (
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-primary-600 font-medium text-white',
              avatarSizes[avatarSize]
            )}
            aria-hidden="true"
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              getInitials(user.name || user.email)
            )}
          </div>
        )}
        
        {(showEmail || showRole) && (
          <div className="hidden text-left sm:block">
            {showEmail && (
              <div className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                {user.name || user.email.split('@')[0]}
              </div>
            )}
            {showRole && membership && (
              <div className="text-xs text-secondary-600 dark:text-secondary-400 capitalize">
                {membership.role} {organization && `at ${organization.name}`}
              </div>
            )}
          </div>
        )}
        
        <svg
          className={cn(
            'h-4 w-4 text-secondary-500 transition-transform',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            'absolute z-50 w-64 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5',
            'dark:bg-secondary-800 dark:ring-secondary-700',
            placementClasses[placement]
          )}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu-button"
        >
          {/* User info header */}
          <div className="border-b border-secondary-200 px-4 py-3 dark:border-secondary-700">
            <div className="flex items-center space-x-3">
              <div
                className={cn(
                  'flex items-center justify-center rounded-full bg-primary-600 font-medium text-white',
                  avatarSizes.md
                )}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(user.name || user.email)
                )}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-secondary-900 dark:text-secondary-100">
                  {user.name || user.email}
                </div>
                <div className="truncate text-xs text-secondary-600 dark:text-secondary-400">
                  {user.email}
                </div>
                
                {user.emailVerified ? (
                  <span className="mt-1 inline-flex items-center rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-800 dark:bg-success-900/20 dark:text-success-400">
                    ✓ Verified
                  </span>
                ) : (
                  <span className="mt-1 inline-flex items-center rounded-full bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-800 dark:bg-warning-900/20 dark:text-warning-400">
                    ⚠ Unverified
                  </span>
                )}
                
                {membership && organization && (
                  <div className="mt-1 text-xs text-secondary-600 dark:text-secondary-400 capitalize">
                    {membership.role} at {organization.name}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {defaultItems.map((item, index) => {
              if (item.separator) {
                return (
                  <div
                    key={item.id}
                    className="my-1 border-t border-secondary-200 dark:border-secondary-700"
                    role="separator"
                  />
                );
              }

              const itemIndex = allItems.indexOf(item);
              
              return (
                <button
                  key={item.id}
                  ref={el => itemRefs.current[itemIndex] = el}
                  type="button"
                  className={cn(
                    'flex w-full items-center px-4 py-2 text-left text-sm transition-colors',
                    'hover:bg-secondary-100 focus:bg-secondary-100 focus:outline-none',
                    'dark:hover:bg-secondary-700 dark:focus:bg-secondary-700',
                    item.danger 
                      ? 'text-error-700 dark:text-error-400' 
                      : 'text-secondary-900 dark:text-secondary-100',
                    focusedIndex === itemIndex && 'bg-secondary-100 dark:bg-secondary-700'
                  )}
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => handleItemClick(item)}
                  onKeyDown={handleKeyDown}
                >
                  {item.icon && (
                    <span className="mr-3 flex-shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

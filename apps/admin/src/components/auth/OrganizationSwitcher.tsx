import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useAccessibility } from '../../hooks/useAccessibility';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { cn } from '../../lib/utils';
import { ARIA_LABELS, KEYS, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../../lib/constants';
import type { BaseComponentProps, OrganizationWithMembership } from '../../types';

export interface OrganizationSwitcherProps extends BaseComponentProps {
  onOrganizationSwitch?: (organization: OrganizationWithMembership) => void;
  onCreateOrganization?: () => void;
  showCreateButton?: boolean;
  placement?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  maxHeight?: string;
}

/**
 * Accessible organization switcher for multi-tenant applications
 */
export function OrganizationSwitcher({
  className,
  onOrganizationSwitch,
  onCreateOrganization,
  showCreateButton = true,
  placement = 'bottom-left',
  maxHeight = '320px',
  ...props
}: OrganizationSwitcherProps) {
  const { 
    organization, 
    membership, 
    switchOrganization, 
    getUserOrganizations 
  } = useAuth();
  const { success, error } = useToast();
  const { announce } = useAccessibility();
  
  const [isOpen, setIsOpen] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationWithMembership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Placement classes
  const placementClasses = {
    'bottom-left': 'top-full left-0 mt-2',
    'bottom-right': 'top-full right-0 mt-2',
    'top-left': 'bottom-full left-0 mb-2',
    'top-right': 'bottom-full right-0 mb-2',
  };

  // Load organizations when menu opens
  useEffect(() => {
    if (isOpen && organizations.length === 0) {
      loadOrganizations();
    }
  }, [isOpen]);

  const loadOrganizations = async () => {
    setIsLoading(true);
    try {
      const orgs = await getUserOrganizations();
      setOrganizations(orgs);
    } catch (err) {
      error('Failed to load organizations', ERROR_MESSAGES.GENERIC_ERROR);
    } finally {
      setIsLoading(false);
    }
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
    const focusableItems = organizations.length + (showCreateButton ? 1 : 0);
    
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
          const nextIndex = focusedIndex < focusableItems - 1 ? focusedIndex + 1 : 0;
          setFocusedIndex(nextIndex);
          itemRefs.current[nextIndex]?.focus();
        }
        break;
        
      case KEYS.ARROW_UP:
        event.preventDefault();
        if (isOpen) {
          const prevIndex = focusedIndex > 0 ? focusedIndex - 1 : focusableItems - 1;
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
        }
        break;
    }
  };

  const handleOrganizationSwitch = async (org: OrganizationWithMembership) => {
    if (org.id === organization?.id) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      const result = await switchOrganization(org.id);
      
      if (result.success) {
        success(SUCCESS_MESSAGES.ORGANIZATION_CREATED, `Switched to ${org.name}`);
        announce(`Switched to ${org.name}`, 'polite');
        onOrganizationSwitch?.(org);
      } else {
        error('Switch failed', result.message);
      }
    } catch (err) {
      error('Switch failed', ERROR_MESSAGES.GENERIC_ERROR);
    } finally {
      setIsSwitching(false);
      setIsOpen(false);
      setFocusedIndex(-1);
    }
  };

  const handleCreateOrganization = () => {
    setIsOpen(false);
    onCreateOrganization?.();
  };

  if (!organization) {
    return null;
  }

  return (
    <div className={cn('relative', className)} {...props}>
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={ARIA_LABELS.ORG_SWITCHER}
        disabled={isSwitching}
        className="flex items-center space-x-2 max-w-48"
      >
        <div className="flex items-center space-x-2 min-w-0">
          <div className="h-5 w-5 rounded bg-primary-600 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
            {organization.name.charAt(0).toUpperCase()}
          </div>
          <span className="truncate text-sm font-medium">
            {organization.name}
          </span>
        </div>
        
        {isSwitching ? (
          <LoadingSpinner size="xs" />
        ) : (
          <svg
            className={cn(
              'h-4 w-4 text-secondary-500 transition-transform flex-shrink-0',
              isOpen && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            'absolute z-50 w-80 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5',
            'dark:bg-secondary-800 dark:ring-secondary-700',
            placementClasses[placement]
          )}
          style={{ maxHeight }}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="organization-switcher-button"
        >
          {/* Header */}
          <div className="border-b border-secondary-200 px-4 py-3 dark:border-secondary-700">
            <h3 className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
              Switch Organization
            </h3>
            <p className="text-xs text-secondary-600 dark:text-secondary-400">
              Select an organization to switch to
            </p>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" label="Loading organizations..." />
            </div>
          )}

          {/* Organizations list */}
          {!isLoading && (
            <div className="max-h-60 overflow-y-auto py-1">
              {organizations.map((org, index) => {
                const isActive = org.id === organization?.id;
                
                return (
                  <button
                    key={org.id}
                    ref={el => itemRefs.current[index] = el}
                    type="button"
                    className={cn(
                      'flex w-full items-center px-4 py-3 text-left transition-colors',
                      'hover:bg-secondary-100 focus:bg-secondary-100 focus:outline-none',
                      'dark:hover:bg-secondary-700 dark:focus:bg-secondary-700',
                      isActive && 'bg-primary-50 dark:bg-primary-900/20',
                      focusedIndex === index && 'bg-secondary-100 dark:bg-secondary-700'
                    )}
                    role="menuitem"
                    onClick={() => handleOrganizationSwitch(org)}
                    onKeyDown={handleKeyDown}
                    aria-current={isActive ? 'true' : 'false'}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded bg-primary-600 flex items-center justify-center text-sm font-medium text-white flex-shrink-0">
                        {org.logo ? (
                          <img
                            src={org.logo}
                            alt=""
                            className="h-full w-full rounded object-cover"
                          />
                        ) : (
                          org.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <div className="truncate text-sm font-medium text-secondary-900 dark:text-secondary-100">
                            {org.name}
                          </div>
                          {isActive && (
                            <svg
                              className="h-4 w-4 text-primary-600 flex-shrink-0"
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
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-secondary-600 dark:text-secondary-400 capitalize">
                            {org.membership.role}
                          </span>
                          {org.membership.permissions.includes('admin') && (
                            <span className="inline-flex items-center rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-secondary-800 dark:bg-secondary-700 dark:text-secondary-200">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {organizations.length === 0 && !isLoading && (
                <div className="px-4 py-8 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-secondary-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
                    No organizations found
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Create organization button */}
          {showCreateButton && !isLoading && (
            <>
              <div className="border-t border-secondary-200 dark:border-secondary-700" role="separator" />
              <div className="py-1">
                <button
                  ref={el => itemRefs.current[organizations.length] = el}
                  type="button"
                  className={cn(
                    'flex w-full items-center px-4 py-2 text-left text-sm transition-colors',
                    'hover:bg-secondary-100 focus:bg-secondary-100 focus:outline-none',
                    'dark:hover:bg-secondary-700 dark:focus:bg-secondary-700',
                    'text-primary-700 dark:text-primary-400',
                    focusedIndex === organizations.length && 'bg-secondary-100 dark:bg-secondary-700'
                  )}
                  role="menuitem"
                  onClick={handleCreateOrganization}
                  onKeyDown={handleKeyDown}
                  aria-label={ARIA_LABELS.CREATE_ORG}
                >
                  <svg
                    className="mr-3 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Organization
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useOrganization } from '../../../hooks/useOrganization';
import type { AppearanceConfig } from '../../../types';
import { OrganizationAvatar } from '../OrganizationAvatar/OrganizationAvatar';
import { CreateOrganization } from '../CreateOrganization/CreateOrganization';

export interface OrganizationSwitcherProps {
  /** Show organization name next to icon */
  showName?: boolean;
  /** Hide "Create Organization" button in dropdown */
  hideCreateOrganization?: boolean;
  /** Custom redirect after organization switch */
  afterSwitchOrganizationUrl?: string;
  /** Appearance customization */
  appearance?: AppearanceConfig;
  /** Additional CSS classes */
  className?: string;
}

/**
 * OrganizationSwitcher - Dropdown menu to switch between organizations.
 * 
 * A comprehensive organization switcher component that provides:
 * - Display current organization with logo/icon
 * - Dropdown list of user's organizations
 * - Switch organization on click
 * - "Create Organization" button (opens CreateOrganization modal)
 * - Organization search (if > 5 orgs)
 * - Loading state during switch
 * - Empty state ("No organizations")
 * - Keyboard accessibility (Tab, Enter, Escape)
 * - Click outside to close
 * 
 * @example
 * ```tsx
 * // Simple usage
 * <OrganizationSwitcher />
 * 
 * // With organization name displayed
 * <OrganizationSwitcher showName />
 * 
 * // Hide create button
 * <OrganizationSwitcher hideCreateOrganization />
 * 
 * // Custom redirect after switch
 * <OrganizationSwitcher afterSwitchOrganizationUrl="/dashboard" />
 * ```
 */
export function OrganizationSwitcher({
  showName = true,
  hideCreateOrganization = false,
  afterSwitchOrganizationUrl,
  appearance, // Reserved for future use
  className = '',
}: OrganizationSwitcherProps) {
  const { isLoaded, organization, organizations, setActive } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Prevent unused variable warning
  void appearance;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleSwitch = async (orgId: string) => {
    if (orgId === organization?.id) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    
    try {
      await setActive(orgId);
      setIsOpen(false);

      if (afterSwitchOrganizationUrl) {
        window.location.href = afterSwitchOrganizationUrl;
      }
    } catch (error) {
      console.error('Failed to switch organization:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isLoaded) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-10 h-10 bg-gray-200 rounded animate-pulse" />
        {showName && <div className="w-24 h-5 bg-gray-200 rounded animate-pulse" />}
      </div>
    );
  }

  return (
    <>
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {organization ? (
            <>
              <OrganizationAvatar organization={organization} size="sm" />
              {showName && (
                <span className="font-medium text-gray-900 max-w-[150px] truncate">
                  {organization.name}
                </span>
              )}
              <svg 
                className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          ) : (
            <span className="text-gray-500">No Organization</span>
          )}
        </button>

        {isOpen && (
          <div className="absolute top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            {/* Search (if > 5 orgs) */}
            {organizations.length > 5 && (
              <div className="p-3 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            )}

            {/* Organization list */}
            <div className="max-h-64 overflow-y-auto">
              {filteredOrgs.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {searchQuery ? 'No organizations found' : 'No organizations available'}
                </div>
              ) : (
                filteredOrgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSwitch(org.id)}
                    className={`
                      w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left
                      ${org.id === organization?.id ? 'bg-blue-50' : ''}
                    `}
                    disabled={isLoading}
                  >
                    <OrganizationAvatar organization={org} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{org.name}</p>
                      <p className="text-sm text-gray-500 truncate">{org.slug}</p>
                    </div>
                    {org.id === organization?.id && (
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path 
                          fillRule="evenodd" 
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Create Organization button */}
            {!hideCreateOrganization && (
              <div className="p-2 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Organization</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateOrganization 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            // Organizations list will auto-update via hook
          }}
        />
      )}
    </>
  );
}

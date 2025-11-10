import { useState } from 'react';
import { useOrganization } from '../../../hooks/useOrganization';
import type { Organization } from '../../../types';
import { OrganizationAvatar } from '../OrganizationAvatar/OrganizationAvatar';
import { CreateOrganization } from '../CreateOrganization/CreateOrganization';
import { Button } from '../../ui/Button';

export interface OrganizationListProps {
  /** Show create button */
  hideCreate?: boolean;
  /** Card or list layout */
  layout?: 'card' | 'list';
  /** Click handler when organization selected */
  onOrganizationClick?: (orgId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * OrganizationList - Display list of user's organizations with management actions.
 * 
 * Provides a comprehensive view of all organizations with:
 * - Card and list layout variants
 * - Organization logo/icon
 * - Organization name and slug
 * - Member count (mocked for now)
 * - User's role badge
 * - "Create Organization" button
 * - Click to view details
 * - Loading state
 * - Empty state
 * - Responsive grid (card layout)
 * 
 * @example
 * ```tsx
 * // Card layout (default)
 * <OrganizationList layout="card" />
 * 
 * // List layout
 * <OrganizationList layout="list" />
 * 
 * // With click handler
 * <OrganizationList 
 *   onOrganizationClick={(id) => navigate(`/org/${id}`)}
 * />
 * 
 * // Hide create button
 * <OrganizationList hideCreate />
 * ```
 */
export function OrganizationList({
  hideCreate = false,
  layout = 'card',
  onOrganizationClick,
  className = '',
}: OrganizationListProps) {
  const { isLoaded, organizations } = useOrganization();
  const [showCreate, setShowCreate] = useState(false);

  if (!isLoaded) {
    return <LoadingState layout={layout} />;
  }

  if (organizations.length === 0) {
    return (
      <EmptyState
        hideCreate={hideCreate}
        onCreateClick={() => setShowCreate(true)}
      />
    );
  }

  return (
    <>
      <div className={className}>
        {!hideCreate && (
          <div className="mb-6 flex justify-end">
            <Button onClick={() => setShowCreate(true)} variant="primary">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Organization
            </Button>
          </div>
        )}

        {layout === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => (
              <OrganizationCard
                key={org.id}
                organization={org}
                onClick={() => onOrganizationClick?.(org.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {organizations.map((org) => (
              <OrganizationListItem
                key={org.id}
                organization={org}
                onClick={() => onOrganizationClick?.(org.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateOrganization onClose={() => setShowCreate(false)} />
      )}
    </>
  );
}

// Card component for grid layout
function OrganizationCard({
  organization,
  onClick,
}: {
  organization: Organization;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        p-6 bg-white border border-gray-200 rounded-lg shadow-sm
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300 transition-all' : ''}
      `}
    >
      <div className="flex items-start gap-4">
        <OrganizationAvatar organization={organization} size="lg" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{organization.name}</h3>
          <p className="text-sm text-gray-500 truncate">{organization.slug}</p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>3 members</span>
        </div>
        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
          Admin
        </span>
      </div>
    </div>
  );
}

// List item component for list layout
function OrganizationListItem({
  organization,
  onClick,
}: {
  organization: Organization;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        p-4 bg-white border border-gray-200 rounded-lg flex items-center justify-between
        ${onClick ? 'cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-all' : ''}
      `}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <OrganizationAvatar organization={organization} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{organization.name}</h3>
          <p className="text-sm text-gray-500 truncate">{organization.slug}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>3 members</span>
        </div>
        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
          Admin
        </span>
      </div>
    </div>
  );
}

// Loading state component
function LoadingState({ layout }: { layout: 'card' | 'list' }) {
  const skeletonCount = 6;
  
  if (layout === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="p-6 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div key={i} className="p-4 bg-white border border-gray-200 rounded-lg flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-200 rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty state component
function EmptyState({
  hideCreate,
  onCreateClick,
}: {
  hideCreate: boolean;
  onCreateClick: () => void;
}) {
  return (
    <div className="text-center py-12">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
      <h3 className="mt-2 text-sm font-semibold text-gray-900">No organizations</h3>
      <p className="mt-1 text-sm text-gray-500">
        Get started by creating your first organization.
      </p>
      {!hideCreate && (
        <div className="mt-6">
          <Button onClick={onCreateClick} variant="primary">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Organization
          </Button>
        </div>
      )}
    </div>
  );
}

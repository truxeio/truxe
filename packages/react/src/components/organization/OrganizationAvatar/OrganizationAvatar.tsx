import { useState } from 'react';
import type { Organization } from '../../../types';

export interface OrganizationAvatarProps {
  /** Organization object to display avatar for */
  organization?: Organization;
  /** Size variant of the avatar */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Shape of the avatar */
  shape?: 'circle' | 'square';
  /** Fallback type when no image is available */
  fallback?: 'initials' | 'icon';
  /** Direct image URL to display (overrides organization.imageUrl) */
  imageUrl?: string;
  /** Additional CSS classes */
  className?: string;
  /** Click handler for interactive avatars */
  onClick?: () => void;
  /** Show loading skeleton */
  isLoading?: boolean;
}

/**
 * OrganizationAvatar - Display organization logos with intelligent fallbacks.
 * 
 * Displays organization avatar with:
 * - Image from organization.imageUrl or imageUrl prop
 * - Fallback to organization initials (first 2 letters of name)
 * - Fallback to generic building icon if no name
 * - Support for 4 size variants and 2 shape variants
 * - Error handling for broken images
 * - Accessible with proper ARIA labels
 * 
 * @example
 * ```tsx
 * // With organization object
 * <OrganizationAvatar organization={org} size="md" />
 * 
 * // With direct image URL
 * <OrganizationAvatar imageUrl="https://..." size="lg" shape="square" />
 * 
 * // Icon fallback
 * <OrganizationAvatar fallback="icon" />
 * 
 * // Interactive avatar
 * <OrganizationAvatar organization={org} onClick={() => console.log('clicked')} />
 * ```
 */
export function OrganizationAvatar({ 
  organization,
  size = 'md', 
  shape = 'square',
  fallback = 'initials',
  imageUrl,
  className = '',
  onClick,
  isLoading = false,
}: OrganizationAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Size classes (w-8 = 32px, w-10 = 40px, w-12 = 48px, w-16 = 64px)
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  // Shape classes
  const shapeClasses = {
    circle: 'rounded-full',
    square: 'rounded-md',
  };

  // Get image source
  const imgSrc = imageUrl || organization?.imageUrl;
  
  // Get organization initials
  const getInitials = (org: Organization): string => {
    const name = org.name || '';
    
    if (name.length === 0) return '?';
    
    // Split by spaces and take first letter of first two words
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    
    // If single word, take first two letters
    if (name.length >= 2) {
      return name.substring(0, 2).toUpperCase();
    }
    
    return name[0].toUpperCase();
  };

  const initials = organization ? getInitials(organization) : null;

  // Determine what to show
  const showImage = imgSrc && !imageError;
  const showInitials = !showImage && initials && fallback === 'initials';
  const showIcon = !showImage && !showInitials;

  // Get ARIA label
  const ariaLabel = organization 
    ? `${organization.name}'s logo`
    : 'Organization logo';

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className={`
          ${sizeClasses[size]}
          ${shapeClasses[shape]}
          bg-gray-200 animate-pulse
          ${className}
        `}
        aria-label="Loading organization logo"
      />
    );
  }

  return (
    <div
      className={`
        relative flex items-center justify-center
        ${sizeClasses[size]}
        ${shapeClasses[shape]}
        ${showImage ? '' : 'bg-purple-600'}
        ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
        overflow-hidden
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {showImage && (
        <img
          src={imgSrc}
          alt={organization?.name || 'Organization'}
          className={`w-full h-full object-cover ${shapeClasses[shape]}`}
          onError={() => setImageError(true)}
        />
      )}

      {showInitials && (
        <span className="font-semibold text-white select-none">
          {initials}
        </span>
      )}

      {showIcon && (
        <svg 
          className="w-1/2 h-1/2 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      )}
    </div>
  );
}

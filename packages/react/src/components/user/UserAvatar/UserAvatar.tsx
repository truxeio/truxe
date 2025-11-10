import { useState } from 'react';
import type { User } from '../../../types';

export interface UserAvatarProps {
  /** User object to display avatar for. If not provided, will attempt to use context user */
  user?: User;
  /** Size variant of the avatar */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Shape of the avatar */
  shape?: 'circle' | 'square';
  /** Fallback type when no image is available */
  fallback?: 'initials' | 'icon';
  /** Direct image URL to display (overrides user.imageUrl) */
  imageUrl?: string;
  /** Additional CSS classes */
  className?: string;
  /** Click handler for interactive avatars */
  onClick?: () => void;
  /** Show loading skeleton */
  isLoading?: boolean;
}

/**
 * UserAvatar - Display user profile pictures with intelligent fallbacks.
 * 
 * Displays user avatar with:
 * - Image from user.imageUrl or imageUrl prop
 * - Fallback to user initials (first letter of first + last name)
 * - Fallback to generic user icon if no name
 * - Support for 4 size variants and 2 shape variants
 * - Error handling for broken images
 * - Accessible with proper ARIA labels
 * 
 * @example
 * ```tsx
 * // With user object
 * <UserAvatar user={user} size="md" />
 * 
 * // With direct image URL
 * <UserAvatar imageUrl="https://..." size="lg" shape="square" />
 * 
 * // Icon fallback
 * <UserAvatar fallback="icon" />
 * 
 * // Interactive avatar
 * <UserAvatar user={user} onClick={() => console.log('clicked')} />
 * ```
 */
export function UserAvatar({ 
  user,
  size = 'md', 
  shape = 'circle',
  fallback = 'initials',
  imageUrl,
  className = '',
  onClick,
  isLoading = false,
}: UserAvatarProps) {
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
  const imgSrc = imageUrl || user?.imageUrl;
  
  // Get user initials
  const getInitials = (userData: User): string => {
    const firstName = userData.firstName || '';
    const lastName = userData.lastName || '';
    
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    
    if (userData.fullName) {
      const names = userData.fullName.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return userData.fullName[0].toUpperCase();
    }
    
    return userData.email[0].toUpperCase();
  };

  const initials = user ? getInitials(user) : null;

  // Determine what to show
  const showImage = imgSrc && !imageError;
  const showInitials = !showImage && initials && fallback === 'initials';
  const showIcon = !showImage && !showInitials;

  // Get ARIA label
  const ariaLabel = user 
    ? `${user.fullName || user.firstName || user.email}'s avatar`
    : 'User avatar';

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
        aria-label="Loading avatar"
      />
    );
  }

  return (
    <div
      className={`
        relative flex items-center justify-center
        ${sizeClasses[size]}
        ${shapeClasses[shape]}
        ${showImage ? '' : 'bg-blue-600'}
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
          alt={user?.fullName || user?.firstName || user?.email || 'User'}
          className={`w-full h-full object-cover ${shapeClasses[shape]}`}
          onError={() => setImageError(true)}
        />
      )}

      {showInitials && (
        <span className="font-medium text-white select-none">
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
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      )}
    </div>
  );
}

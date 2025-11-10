import { useState, useRef, useEffect } from 'react';
import { useUser } from '../../../hooks/useUser';
import { useAuth } from '../../../hooks/useAuth';
import type { UserButtonProps } from '../../../types';
import { UserProfile } from '../UserProfile/UserProfile';
import { Modal } from '../../ui/Modal';
import { UserAvatar } from '../UserAvatar/UserAvatar';

/**
 * UserButton - Dropdown menu for user actions.
 * 
 * A comprehensive user menu component that provides:
 * - User avatar with name display
 * - Dropdown menu with user info and actions
 * - "Manage Account" action that opens UserProfile
 * - "Sign Out" action
 * - Keyboard accessibility (Tab, Enter, Escape)
 * - Click outside to close
 * 
 * @example
 * ```tsx
 * // Simple usage
 * <UserButton />
 * 
 * // With user name displayed
 * <UserButton showName />
 * 
 * // Custom sign-out redirect
 * <UserButton afterSignOutUrl="/login" />
 * 
 * // Navigate to profile page instead of modal
 * <UserButton userProfileMode="navigation" />
 * ```
 */
export function UserButton({ 
  showName = false, 
  userProfileMode = 'modal',
  afterSignOutUrl = '/',
  appearance, // Reserved for future use
}: UserButtonProps) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Prevent unused variable warning (reserved for future styling customization)
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

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!user) return null;

  const getDisplayName = () => {
    if (user.firstName) return user.firstName;
    if (user.fullName) return user.fullName.split(' ')[0];
    return user.email.split('@')[0];
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    if (afterSignOutUrl) {
      window.location.href = afterSignOutUrl;
    }
  };

  const handleManageAccount = () => {
    setIsOpen(false);
    if (userProfileMode === 'modal') {
      setShowProfile(true);
    } else {
      // For navigation mode, you could use react-router or Next.js router
      // For now, we'll just open the modal as a fallback
      setShowProfile(true);
    }
  };

  return (
    <>
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        {/* User Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '9999px',
            padding: '4px 8px 4px 4px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label="User menu"
        >
          {/* Avatar using UserAvatar component */}
          <UserAvatar user={user} size="md" />

          {/* Name (optional) */}
          {showName && (
            <span style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
            }}>
              {getDisplayName()}
            </span>
          )}

          {/* Dropdown Arrow */}
          <svg
            style={{
              height: '16px',
              width: '16px',
              color: '#9ca3af',
              transition: 'transform 0.2s',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div style={{
            position: 'absolute',
            right: 0,
            marginTop: '8px',
            width: '256px',
            borderRadius: '8px',
            backgroundColor: 'white',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e5e7eb',
            zIndex: 50,
            overflow: 'hidden',
          }}>
            {/* User info header */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #e5e7eb',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <UserAvatar user={user} size="lg" />
                <div style={{
                  flex: 1,
                  minWidth: 0,
                }}>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#111827',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {user.fullName || getDisplayName()}
                  </p>
                  <p style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{user.email}</p>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div style={{ padding: '8px' }}>
              <button
                onClick={handleManageAccount}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  padding: '10px 12px',
                  fontSize: '14px',
                  color: '#374151',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <svg 
                  style={{ marginRight: '12px', height: '18px', width: '18px', color: '#6b7280' }} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
                  />
                </svg>
                Manage account
              </button>

              <div style={{
                height: '1px',
                backgroundColor: '#e5e7eb',
                margin: '8px 0',
              }} />

              <button
                onClick={handleSignOut}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  padding: '10px 12px',
                  fontSize: '14px',
                  color: '#dc2626',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <svg 
                  style={{ marginRight: '12px', height: '18px', width: '18px', color: '#ef4444' }} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
                  />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      {showProfile && (
        <Modal
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
          size="lg"
        >
          <UserProfile mode="modal" onClose={() => setShowProfile(false)} />
        </Modal>
      )}
    </>
  );
}

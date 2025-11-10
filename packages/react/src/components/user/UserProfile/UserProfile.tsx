import { useState } from 'react';
import { useUser } from '../../../hooks/useUser';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { UserAvatar } from '../UserAvatar/UserAvatar';

export interface UserProfileProps {
  /** Display mode: modal or inline */
  mode?: 'modal' | 'inline';
  /** Callback when modal is closed (only used in modal mode) */
  onClose?: () => void;
  /** Appearance customization (future use) */
  appearance?: any;
}

type TabType = 'profile' | 'security' | 'sessions';

/**
 * UserProfile - Full user profile display and editing component.
 * 
 * Provides a comprehensive profile management interface with:
 * - Modal or inline display modes
 * - Tabbed interface: Profile, Security, Sessions
 * - Profile editing with validation
 * - Email verification status
 * - MFA status display
 * - Active sessions management
 * 
 * @example
 * ```tsx
 * // Modal mode
 * <UserProfile mode="modal" onClose={() => setShow(false)} />
 * 
 * // Inline mode
 * <UserProfile mode="inline" />
 * ```
 */
export function UserProfile({
  mode = 'inline',
  onClose,
  appearance, // Reserved for future use
}: UserProfileProps) {
  const { user, update } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Prevent unused variable warning (reserved for future styling customization)
  void appearance;

  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
  });

  if (!user) {
    return <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</div>;
  }

  const handleSave = async () => {
    setError('');
    setSuccess(false);
    setIsSaving(true);

    try {
      await update({
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
      setSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
    });
    setIsEditing(false);
    setError('');
  };

  const content = (
    <div style={{ width: '100%', maxWidth: mode === 'modal' ? '100%' : '800px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '16px',
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '0',
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
          Account
        </h2>
        {mode === 'modal' && onClose && (
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              borderRadius: '4px',
            }}
            aria-label="Close"
            onMouseOver={(e) => (e.currentTarget.style.color = '#374151')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#6b7280')}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e5e7eb',
        gap: '0',
      }}>
        <TabButton
          active={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </TabButton>
        <TabButton
          active={activeTab === 'security'}
          onClick={() => setActiveTab('security')}
        >
          Security
        </TabButton>
        <TabButton
          active={activeTab === 'sessions'}
          onClick={() => setActiveTab('sessions')}
        >
          Sessions
        </TabButton>
      </div>

      {/* Tab Content */}
      <div style={{ padding: '24px 0' }}>
        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            formData={formData}
            setFormData={setFormData}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={handleCancel}
            error={error}
            success={success}
          />
        )}

        {activeTab === 'security' && (
          <SecurityTab user={user} />
        )}

        {activeTab === 'sessions' && (
          <SessionsTab />
        )}
      </div>
    </div>
  );

  return content;
}

// Tab Button Component
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: 500,
        color: active ? '#2563eb' : '#6b7280',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseOver={(e) => {
        if (!active) e.currentTarget.style.color = '#374151';
      }}
      onMouseOut={(e) => {
        if (!active) e.currentTarget.style.color = '#6b7280';
      }}
      role="tab"
      aria-selected={active}
    >
      {children}
    </button>
  );
}

// Profile Tab Component
interface ProfileTabProps {
  user: any;
  formData: { firstName: string; lastName: string };
  setFormData: (data: { firstName: string; lastName: string }) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  error: string;
  success: boolean;
}

function ProfileTab({
  user,
  formData,
  setFormData,
  isEditing,
  setIsEditing,
  isSaving,
  onSave,
  onCancel,
  error,
  success,
}: ProfileTabProps) {
  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Avatar Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        paddingBottom: '24px',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <UserAvatar user={user} size="xl" />
        <div>
          <Button variant="outline" size="sm">
            Change photo
          </Button>
          <p style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#6b7280',
          }}>
            JPG, GIF or PNG. Max size 2MB.
          </p>
        </div>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input
            label="First name"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            disabled={!isEditing}
            fullWidth
          />
          <Input
            label="Last name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            disabled={!isEditing}
            fullWidth
          />
        </div>

        <Input
          label="Email address"
          type="email"
          value={user.email}
          disabled={true}
          helperText="Email cannot be changed"
        />

        {/* Account Info */}
        <div style={{
          borderRadius: '6px',
          backgroundColor: '#f9fafb',
          padding: '16px',
          marginTop: '8px',
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <svg
              style={{ width: '20px', height: '20px', color: '#6b7280', flexShrink: 0 }}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
                <strong>Account created:</strong> {new Date(user.createdAt).toLocaleDateString()}
              </p>
              <p style={{ fontSize: '14px', color: '#374151' }}>
                <strong>Email verified:</strong>{' '}
                <span style={{ color: user.emailVerified ? '#059669' : '#dc2626' }}>
                  {user.emailVerified ? 'Yes ✓' : 'No ✗'}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          marginTop: '16px',
          borderRadius: '6px',
          backgroundColor: '#fef2f2',
          padding: '12px',
          fontSize: '14px',
          color: '#991b1b',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          marginTop: '16px',
          borderRadius: '6px',
          backgroundColor: '#f0fdf4',
          padding: '12px',
          fontSize: '14px',
          color: '#166534',
        }}>
          Profile updated successfully!
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        marginTop: '24px',
        paddingTop: '24px',
        borderTop: '1px solid #e5e7eb',
      }}>
        {isEditing ? (
          <>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onSave}
              isLoading={isSaving}
            >
              Save changes
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => setIsEditing(true)}>
            Edit profile
          </Button>
        )}
      </div>
    </div>
  );
}

// Security Tab Component
function SecurityTab({ user }: { user: any }) {
  return (
    <div style={{ maxWidth: '600px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>
        Security Settings
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Email Verification */}
        <div style={{
          padding: '16px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: '#111827' }}>
                Email Verification
              </h4>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                {user.emailVerified ? 'Your email is verified' : 'Your email is not verified'}
              </p>
            </div>
            <div style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: user.emailVerified ? '#d1fae5' : '#fee2e2',
              color: user.emailVerified ? '#065f46' : '#991b1b',
            }}>
              {user.emailVerified ? 'Verified' : 'Not Verified'}
            </div>
          </div>
        </div>

        {/* MFA Status */}
        <div style={{
          padding: '16px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: '#111827' }}>
                Multi-Factor Authentication
              </h4>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                Add an extra layer of security to your account
              </p>
              <Button variant="outline" size="sm">
                Enable MFA
              </Button>
            </div>
            <div style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: '#f3f4f6',
              color: '#374151',
            }}>
              Disabled
            </div>
          </div>
        </div>

        {/* Connected Accounts */}
        <div style={{
          padding: '16px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: '#111827' }}>
            Connected Accounts
          </h4>
          <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
            Manage OAuth providers connected to your account
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #e5e7eb',
                }}>
                  <span style={{ fontSize: '18px' }}>🔗</span>
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                    OAuth Providers
                  </p>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>
                    No providers connected
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Connect
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sessions Tab Component
function SessionsTab() {
  const mockSessions = [
    {
      id: '1',
      device: 'Chrome on macOS',
      location: 'San Francisco, CA',
      lastActive: new Date(),
      isCurrent: true,
    },
    {
      id: '2',
      device: 'Safari on iPhone',
      location: 'San Francisco, CA',
      lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000),
      isCurrent: false,
    },
  ];

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#111827' }}>
        Active Sessions
      </h3>
      <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
        Manage your active sessions across different devices
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {mockSessions.map((session) => (
          <div
            key={session.id}
            style={{
              padding: '16px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: session.isCurrent ? '#eff6ff' : 'white',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0 }}>
                    {session.device}
                  </h4>
                  {session.isCurrent && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 500,
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                    }}>
                      Current
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                  📍 {session.location}
                </p>
                <p style={{ fontSize: '13px', color: '#6b7280' }}>
                  Last active: {session.lastActive.toLocaleTimeString()}
                </p>
              </div>
              {!session.isCurrent && (
                <Button variant="outline" size="sm">
                  Revoke
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        border: '1px solid #fcd34d',
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 500, color: '#78350f', marginBottom: '4px' }}>
              Revoke All Other Sessions
            </p>
            <p style={{ fontSize: '13px', color: '#92400e', marginBottom: '12px' }}>
              This will sign you out of all other devices and browsers
            </p>
            <Button variant="danger" size="sm">
              Revoke All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

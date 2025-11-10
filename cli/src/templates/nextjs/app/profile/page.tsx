'use client';

import { useState } from 'react';
import { withAuth } from '@truxe/nextjs';
import { LoadingSpinner, Button } from '@truxe/ui';
import { useAuth } from '@truxe/react';

interface ProfileProps {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    createdAt: string;
    updatedAt?: string;
    org?: {
      id: string;
      name: string;
      slug: string;
      role: string;
      permissions?: string[];
    };
  };
}

function ProfilePage({ user }: ProfileProps) {
  const { logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const handleResendVerification = async () => {
    if (user.emailVerified) return;
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_HEIMDALL_URL || 'http://localhost:3001'}/auth/resend-verification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ email: user.email }),
        }
      );

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Verification email sent! Check your inbox.',
        });
      } else {
        const errorData = await response.json();
        setMessage({
          type: 'error',
          text: errorData.message || 'Failed to send verification email.',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Network error. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_HEIMDALL_URL || 'http://localhost:3001'}/auth/sessions`,
        {
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_HEIMDALL_URL || 'http://localhost:3001'}/auth/revoke`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ sessionId }),
        }
      );

      if (response.ok) {
        await loadSessions(); // Refresh sessions
        setMessage({
          type: 'success',
          text: 'Session revoked successfully.',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to revoke session.',
      });
    }
  };

  const revokeAllSessions = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_HEIMDALL_URL || 'http://localhost:3001'}/auth/revoke`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ revokeAll: true }),
        }
      );

      if (response.ok) {
        logout(); // This will redirect to login
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to revoke all sessions.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
            <Button
              variant="secondary"
              onClick={() => window.history.back()}
              className="text-sm"
            >
              ← Back
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Alert Messages */}
          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Profile Information */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Account Information
                </h3>
                
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email Address</dt>
                    <dd className="mt-1 flex items-center">
                      <span className="text-sm text-gray-900">{user.email}</span>
                      {user.emailVerified ? (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Verified
                        </span>
                      ) : (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          ⚠ Unverified
                        </span>
                      )}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Member Since</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </dd>
                  </div>
                  
                  {user.org && (
                    <>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Organization</dt>
                        <dd className="mt-1 text-sm text-gray-900">{user.org.name}</dd>
                      </div>
                      
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Role</dt>
                        <dd className="mt-1 text-sm text-gray-900 capitalize">{user.org.role}</dd>
                      </div>
                    </>
                  )}
                </dl>

                {!user.emailVerified && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <Button
                      onClick={handleResendVerification}
                      disabled={isLoading}
                      className="w-full sm:w-auto"
                    >
                      {isLoading ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Sending...
                        </>
                      ) : (
                        'Resend Verification Email'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Security Settings */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Security & Sessions
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <Button
                      variant="secondary"
                      onClick={loadSessions}
                      disabled={loadingSessions}
                      className="w-full sm:w-auto"
                    >
                      {loadingSessions ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Loading...
                        </>
                      ) : (
                        'View Active Sessions'
                      )}
                    </Button>
                  </div>

                  {sessions.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Active Sessions</h4>
                      <div className="space-y-2">
                        {sessions.map((session: any) => (
                          <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">
                                {session.deviceInfo?.browser || 'Unknown Browser'} on {session.deviceInfo?.os || 'Unknown OS'}
                              </p>
                              <p className="text-xs text-gray-500">
                                Last active: {new Date(session.lastActiveAt).toLocaleDateString()}
                              </p>
                            </div>
                            {!session.isCurrent && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => revokeSession(session.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200">
                    <Button
                      variant="destructive"
                      onClick={revokeAllSessions}
                      className="w-full sm:w-auto"
                    >
                      Sign Out All Devices
                    </Button>
                    <p className="mt-2 text-xs text-gray-500">
                      This will sign you out of all devices and require you to log in again.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(ProfilePage);

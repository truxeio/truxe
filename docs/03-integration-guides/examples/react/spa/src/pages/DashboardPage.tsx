/**
 * Dashboard Page
 *
 * Protected page showing user profile
 * Only accessible when authenticated
 */

import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await logout();
      // Auth provider will automatically redirect to login
    } catch (error) {
      console.error('Logout error:', error);
      setLoading(false);
    }
  }

  if (!user) {
    return <div>Loading user data...</div>;
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '40px auto',
      padding: '20px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <h1>Dashboard</h1>
        <button
          onClick={handleLogout}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Logging out...' : 'Logout'}
        </button>
      </div>

      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '30px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          {user.picture && (
            <img
              src={user.picture}
              alt="Profile"
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                marginRight: '20px',
                border: '3px solid #007bff'
              }}
            />
          )}
          <div>
            <h2 style={{ margin: '0 0 10px 0' }}>
              {user.name || 'User'}
            </h2>
            <p style={{ margin: 0, color: '#666' }}>
              {user.email}
              {user.email_verified && (
                <span style={{
                  marginLeft: '10px',
                  color: '#28a745',
                  fontWeight: 'bold'
                }}>
                  ✓ Verified
                </span>
              )}
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginTop: '20px'
        }}>
          <InfoCard label="User ID" value={user.sub} />
          <InfoCard label="Email" value={user.email} />
          {user.given_name && (
            <InfoCard label="First Name" value={user.given_name} />
          )}
          {user.family_name && (
            <InfoCard label="Last Name" value={user.family_name} />
          )}
        </div>
      </div>

      <div style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #ddd'
      }}>
        <h3 style={{ marginTop: 0 }}>Full User Object</h3>
        <pre style={{
          backgroundColor: '#f8f9fa',
          padding: '15px',
          borderRadius: '6px',
          overflow: 'auto',
          fontSize: '13px'
        }}>
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>

      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#e7f3ff',
        borderRadius: '8px',
        borderLeft: '4px solid #007bff'
      }}>
        <h3 style={{ marginTop: 0 }}>🎉 Authentication Successful!</h3>
        <p style={{ marginBottom: 0 }}>
          You've successfully authenticated with Truxe using OAuth 2.0 with PKCE.
          Your tokens are securely stored in memory and will automatically refresh when needed.
        </p>
      </div>
    </div>
  );
}

interface InfoCardProps {
  label: string;
  value: string;
}

function InfoCard({ label, value }: InfoCardProps) {
  return (
    <div style={{
      padding: '15px',
      backgroundColor: 'white',
      borderRadius: '6px',
      border: '1px solid #dee2e6'
    }}>
      <div style={{
        fontSize: '12px',
        color: '#666',
        marginBottom: '5px',
        textTransform: 'uppercase',
        fontWeight: 'bold'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '14px',
        fontWeight: '500',
        wordBreak: 'break-all'
      }}>
        {value}
      </div>
    </div>
  );
}
/**
 * OAuth Callback Page
 *
 * Handles OAuth callback from Truxe
 * Exchanges code for tokens and redirects to dashboard
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOAuthClient } from '../lib/oauth-client';
import { useAuth } from '../hooks/useAuth';

export function CallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      const oauthClient = getOAuthClient();

      // Handle OAuth callback and get user info
      await oauthClient.handleCallback();

      // Refresh auth state
      await refreshUser();

      // Redirect to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('OAuth callback error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  }

  if (error) {
    return (
      <div style={{
        maxWidth: '500px',
        margin: '100px auto',
        padding: '40px',
        textAlign: 'center',
        border: '1px solid #f5c6cb',
        borderRadius: '8px',
        backgroundColor: '#f8d7da',
        color: '#721c24'
      }}>
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <button
          onClick={() => navigate('/login')}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column'
    }}>
      <div style={{
        fontSize: '18px',
        marginBottom: '20px'
      }}>
        Completing authentication...
      </div>
      <div style={{
        width: '50px',
        height: '50px',
        border: '3px solid #f3f3f3',
        borderTop: '3px solid #007bff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
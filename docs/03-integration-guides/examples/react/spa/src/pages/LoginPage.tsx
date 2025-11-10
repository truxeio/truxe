/**
 * Login Page
 *
 * Public page with "Sign in with Heimdall" button
 */

import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div style={{
      maxWidth: '400px',
      margin: '100px auto',
      padding: '40px',
      textAlign: 'center',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h1>Welcome to Heimdall OAuth Demo</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Sign in with your Heimdall account to continue
      </p>

      <button
        onClick={login}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          width: '100%',
          fontWeight: 'bold'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
      >
        Sign in with Heimdall
      </button>

      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px',
        textAlign: 'left',
        fontSize: '14px'
      }}>
        <h3 style={{ marginTop: 0 }}>Features:</h3>
        <ul style={{ paddingLeft: '20px' }}>
          <li>OAuth 2.0 Authorization Code Flow</li>
          <li>PKCE for enhanced security</li>
          <li>Automatic token refresh</li>
          <li>In-memory token storage</li>
          <li>Protected routes</li>
        </ul>
      </div>
    </div>
  );
}
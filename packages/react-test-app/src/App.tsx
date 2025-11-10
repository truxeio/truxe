import { useState } from 'react';
import {
  TruxeProvider,
  useAuth,
  SignInButton,
  SignUpButton,
  SignOutButton,
  UserButton,
  UserProfile,
  SignIn,
  SignUp,
} from '@truxe/react';

// Test publishable key
const HEIMDALL_PUBLISHABLE_KEY = 'test-publishable-key';
const HEIMDALL_API_URL = 'http://localhost:3001';

function TestDashboard() {
  const { isLoaded, isSignedIn, user, session } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (message: string) => {
    setTestResults((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  if (!isLoaded) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading Truxe...</h2>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '30px' }}>Truxe React Test App</h1>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '40px',
          marginBottom: '40px'
        }}>
          {/* Sign In Section */}
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginBottom: '20px' }}>Test Sign In</h2>
            <SignIn
              onSuccess={() => {
                addTestResult('✅ Sign In successful!');
              }}
            />
          </div>

          {/* Sign Up Section */}
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginBottom: '20px' }}>Test Sign Up</h2>
            <SignUp
              onSuccess={() => {
                addTestResult('✅ Sign Up successful!');
              }}
            />
          </div>
        </div>

        {/* Button Components Test */}
        <div style={{
          background: 'white',
          padding: '30px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '40px'
        }}>
          <h2 style={{ marginBottom: '20px' }}>Test Button Components</h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <SignInButton mode="modal">
              <span style={{
                padding: '10px 20px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-block'
              }}>
                Sign In (Modal)
              </span>
            </SignInButton>

            <SignUpButton mode="modal">
              <span style={{
                padding: '10px 20px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-block'
              }}>
                Sign Up (Modal)
              </span>
            </SignUpButton>
          </div>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginBottom: '10px' }}>Test Results:</h3>
            <div style={{
              background: '#f9fafb',
              padding: '15px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '14px'
            }}>
              {testResults.map((result, idx) => (
                <div key={idx} style={{ marginBottom: '5px' }}>{result}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Signed in state
  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1>Truxe React Test App</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <UserButton showName={true} />
          <SignOutButton>
            <button style={{
              padding: '8px 16px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}>
              Sign Out
            </button>
          </SignOutButton>
        </div>
      </div>

      {/* User Info Card */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h2 style={{ marginBottom: '20px' }}>User Information</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '15px' }}>
          <strong>User ID:</strong>
          <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>{user?.id}</span>

          <strong>Email:</strong>
          <span>{user?.email}</span>

          <strong>Email Verified:</strong>
          <span>{user?.emailVerified ? '✅ Yes' : '❌ No'}</span>

          <strong>Full Name:</strong>
          <span>{user?.fullName || 'Not set'}</span>

          <strong>First Name:</strong>
          <span>{user?.firstName || 'Not set'}</span>

          <strong>Last Name:</strong>
          <span>{user?.lastName || 'Not set'}</span>

          <strong>Created:</strong>
          <span>{user?.createdAt ? new Date(user.createdAt).toLocaleString() : 'Unknown'}</span>
        </div>
      </div>

      {/* Session Info Card */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h2 style={{ marginBottom: '20px' }}>Session Information</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '15px' }}>
          <strong>Session ID:</strong>
          <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>{session?.id}</span>

          <strong>Status:</strong>
          <span style={{
            color: session?.status === 'active' ? '#10b981' : '#ef4444',
            fontWeight: 'bold'
          }}>
            {session?.status?.toUpperCase()}
          </span>

          <strong>Expires At:</strong>
          <span>{session?.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'Unknown'}</span>

          <strong>Last Active:</strong>
          <span>{session?.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString() : 'Unknown'}</span>
        </div>
      </div>

      {/* User Profile Test */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h2 style={{ marginBottom: '20px' }}>User Profile Component Test</h2>
        <button
          onClick={() => setShowProfile(!showProfile)}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          {showProfile ? 'Hide Profile' : 'Show Profile'}
        </button>

        {showProfile && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
            <UserProfile />
          </div>
        )}
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div style={{
          background: 'white',
          padding: '30px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginBottom: '15px' }}>Test Event Log:</h3>
          <div style={{
            background: '#f9fafb',
            padding: '15px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '14px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {testResults.map((result, idx) => (
              <div key={idx} style={{ marginBottom: '5px' }}>{result}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <TruxeProvider
      publishableKey={HEIMDALL_PUBLISHABLE_KEY}
      apiUrl={HEIMDALL_API_URL}
      onTokenRefresh={(tokens) => {
        console.log('✅ Token refreshed:', tokens);
      }}
      onAuthChange={(state) => {
        console.log('🔄 Auth state changed:', state);
      }}
    >
      <TestDashboard />
    </TruxeProvider>
  );
}
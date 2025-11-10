import React from 'react';
import { 
  TruxeProvider, 
  SignInButton, 
  SignUpButton,
  UserButton, 
  useUser 
} from '../src';

/**
 * Example App demonstrating @truxe/react usage
 */
function App() {
  return (
    <TruxeProvider 
      publishableKey="pk_test_example"
      apiUrl="http://localhost:3001"
    >
      <Dashboard />
    </TruxeProvider>
  );
}

function Dashboard() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Truxe React Demo
            </h1>
            
            <div className="flex items-center space-x-4">
              {!isSignedIn ? (
                <>
                  <SignInButton mode="modal" variant="outline" />
                  <SignUpButton mode="modal" variant="primary" />
                </>
              ) : (
                <UserButton showName />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isSignedIn ? (
          <div className="text-center py-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to Truxe
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Sign in or create an account to get started
            </p>
            <div className="flex justify-center space-x-4">
              <SignInButton mode="modal" variant="primary" size="lg">
                Sign in
              </SignInButton>
              <SignUpButton mode="modal" variant="outline" size="lg">
                Create account
              </SignUpButton>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome back, {user?.firstName || 'User'}!
            </h2>
            <p className="text-gray-600">
              You are successfully authenticated with Truxe.
            </p>
            <div className="mt-6 space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Email:</strong> {user?.email}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Email Verified:</strong> {user?.emailVerified ? 'Yes' : 'No'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Account Created:</strong> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

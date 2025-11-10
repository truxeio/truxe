import React from 'react';
import {
  TruxeProvider,
  SignInButton,
  SignOutButton,
  SignUpButton,
  UserButton,
  useAuth,
} from '@truxe/react';

function AuthDemo() {
  const { isSignedIn, user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="text-xl font-bold">Truxe Auth Demo</div>
            <div className="flex items-center space-x-4">
              {!isSignedIn ? (
                <>
                  <SignInButton variant="outline" />
                  <SignUpButton variant="primary" />
                </>
              ) : (
                <>
                  <UserButton showName />
                  <SignOutButton variant="outline" size="sm" />
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isSignedIn ? (
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to Truxe
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Sign in or create an account to get started
            </p>
            <div className="flex justify-center space-x-4">
              <SignInButton mode="modal" size="lg" />
              <SignUpButton mode="modal" size="lg" variant="outline" />
            </div>
          </div>
        ) : (
          <div className="py-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome back, {user?.firstName || user?.email}!
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              You're signed in with Truxe authentication.
            </p>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold mb-4">Your Profile</h2>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="text-lg text-gray-900">{user?.email}</dd>
                </div>
                {user?.firstName && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd className="text-lg text-gray-900">
                      {user.firstName} {user.lastName}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email Verified</dt>
                  <dd className="text-lg text-gray-900">
                    {user?.emailVerified ? '✅ Yes' : '❌ No'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <TruxeProvider publishableKey={import.meta.env.VITE_HEIMDALL_KEY || 'pk_test_demo'}>
      <AuthDemo />
    </TruxeProvider>
  );
}

export default App;

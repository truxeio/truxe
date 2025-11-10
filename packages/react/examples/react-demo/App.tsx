import React from 'react';
import {
  HeimdallProvider,
  SignInButton,
  SignUpButton,
  UserButton,
  UserProfile,
  OrganizationSwitcher,
  OrganizationProfile,
  OrganizationList,
  CreateOrganization,
  useUser,
  useOrganization,
  useAuth,
} from '@heimdall/react';

// Mock publishable key for demo
const DEMO_PUBLISHABLE_KEY = 'pk_test_demo_key_123';
const DEMO_API_URL = 'http://localhost:87001';

/**
 * Main Application Component
 * Demonstrates complete Heimdall integration
 */
function App() {
  return (
    <HeimdallProvider
      publishableKey={DEMO_PUBLISHABLE_KEY}
      apiUrl={DEMO_API_URL}
      appearance={{
        variables: {
          colorPrimary: '#3b82f6',
          colorBackground: '#ffffff',
          colorText: '#1f2937',
          borderRadius: '0.5rem',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
        elements: {
          card: 'shadow-lg border border-gray-200',
          button: 'px-4 py-2 rounded-md font-medium',
        },
      }}
    >
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Router />
        </main>
      </div>
    </HeimdallProvider>
  );
}

/**
 * Navigation Component
 * Shows authentication state and user controls
 */
function Navigation() {
  const { isSignedIn } = useUser();
  const { organization } = useOrganization();

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-blue-600">
              🛡️ Heimdall Demo
            </h1>
            <div className="hidden md:flex gap-4 text-sm text-gray-600">
              <a href="/" className="hover:text-blue-600">Home</a>
              <a href="/profile" className="hover:text-blue-600">Profile</a>
              <a href="/organizations" className="hover:text-blue-600">Organizations</a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <>
                {organization && (
                  <div className="hidden md:block text-sm text-gray-600">
                    <OrganizationSwitcher />
                  </div>
                )}
                <UserButton showName />
              </>
            ) : (
              <div className="flex gap-2">
                <SignInButton mode="modal">
                  <button className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

/**
 * Simple Router Component
 * Demonstrates routing with protected routes
 */
function Router() {
  const [currentPath, setCurrentPath] = React.useState('/');

  React.useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Simple routing based on current path
  switch (currentPath) {
    case '/profile':
      return <ProtectedRoute><ProfilePage navigate={navigate} /></ProtectedRoute>;
    case '/organizations':
      return <ProtectedRoute><OrganizationsPage navigate={navigate} /></ProtectedRoute>;
    default:
      return <HomePage navigate={navigate} />;
  }
}

/**
 * Protected Route Component
 * Requires authentication
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
        <p className="text-gray-600 mb-8">Please sign in to access this page.</p>
        <SignInButton mode="modal">
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Sign In
          </button>
        </SignInButton>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Home Page
 * Landing page with features showcase
 */
function HomePage({ navigate }: { navigate: (path: string) => void }) {
  const { isSignedIn, user } = useUser();
  const { organization } = useOrganization();

  return (
    <div>
      {isSignedIn ? (
        <div>
          <div className="bg-white rounded-lg shadow p-8 mb-8">
            <h2 className="text-3xl font-bold mb-4">
              Welcome, {user?.firstName}! 👋
            </h2>
            <p className="text-gray-600 mb-6">
              You're successfully signed in to the Heimdall React Demo.
            </p>
            {organization && (
              <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Current Organization:</strong> {organization.name}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DemoCard
              title="👤 User Profile"
              description="View and edit your profile, change password, and manage account settings."
              onClick={() => navigate('/profile')}
            />
            <DemoCard
              title="🏢 Organizations"
              description="Create and manage organizations, invite members, and switch between orgs."
              onClick={() => navigate('/organizations')}
            />
            <DemoCard
              title="🎨 Customization"
              description="See how Heimdall components can be styled and customized for your brand."
            />
          </div>

          <div className="mt-8 bg-gray-100 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">✨ Features in this Demo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Feature text="Magic link authentication" />
              <Feature text="OAuth providers (GitHub, Google)" />
              <Feature text="User profile management" />
              <Feature text="Organization creation & management" />
              <Feature text="Multi-tenant support" />
              <Feature text="Protected routes" />
              <Feature text="Session persistence" />
              <Feature text="Customizable appearance" />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <h1 className="text-5xl font-bold mb-6">
            🛡️ Heimdall React Demo
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Experience Clerk-like authentication for React applications.
            A modern, open-source alternative with complete control.
          </p>

          <div className="flex justify-center gap-4 mb-12">
            <SignInButton mode="modal">
              <button className="px-8 py-4 text-blue-600 border-2 border-blue-600 rounded-lg text-lg font-medium hover:bg-blue-50">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="px-8 py-4 bg-blue-600 text-white rounded-lg text-lg font-medium hover:bg-blue-700">
                Get Started Free
              </button>
            </SignUpButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto mt-16">
            <FeatureCard
              icon="🚀"
              title="Quick Setup"
              description="Get started in minutes with our simple provider wrapper and hooks."
            />
            <FeatureCard
              icon="🔒"
              title="Secure by Default"
              description="OAuth, magic links, and secure session management built-in."
            />
            <FeatureCard
              icon="🎨"
              title="Fully Customizable"
              description="Style components to match your brand with our appearance API."
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Profile Page
 * User profile management
 */
function ProfilePage({ navigate }: { navigate: (path: string) => void }) {
  const { user } = useUser();

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Back to Home
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-3xl font-bold mb-6">Your Profile</h2>
        <UserProfile mode="inline" />
      </div>
    </div>
  );
}

/**
 * Organizations Page
 * Organization management
 */
function OrganizationsPage({ navigate }: { navigate: (path: string) => void }) {
  const { organizations, organization } = useOrganization();

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Back to Home
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-8 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">Organization Settings</h2>
              <OrganizationSwitcher />
            </div>
            {organization ? (
              <OrganizationProfile mode="inline" />
            ) : (
              <p className="text-gray-600">
                Select an organization or create a new one.
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">Your Organizations</h3>
            <OrganizationList layout="list" />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">Create New</h3>
            <CreateOrganization mode="inline" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function DemoCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md p-6 ${
        onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
      }`}
    >
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-green-600">✓</span>
      <span className="text-gray-700">{text}</span>
    </div>
  );
}

export default App;

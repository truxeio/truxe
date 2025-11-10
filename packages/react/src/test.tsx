import { TruxeProvider, useAuth, useUser } from './index';

function TestComponent() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  return (
    <div>
      <h1>Truxe React Test</h1>
      <p>Loaded: {isLoaded ? 'Yes' : 'No'}</p>
      <p>Signed In: {isSignedIn ? 'Yes' : 'No'}</p>
      <p>User: {user?.email ?? 'None'}</p>
    </div>
  );
}

export function TestApp() {
  return (
    <TruxeProvider publishableKey="pk_test_123">
      <TestComponent />
    </TruxeProvider>
  );
}

export default TestApp;

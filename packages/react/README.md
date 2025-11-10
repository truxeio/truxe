# @truxe/react

React components and hooks for Truxe authentication.

## Installation

```bash
npm install @truxe/react
```

## Quick Start

```tsx
import { TruxeProvider, useAuth } from '@truxe/react';

function App() {
  return (
    <TruxeProvider publishableKey="pk_test_xxx">
      <Dashboard />
    </TruxeProvider>
  );
}

function Dashboard() {
  const { isSignedIn, user, signOut } = useAuth();

  return isSignedIn ? (
    <div>
      <h1>Welcome {user?.firstName}!</h1>
      <button onClick={signOut}>Sign Out</button>
    </div>
  ) : (
    <p>Please sign in</p>
  );
}
```

## Documentation

Full documentation: https://github.com/truxeio/truxe/tree/main/docs/react

## Status

🚧 **Week 4, Day 1** - Core hooks implemented
- ✅ TruxeProvider
- ✅ useAuth, useUser, useSession, useOrganization
- ⏳ UI Components (coming Day 2)

## License

MIT

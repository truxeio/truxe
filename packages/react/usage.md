# @truxe/react - Complete Usage Guide

## 📦 Installation

```bash
npm install @truxe/react
# or
yarn add @truxe/react
# or
pnpm add @truxe/react
```

## 🚀 Quick Start

### 1. Wrap your app with TruxeProvider

```tsx
import { TruxeProvider } from '@truxe/react';

function App() {
  return (
    <TruxeProvider 
      publishableKey="pk_test_..."
      apiUrl="http://localhost:3001"
    >
      <YourApp />
    </TruxeProvider>
  );
}
```

### 2. Add authentication to your components

```tsx
import { SignInButton, UserButton, useUser } from '@truxe/react';

function Dashboard() {
  const { isSignedIn, user } = useUser();

  return (
    <div>
      {!isSignedIn ? (
        <SignInButton mode="modal" />
      ) : (
        <div>
          <h1>Welcome {user.firstName}!</h1>
          <UserButton />
        </div>
      )}
    </div>
  );
}
```

## 📚 Components

### TruxeProvider

Root provider that must wrap your entire application.

**Props:**
- `publishableKey` (required): Your Truxe publishable key
- `apiUrl` (optional): API base URL (default: `http://localhost:3001`)
- `onTokenRefresh` (optional): Callback when tokens are refreshed
- `onAuthChange` (optional): Callback when auth state changes

**Example:**
```tsx
<TruxeProvider
  publishableKey="pk_test_..."
  apiUrl="https://api.example.com"
  onAuthChange={(state) => {
    console.log('Auth state changed:', state);
  }}
  onTokenRefresh={(tokens) => {
    console.log('Tokens refreshed:', tokens);
  }}
>
  <App />
</TruxeProvider>
```

---

### SignInButton

Button that triggers the sign-in flow.

**Props:**
- `mode` (optional): `'modal'` | `'redirect'` (default: `'modal'`)
- `redirectUrl` (optional): URL to redirect after sign-in
- `variant` (optional): Button style variant
- `size` (optional): Button size

**Examples:**
```tsx
// Modal mode (default)
<SignInButton mode="modal">Sign in</SignInButton>

// Redirect mode
<SignInButton mode="redirect" redirectUrl="/auth/signin">
  Sign in
</SignInButton>

// With custom styling
<SignInButton 
  mode="modal" 
  variant="primary" 
  size="lg"
>
  Get Started
</SignInButton>
```

---

### SignUpButton

Button that triggers the sign-up flow.

**Props:**
- `mode` (optional): `'modal'` | `'redirect'` (default: `'modal'`)
- `redirectUrl` (optional): URL to redirect after sign-up
- `variant` (optional): Button style variant
- `size` (optional): Button size

**Examples:**
```tsx
// Modal mode
<SignUpButton mode="modal">Create account</SignUpButton>

// Redirect mode
<SignUpButton mode="redirect" redirectUrl="/auth/signup">
  Get started
</SignUpButton>
```

---

### SignOutButton

Button that signs out the current user.

**Props:**
- `redirectUrl` (optional): URL to redirect after sign-out
- `onSignOut` (optional): Callback after sign-out
- `variant` (optional): Button style variant
- `size` (optional): Button size

**Example:**
```tsx
<SignOutButton 
  redirectUrl="/" 
  onSignOut={() => console.log('User signed out')}
>
  Sign out
</SignOutButton>
```

---

### UserButton

Dropdown menu showing user info with sign-out action.

**Props:**
- `showName` (optional): Show user's name next to avatar (default: `true`)
- `userProfileMode` (optional): `'modal'` | `'navigation'` (default: `'modal'`)
- `appearance` (optional): Custom styling configuration

**Examples:**
```tsx
// Default usage
<UserButton />

// Without name
<UserButton showName={false} />

// With custom profile mode
<UserButton userProfileMode="navigation" userProfileUrl="/profile" />
```

---

### UserAvatar

Display user's avatar or initials.

**Props:**
- `size` (optional): `'sm'` | `'md'` | `'lg'` | `'xl'` (default: `'md'`)
- `showTooltip` (optional): Show name on hover (default: `false`)
- `className` (optional): Additional CSS classes

**Examples:**
```tsx
// Default size
<UserAvatar />

// Large with tooltip
<UserAvatar size="lg" showTooltip />

// Small avatar
<UserAvatar size="sm" />
```

---

### UserProfile

Full user profile editor component.

**Example:**
```tsx
import { UserProfile, Modal } from '@truxe/react';

function ProfilePage() {
  return (
    <div>
      <h1>My Profile</h1>
      <UserProfile />
    </div>
  );
}
```

---

### SignIn

Full sign-in form component (used internally by SignInButton).

**Props:**
- `onSuccess` (optional): Callback when sign-in succeeds
- `redirectUrl` (optional): URL to redirect after sign-in

**Example:**
```tsx
import { SignIn } from '@truxe/react';

function SignInPage() {
  return (
    <div className="container">
      <SignIn 
        onSuccess={(user) => console.log('Signed in:', user)}
        redirectUrl="/dashboard"
      />
    </div>
  );
}
```

---

### SignUp

Full sign-up form component (used internally by SignUpButton).

**Props:**
- `onSuccess` (optional): Callback when sign-up succeeds
- `redirectUrl` (optional): URL to redirect after sign-up

**Example:**
```tsx
import { SignUp } from '@truxe/react';

function SignUpPage() {
  return (
    <div className="container">
      <SignUp 
        onSuccess={(user) => console.log('Signed up:', user)}
        redirectUrl="/onboarding"
      />
    </div>
  );
}
```

---

## 🪝 Hooks

### useAuth()

Access authentication state and methods.

**Returns:**
```typescript
{
  isLoaded: boolean;
  isSignedIn: boolean;
  user: User | null;
  session: Session | null;
  signIn: (email: string, password?: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<void>;
  signOut: () => Promise<void>;
}
```

**Example:**
```tsx
import { useAuth } from '@truxe/react';

function MyComponent() {
  const { isLoaded, isSignedIn, user, signIn, signOut } = useAuth();
  
  if (!isLoaded) {
    return <div>Loading...</div>;
  }
  
  if (!isSignedIn) {
    return (
      <button onClick={() => signIn('user@example.com', 'password')}>
        Sign In
      </button>
    );
  }
  
  return (
    <div>
      <p>Welcome, {user?.firstName}!</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

---

### useUser()

Access user data and update methods.

**Returns:**
```typescript
{
  isLoaded: boolean;
  isSignedIn: boolean;
  user: User | null;
  update: (updates: Partial<User>) => Promise<User>;
}
```

**Example:**
```tsx
import { useUser } from '@truxe/react';

function ProfileEditor() {
  const { user, update } = useUser();
  
  const handleUpdate = async () => {
    await update({
      firstName: 'John',
      lastName: 'Doe'
    });
  };
  
  return (
    <div>
      <p>{user?.email}</p>
      <button onClick={handleUpdate}>Update Name</button>
    </div>
  );
}
```

---

### useSession()

Access session information.

**Returns:**
```typescript
{
  isLoaded: boolean;
  session: Session | null;
}
```

**Example:**
```tsx
import { useSession } from '@truxe/react';

function SessionInfo() {
  const { session } = useSession();
  
  if (!session) return null;
  
  return (
    <div>
      <p>Session expires: {new Date(session.expiresAt).toLocaleString()}</p>
      <p>Last active: {new Date(session.lastActiveAt).toLocaleString()}</p>
    </div>
  );
}
```

---

### useOrganization()

Access organization data and methods.

**Returns:**
```typescript
{
  isLoaded: boolean;
  organization: Organization | null;
  organizations: Organization[];
  setActive: (orgId: string) => Promise<void>;
  create: (data: { name: string; slug?: string }) => Promise<Organization>;
}
```

**Example:**
```tsx
import { useOrganization } from '@truxe/react';

function OrgSwitcher() {
  const { organization, organizations, setActive, create } = useOrganization();
  
  return (
    <div>
      <h2>Current: {organization?.name}</h2>
      <select onChange={(e) => setActive(e.target.value)}>
        {organizations.map(org => (
          <option key={org.id} value={org.id}>{org.name}</option>
        ))}
      </select>
      <button onClick={() => create({ name: 'New Org' })}>
        Create Organization
      </button>
    </div>
  );
}
```

---

## 🎨 UI Components

### Button

Reusable button component.

**Props:**
- `variant`: `'primary'` | `'secondary'` | `'outline'` | `'ghost'` | `'danger'`
- `size`: `'sm'` | `'md'` | `'lg'`
- `isLoading`: boolean
- `fullWidth`: boolean

**Example:**
```tsx
import { Button } from '@truxe/react';

<Button variant="primary" size="lg" isLoading={loading}>
  Save Changes
</Button>
```

---

### Input

Form input component with label and error support.

**Props:**
- `label`: string
- `error`: string
- `helperText`: string
- `fullWidth`: boolean

**Example:**
```tsx
import { Input } from '@truxe/react';

<Input
  label="Email"
  type="email"
  placeholder="you@example.com"
  error={errors.email}
  helperText="We'll never share your email"
/>
```

---

### Modal

Accessible modal component.

**Props:**
- `isOpen`: boolean
- `onClose`: () => void
- `title`: string
- `size`: `'sm'` | `'md'` | `'lg'` | `'xl'`

**Example:**
```tsx
import { Modal } from '@truxe/react';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>
      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
        title="My Modal"
        size="lg"
      >
        <p>Modal content</p>
      </Modal>
    </>
  );
}
```

---

## 🔧 TypeScript Support

All components and hooks are fully typed. Import types as needed:

```tsx
import type { 
  User, 
  Session, 
  Organization,
  AuthState,
  SignInProps,
  UserButtonProps 
} from '@truxe/react';
```

---

## 🎯 Common Patterns

### Protected Routes

```tsx
import { useAuth } from '@truxe/react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  
  if (!isLoaded) {
    return <div>Loading...</div>;
  }
  
  if (!isSignedIn) {
    return <Navigate to="/signin" />;
  }
  
  return children;
}
```

### Conditional Rendering

```tsx
import { useUser } from '@truxe/react';

function Header() {
  const { isSignedIn } = useUser();
  
  return (
    <header>
      <Logo />
      {isSignedIn ? (
        <UserButton />
      ) : (
        <>
          <SignInButton />
          <SignUpButton />
        </>
      )}
    </header>
  );
}
```

### Loading States

```tsx
import { useAuth } from '@truxe/react';

function App() {
  const { isLoaded } = useAuth();
  
  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <Spinner />
      </div>
    );
  }
  
  return <YourApp />;
}
```

---

## 📄 License

MIT

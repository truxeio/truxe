# @truxe/react API Reference

Complete API documentation for @truxe/react components and hooks.

## Table of Contents

- [Provider](#provider)
- [Hooks](#hooks)
- [Authentication Components](#authentication-components)
- [User Components](#user-components)
- [Organization Components](#organization-components)
- [Types](#types)

---

## Provider

### TruxeProvider

The root provider that manages authentication state.

```tsx
import { TruxeProvider } from '@truxe/react';

<TruxeProvider
  publishableKey="pk_test_..."
  apiUrl="http://localhost:87001"
  appearance={{...}}
  localization={{...}}
>
  <App />
</TruxeProvider>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `publishableKey` | `string` | ✅ | - | Your Truxe publishable key |
| `apiUrl` | `string` | ❌ | `http://localhost:87001` | API endpoint URL |
| `appearance` | `Appearance` | ❌ | `{}` | Styling customization |
| `localization` | `Localization` | ❌ | `{}` | Text customization |
| `children` | `ReactNode` | ✅ | - | Your application |

#### Appearance Type

```typescript
interface Appearance {
  variables?: {
    colorPrimary?: string;
    colorBackground?: string;
    colorText?: string;
    colorDanger?: string;
    colorSuccess?: string;
    borderRadius?: string;
    fontFamily?: string;
  };
  elements?: {
    card?: string;
    button?: string;
    input?: string;
    label?: string;
    formFieldLabel?: string;
    // ... more elements
  };
}
```

---

## Hooks

### useAuth()

Access authentication state and methods.

```tsx
import { useAuth } from '@truxe/react';

const {
  isSignedIn,
  isLoaded,
  signIn,
  signOut,
} = useAuth();
```

#### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `isSignedIn` | `boolean` | Whether user is authenticated |
| `isLoaded` | `boolean` | Whether auth state has loaded |
| `signIn` | `(credentials: SignInCredentials) => Promise<void>` | Sign in function |
| `signOut` | `() => Promise<void>` | Sign out function |

#### SignInCredentials Type

```typescript
interface SignInCredentials {
  email: string;
  password: string;
}
```

---

### useUser()

Access and manage user data.

```tsx
import { useUser } from '@truxe/react';

const {
  user,
  isLoaded,
  updateUser,
  reloadUser,
} = useUser();
```

#### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `user` | `User \| null` | Current user object |
| `isLoaded` | `boolean` | Whether user data has loaded |
| `updateUser` | `(data: Partial<User>) => Promise<User>` | Update user profile |
| `reloadUser` | `() => Promise<void>` | Refresh user data |

#### User Type

```typescript
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

### useOrganization()

Manage organizations and memberships.

```tsx
import { useOrganization } from '@truxe/react';

const {
  organization,
  organizations,
  isLoaded,
  switchOrganization,
  createOrganization,
  updateOrganization,
} = useOrganization();
```

#### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `organization` | `Organization \| null` | Active organization |
| `organizations` | `Organization[]` | All user organizations |
| `isLoaded` | `boolean` | Whether data has loaded |
| `switchOrganization` | `(orgId: string) => Promise<void>` | Switch active org |
| `createOrganization` | `(data: CreateOrgData) => Promise<Organization>` | Create new org |
| `updateOrganization` | `(data: Partial<Organization>) => Promise<Organization>` | Update org |

#### Organization Type

```typescript
interface Organization {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  members?: OrganizationMember[];
}

interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}
```

---

### useSession()

Access session information.

```tsx
import { useSession } from '@truxe/react';

const {
  session,
  isLoaded,
  getToken,
} = useSession();
```

#### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `session` | `Session \| null` | Current session |
| `isLoaded` | `boolean` | Whether session has loaded |
| `getToken` | `() => Promise<string>` | Get access token |

#### Session Type

```typescript
interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}
```

---

## Authentication Components

### SignIn

Complete sign-in form with email/password, magic link, and OAuth.

```tsx
import { SignIn } from '@truxe/react';

<SignIn
  mode="modal"
  redirectUrl="/dashboard"
  appearance={{...}}
/>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `mode` | `'modal' \| 'inline'` | ❌ | `'inline'` | Display mode |
| `redirectUrl` | `string` | ❌ | `'/'` | Post-signin redirect |
| `appearance` | `Appearance` | ❌ | `{}` | Styling customization |
| `providers` | `OAuthProvider[]` | ❌ | `['github', 'google']` | OAuth providers |

#### OAuth Provider Types

```typescript
type OAuthProvider = 
  | 'github' 
  | 'google' 
  | 'microsoft' 
  | 'facebook'
  | 'apple';
```

---

### SignUp

User registration form with email verification.

```tsx
import { SignUp } from '@truxe/react';

<SignUp
  mode="inline"
  redirectUrl="/onboarding"
/>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `mode` | `'modal' \| 'inline'` | ❌ | `'inline'` | Display mode |
| `redirectUrl` | `string` | ❌ | `'/'` | Post-signup redirect |
| `appearance` | `Appearance` | ❌ | `{}` | Styling customization |
| `requireVerification` | `boolean` | ❌ | `true` | Require email verification |

---

### SignInButton

Trigger sign-in modal or redirect.

```tsx
import { SignInButton } from '@truxe/react';

<SignInButton mode="modal">
  <button>Sign In</button>
</SignInButton>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `mode` | `'modal' \| 'redirect'` | ❌ | `'modal'` | Action type |
| `redirectUrl` | `string` | ❌ | `'/sign-in'` | Redirect URL (if mode='redirect') |
| `children` | `ReactNode` | ❌ | Default button | Custom trigger |

---

### SignOutButton

Sign out with optional redirect.

```tsx
import { SignOutButton } from '@truxe/react';

<SignOutButton redirectUrl="/goodbye">
  <button>Sign Out</button>
</SignOutButton>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `redirectUrl` | `string` | ❌ | `'/'` | Post-signout redirect |
| `children` | `ReactNode` | ❌ | Default button | Custom trigger |

---

## User Components

### UserButton

User menu dropdown with avatar.

```tsx
import { UserButton } from '@truxe/react';

<UserButton
  showName
  appearance={{...}}
/>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `showName` | `boolean` | ❌ | `false` | Display user name |
| `appearance` | `Appearance` | ❌ | `{}` | Styling customization |

---

### UserProfile

Complete profile management.

```tsx
import { UserProfile } from '@truxe/react';

<UserProfile
  mode="inline"
  appearance={{...}}
/>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `mode` | `'modal' \| 'inline'` | ❌ | `'inline'` | Display mode |
| `appearance` | `Appearance` | ❌ | `{}` | Styling customization |

---

### UserAvatar

Display user avatar.

```tsx
import { UserAvatar } from '@truxe/react';

<UserAvatar
  user={user}
  size="lg"
/>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user` | `User` | ✅ | - | User object |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | ❌ | `'md'` | Avatar size |
| `className` | `string` | ❌ | `''` | Additional CSS classes |

---

## Organization Components

### OrganizationSwitcher

Dropdown to switch between organizations.

```tsx
import { OrganizationSwitcher } from '@truxe/react';

<OrganizationSwitcher
  showCreateButton
  appearance={{...}}
/>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `showCreateButton` | `boolean` | ❌ | `true` | Show create org button |
| `appearance` | `Appearance` | ❌ | `{}` | Styling customization |

---

### OrganizationProfile

Manage organization settings and members.

```tsx
import { OrganizationProfile } from '@truxe/react';

<OrganizationProfile
  mode="inline"
  appearance={{...}}
/>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `mode` | `'modal' \| 'inline'` | ❌ | `'inline'` | Display mode |
| `appearance` | `Appearance` | ❌ | `{}` | Styling customization |

---

### CreateOrganization

Create new organization form.

```tsx
import { CreateOrganization } from '@truxe/react';

<CreateOrganization
  mode="inline"
  onSuccess={(org) => console.log('Created:', org)}
/>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `mode` | `'modal' \| 'inline'` | ❌ | `'inline'` | Display mode |
| `onSuccess` | `(org: Organization) => void` | ❌ | - | Success callback |
| `appearance` | `Appearance` | ❌ | `{}` | Styling customization |

---

### OrganizationList

Display list of user's organizations.

```tsx
import { OrganizationList } from '@truxe/react';

<OrganizationList
  layout="card"
  onSelect={(org) => console.log('Selected:', org)}
/>
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `layout` | `'list' \| 'card'` | ❌ | `'list'` | Display layout |
| `onSelect` | `(org: Organization) => void` | ❌ | - | Selection callback |
| `appearance` | `Appearance` | ❌ | `{}` | Styling customization |

---

## Types

### Complete Type Definitions

```typescript
// User Types
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// Organization Types
interface Organization {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  members?: OrganizationMember[];
}

interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

// Session Types
interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

// Component Types
type ComponentMode = 'modal' | 'inline';
type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
type OAuthProvider = 'github' | 'google' | 'microsoft' | 'facebook' | 'apple';

// Appearance Types
interface Appearance {
  variables?: {
    colorPrimary?: string;
    colorBackground?: string;
    colorText?: string;
    colorDanger?: string;
    colorSuccess?: string;
    borderRadius?: string;
    fontFamily?: string;
  };
  elements?: Record<string, string>;
}
```

---

## Error Handling

All async operations can throw errors. Handle them appropriately:

```tsx
import { useAuth } from '@truxe/react';

function SignInForm() {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await signIn({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      {/* Form fields */}
    </form>
  );
}
```

---

## Migration from Clerk

### Component Mapping

| Clerk Component | Truxe Component | Notes |
|----------------|-------------------|-------|
| `<ClerkProvider>` | `<TruxeProvider>` | Drop-in replacement |
| `<SignIn>` | `<SignIn>` | Same API |
| `<SignUp>` | `<SignUp>` | Same API |
| `<UserButton>` | `<UserButton>` | Same API |
| `<OrganizationSwitcher>` | `<OrganizationSwitcher>` | Same API |

### Hook Mapping

| Clerk Hook | Truxe Hook | Notes |
|-----------|---------------|-------|
| `useAuth()` | `useAuth()` | Same API |
| `useUser()` | `useUser()` | Same API |
| `useOrganization()` | `useOrganization()` | Same API |
| `useSession()` | `useSession()` | Same API |

Most Clerk code works with minimal changes - just swap the imports!

---

## Examples

### Complete Auth Flow

```tsx
import {
  TruxeProvider,
  SignIn,
  SignUp,
  UserButton,
  useAuth,
} from '@truxe/react';

function App() {
  return (
    <TruxeProvider publishableKey="pk_test_...">
      <Router>
        <Routes>
          <Route path="/sign-in" element={<SignIn mode="inline" />} />
          <Route path="/sign-up" element={<SignUp mode="inline" />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        </Routes>
      </Router>
    </TruxeProvider>
  );
}

function ProtectedRoute({ children }) {
  const { isSignedIn, isLoaded } = useAuth();
  
  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <Navigate to="/sign-in" />;
  
  return children;
}

function Dashboard() {
  const { user } = useUser();
  
  return (
    <div>
      <UserButton />
      <h1>Welcome {user?.firstName}!</h1>
    </div>
  );
}
```

---

For more examples and tutorials, visit [docs.truxe.io](https://github.com/truxeio/truxe/tree/main/docs).

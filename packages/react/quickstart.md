# 🚀 Quick Start Guide - @truxe/react

Get up and running with Truxe authentication in 5 minutes!

## Step 1: Install the Package

```bash
npm install @truxe/react
```

## Step 2: Wrap Your App

In your main app file (e.g., `App.tsx`):

```tsx
import { TruxeProvider } from '@truxe/react';

function App() {
  return (
    <TruxeProvider publishableKey="pk_test_your_key_here">
      <YourApp />
    </TruxeProvider>
  );
}

export default App;
```

## Step 3: Add Authentication

Create a simple header component:

```tsx
import { SignInButton, SignUpButton, UserButton, useUser } from '@truxe/react';

function Header() {
  const { isSignedIn } = useUser();

  return (
    <header className="header">
      <h1>My App</h1>
      
      {isSignedIn ? (
        <UserButton />
      ) : (
        <div className="auth-buttons">
          <SignInButton mode="modal" />
          <SignUpButton mode="modal" />
        </div>
      )}
    </header>
  );
}
```

## Step 4: Show User Info

Display authenticated user information:

```tsx
import { useUser } from '@truxe/react';

function Dashboard() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!isSignedIn) {
    return <div>Please sign in to continue</div>;
  }

  return (
    <div>
      <h1>Welcome, {user.firstName}!</h1>
      <p>Email: {user.email}</p>
    </div>
  );
}
```

## Step 5: Protect Routes (Optional)

Create a protected route wrapper:

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

// Usage
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

## 🎉 You're Done!

That's it! You now have:
- ✅ Sign in functionality
- ✅ Sign up functionality
- ✅ User profile management
- ✅ Protected routes
- ✅ Automatic token management

## 📚 Next Steps

- Read the [full documentation](./USAGE.md)
- Check out [examples](./examples/App.tsx)
- Learn about [advanced features](./USAGE.md#common-patterns)

## 💡 Common Use Cases

### Custom Sign-In Page

```tsx
import { SignIn } from '@truxe/react';

function SignInPage() {
  return (
    <div className="signin-page">
      <SignIn 
        onSuccess={(user) => {
          console.log('Signed in:', user);
        }}
        redirectUrl="/dashboard"
      />
    </div>
  );
}
```

### Update User Profile

```tsx
import { useUser } from '@truxe/react';

function ProfileSettings() {
  const { user, update } = useUser();

  const handleUpdate = async () => {
    await update({
      firstName: 'John',
      lastName: 'Doe'
    });
    alert('Profile updated!');
  };

  return (
    <button onClick={handleUpdate}>
      Update Profile
    </button>
  );
}
```

### Sign Out

```tsx
import { SignOutButton } from '@truxe/react';

function Navigation() {
  return (
    <nav>
      <SignOutButton redirectUrl="/">
        Sign out
      </SignOutButton>
    </nav>
  );
}
```

## 🔧 Configuration Options

### TruxeProvider Props

```tsx
<TruxeProvider
  publishableKey="pk_test_..."        // Required
  apiUrl="http://localhost:3001"      // Optional
  onAuthChange={(state) => {}}        // Optional
  onTokenRefresh={(tokens) => {}}     // Optional
>
  <App />
</TruxeProvider>
```

## 🎨 Styling

All components use basic CSS classes that you can style:

```css
/* Button variants */
.button-primary { /* Your primary button styles */ }
.button-outline { /* Your outline button styles */ }

/* Input styles */
.input { /* Your input styles */ }
.input-error { /* Error state styles */ }

/* Modal */
.modal-overlay { /* Overlay styles */ }
.modal-content { /* Modal content styles */ }
```

Or use Tailwind CSS (already included in component classes).

## 📱 Responsive Example

```tsx
function ResponsiveHeader() {
  const { isSignedIn } = useUser();

  return (
    <header className="flex justify-between items-center p-4">
      <Logo />
      
      <div className="hidden md:flex gap-4">
        {isSignedIn ? (
          <UserButton showName />
        ) : (
          <>
            <SignInButton variant="outline" />
            <SignUpButton variant="primary" />
          </>
        )}
      </div>

      {/* Mobile menu */}
      <div className="md:hidden">
        <MobileMenu />
      </div>
    </header>
  );
}
```

## 🐛 Troubleshooting

### "useAuth must be used within TruxeProvider"
Make sure your component is wrapped in `<TruxeProvider>`.

### Build errors with TypeScript
Ensure you have the latest version of TypeScript (5.0+).

### Components not styling correctly
Import your CSS file or add Tailwind CSS to your project.

## 📖 Full Documentation

For complete API documentation, see [USAGE.md](./USAGE.md).

## 💬 Support

- GitHub Issues: [Report a bug](https://github.com/truxeio/truxe/issues)
- Documentation: [Full docs](./USAGE.md)
- Examples: [See examples](./examples/)

---

**Happy coding!** 🎉

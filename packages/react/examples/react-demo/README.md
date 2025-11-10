# Truxe React Demo

Full-featured demo application showcasing all @truxe/react capabilities.

## 🚀 Features Demonstrated

- ✅ **Magic link authentication** - Passwordless sign-in
- ✅ **OAuth providers** - GitHub and Google sign-in
- ✅ **User profile management** - Update name, email, avatar
- ✅ **Organization creation** - Create and manage organizations
- ✅ **Organization switching** - Switch between multiple orgs
- ✅ **Multi-tenant functionality** - Full organization support
- ✅ **Protected routes** - Authentication-required pages
- ✅ **Session persistence** - Maintains auth across refreshes
- ✅ **Error handling** - Graceful error states
- ✅ **Loading states** - Smooth UX during operations

## 📋 Running the Demo

### Prerequisites

- Node.js 16+ installed
- npm or yarn

### Installation & Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The demo will open at `http://localhost:5173`

## 🎯 Use Cases

This demo shows how to:

1. **Integrate Truxe into a React app**
   - Set up TruxeProvider
   - Configure publishable key
   - Wrap your application

2. **Handle authentication flows**
   - Sign in with email/password
   - Sign up for new account
   - Magic link authentication
   - OAuth provider login
   - Sign out

3. **Manage user profiles**
   - Display user information
   - Update profile details
   - Change password
   - Upload avatar

4. **Work with organizations**
   - Create new organizations
   - Switch between organizations
   - View organization list
   - Update organization settings

5. **Customize appearance**
   - Theme customization
   - Brand colors
   - Component styling

6. **Handle errors gracefully**
   - API error handling
   - Network error recovery
   - Validation errors

## 📚 Code Examples

### Basic Setup

```tsx
import { TruxeProvider } from '@truxe/react';

function App() {
  return (
    <TruxeProvider publishableKey="pk_test_demo_key_123">
      <YourApp />
    </TruxeProvider>
  );
}
```

### Protected Routes

```tsx
import { useAuth } from '@truxe/react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <Navigate to="/sign-in" />;

  return children;
}
```

### User Profile

```tsx
import { UserProfile } from '@truxe/react';

function ProfilePage() {
  return (
    <div>
      <h1>Your Profile</h1>
      <UserProfile mode="inline" />
    </div>
  );
}
```

### Organization Management

```tsx
import { OrganizationSwitcher, OrganizationProfile } from '@truxe/react';

function OrganizationsPage() {
  return (
    <div>
      <OrganizationSwitcher />
      <OrganizationProfile mode="inline" />
    </div>
  );
}
```

## 🏗️ Project Structure

```
src/
├── App.tsx                 # Main application component
├── components/
│   ├── Navigation.tsx      # Nav bar with auth controls
│   ├── Home.tsx           # Landing page
│   ├── ProfilePage.tsx    # User profile page
│   └── OrganizationsPage.tsx  # Organization management
├── styles/
│   └── index.css          # Global styles
└── main.tsx               # Application entry point
```

## 🎨 Customization

The demo includes examples of:

- **Theme customization** - Colors, fonts, spacing
- **Component styling** - Tailwind CSS classes
- **Appearance prop** - Component-level customization
- **Localization** - Custom text and labels

## 📖 Learn More

- [Truxe Documentation](https://github.com/truxeio/truxe/tree/main/docs)
- [@truxe/react Package](https://www.npmjs.com/package/@truxe/react)
- [GitHub Repository](https://github.com/truxeio/truxe)

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/truxeio/truxe/issues)
- **Discord**: [Join our community](https://discord.gg/truxe)
- **Twitter**: [@TruxeAuth](https://twitter.com/TruxeAuth)

## 📄 License

MIT License - see [LICENSE](../../LICENSE)

---

**Built with ❤️ using @truxe/react**

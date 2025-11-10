import { useContext } from 'react';
import { TruxeContext } from '../context/TruxeProvider';

/**
 * Access authentication state and methods.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isSignedIn, user, signIn, signOut } = useAuth();
 *   
 *   if (!isSignedIn) {
 *     return <button onClick={() => signIn('user@example.com', 'password')}>Sign In</button>;
 *   }
 *   
 *   return (
 *     <div>
 *       <p>Welcome, {user?.firstName}!</p>
 *       <button onClick={signOut}>Sign Out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth() {
  const context = useContext(TruxeContext);

  if (!context) {
    throw new Error('useAuth must be used within TruxeProvider');
  }

  const {
    isLoaded,
    isSignedIn,
    user,
    session,
    signIn,
    signUp,
    signOut,
  } = context;

  return {
    isLoaded,
    isSignedIn,
    user,
    session,
    signIn,
    signUp,
    signOut,
  };
}

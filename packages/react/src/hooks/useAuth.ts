import { useContext } from 'react';
import { HeimdallContext } from '../context/HeimdallProvider';

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
  const context = useContext(HeimdallContext);

  if (!context) {
    throw new Error('useAuth must be used within HeimdallProvider');
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

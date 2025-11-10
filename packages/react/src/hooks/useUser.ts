import { useContext } from 'react';
import { HeimdallContext } from '../context/HeimdallProvider';
import type { User } from '../types';

/**
 * Access user data and methods.
 * 
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { isLoaded, isSignedIn, user, update } = useUser();
 *   
 *   if (!isLoaded) return <div>Loading...</div>;
 *   if (!isSignedIn) return <div>Please sign in</div>;
 *   
 *   return (
 *     <div>
 *       <h1>{user?.firstName} {user?.lastName}</h1>
 *       <button onClick={() => update({ firstName: 'New Name' })}>
 *         Update Name
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUser() {
  const context = useContext(HeimdallContext);

  if (!context) {
    throw new Error('useUser must be used within HeimdallProvider');
  }

  const { isLoaded, isSignedIn, user, updateUser } = context;

  return {
    isLoaded,
    isSignedIn,
    user,
    update: async (updates: Partial<User>) => {
      if (!user) {
        throw new Error('No user signed in');
      }
      return updateUser(updates);
    },
  };
}

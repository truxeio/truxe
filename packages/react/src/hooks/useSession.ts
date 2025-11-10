import { useContext } from 'react';
import { TruxeContext } from '../context/TruxeProvider';

/**
 * Access session information.
 * 
 * @example
 * ```tsx
 * function SessionInfo() {
 *   const { isLoaded, session } = useSession();
 *   
 *   if (!isLoaded) return <div>Loading...</div>;
 *   if (!session) return <div>No active session</div>;
 *   
 *   return (
 *     <div>
 *       <p>Session expires: {new Date(session.expiresAt).toLocaleString()}</p>
 *       <p>Last active: {new Date(session.lastActiveAt).toLocaleString()}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSession() {
  const context = useContext(TruxeContext);

  if (!context) {
    throw new Error('useSession must be used within TruxeProvider');
  }

  const { isLoaded, session } = context;

  return {
    isLoaded,
    session,
  };
}

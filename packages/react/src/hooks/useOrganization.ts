import { useContext } from 'react';
import { TruxeContext } from '../context/TruxeProvider';

/**
 * Access organization data and methods.
 * 
 * @example
 * ```tsx
 * function OrganizationSelector() {
 *   const { isLoaded, organization, organizations, setActive, create } = useOrganization();
 *   
 *   if (!isLoaded) return <div>Loading...</div>;
 *   
 *   return (
 *     <div>
 *       <h2>Current: {organization?.name || 'None'}</h2>
 *       <select onChange={(e) => setActive(e.target.value)}>
 *         {organizations.map(org => (
 *           <option key={org.id} value={org.id}>{org.name}</option>
 *         ))}
 *       </select>
 *       <button onClick={() => create({ name: 'New Org' })}>
 *         Create Organization
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOrganization() {
  const context = useContext(TruxeContext);

  if (!context) {
    throw new Error('useOrganization must be used within TruxeProvider');
  }

  const {
    isLoaded,
    organization,
    organizations,
    setActiveOrganization,
    createOrganization,
  } = context;

  return {
    isLoaded,
    organization,
    organizations,
    setActive: (orgId: string) => setActiveOrganization(orgId),
    create: (data: { name: string; slug?: string }) => createOrganization(data),
  };
}

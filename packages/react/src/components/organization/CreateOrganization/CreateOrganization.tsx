import { useState } from 'react';
import { useOrganization } from '../../../hooks/useOrganization';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

export interface CreateOrganizationProps {
  /** Called when modal is closed */
  onClose: () => void;
  /** Called after successful organization creation */
  onSuccess?: (organizationId: string) => void;
  /** Display mode */
  mode?: 'modal' | 'inline';
}

/**
 * CreateOrganization - Modal or inline form for creating new organizations.
 * 
 * Provides a form for creating new organizations with:
 * - Organization name input
 * - Auto-generated slug from name
 * - Form validation
 * - Loading state during creation
 * - Success/error feedback
 * - Can be displayed as modal or inline form
 * 
 * @example
 * ```tsx
 * // Modal mode
 * <CreateOrganization onClose={() => setShow(false)} />
 * 
 * // Inline mode
 * <CreateOrganization mode="inline" onClose={() => {}} />
 * 
 * // With success callback
 * <CreateOrganization 
 *   onClose={() => setShow(false)}
 *   onSuccess={(orgId) => navigate(`/org/${orgId}`)}
 * />
 * ```
 */
export function CreateOrganization({ 
  onClose, 
  onSuccess,
  mode = 'modal',
}: CreateOrganizationProps) {
  const { create } = useOrganization();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    
    // Generate slug: lowercase, replace spaces with hyphens, remove special chars
    const generatedSlug = value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }

    if (!slug.trim()) {
      setError('Organization slug is required');
      return;
    }

    setIsLoading(true);

    try {
      const newOrg = await create({ name: name.trim(), slug: slug.trim() });
      
      if (onSuccess && newOrg) {
        onSuccess(newOrg.id);
      }
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 mb-1">
          Organization Name *
        </label>
        <Input
          id="org-name"
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Acme Corporation"
          disabled={isLoading}
          autoFocus
          required
        />
      </div>

      <div>
        <label htmlFor="org-slug" className="block text-sm font-medium text-gray-700 mb-1">
          Slug *
        </label>
        <Input
          id="org-slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="acme-corporation"
          disabled={isLoading}
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          URL-friendly identifier for your organization
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          disabled={isLoading || !name.trim() || !slug.trim()}
        >
          {isLoading ? 'Creating...' : 'Create Organization'}
        </Button>
      </div>
    </form>
  );

  if (mode === 'inline') {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Create Organization</h2>
        {formContent}
      </div>
    );
  }

  return (
    <Modal isOpen onClose={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Create Organization</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {formContent}
      </div>
    </Modal>
  );
}

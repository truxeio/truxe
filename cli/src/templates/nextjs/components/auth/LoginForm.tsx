'use client';

import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

interface LoginFormProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  className?: string;
  showOrganization?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  className,
  showOrganization = false,
}) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setMessage({ type: 'error', text: 'Email is required' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await login(email, orgSlug || undefined);
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        onSuccess?.();
      } else {
        setMessage({ type: 'error', text: result.message });
        onError?.(new Error(result.message));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setMessage({ type: 'error', text: errorMessage });
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {message && (
        <div className={cn(
          'p-4 rounded-md text-sm',
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        )}>
          {message.text}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
          placeholder="Enter your email address"
          disabled={isLoading}
        />
      </div>

      {showOrganization && (
        <div>
          <label htmlFor="orgSlug" className="block text-sm font-medium text-gray-700 mb-2">
            Organization (optional)
          </label>
          <input
            id="orgSlug"
            name="orgSlug"
            type="text"
            value={orgSlug}
            onChange={(e) => setOrgSlug(e.target.value)}
            className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            placeholder="Enter organization name"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Leave empty to sign in to your personal account
          </p>
        </div>
      )}

      <div>
        <Button
          type="submit"
          loading={isLoading}
          fullWidth
          size="lg"
          disabled={!email || isLoading}
        >
          {isLoading ? 'Sending magic link...' : 'Send magic link'}
        </Button>
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-500">
          We'll send you a secure link to sign in without a password.
        </p>
      </div>
    </form>
  );
};

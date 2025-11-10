import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import type { SignInProps } from '../../../types';

/**
 * SignIn component with magic link and password authentication.
 * 
 * @example
 * ```tsx
 * <SignIn 
 *   onSuccess={(user) => console.log('Signed in:', user)}
 *   redirectUrl="/dashboard"
 * />
 * ```
 */
export function SignIn({ onSuccess, redirectUrl }: SignInProps) {
  const { signIn, user } = useAuth();
  const [method, setMethod] = useState<'magic-link' | 'password'>('magic-link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (method === 'magic-link') {
        await signIn(email);
        setMagicLinkSent(true);
      } else {
        await signIn(email, password);
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
        if (onSuccess && user) {
          onSuccess(user);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium">Check your email</h3>
        <p className="text-sm text-gray-600">
          We sent a magic link to <strong>{email}</strong>
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Click the link in the email to sign in.
        </p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => setMagicLinkSent(false)}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
        <p className="mt-2 text-sm text-gray-600">
          Welcome back! Please sign in to continue.
        </p>
      </div>

      {/* Method Selector */}
      <div className="mb-6 flex rounded-lg border border-gray-300 p-1">
        <button
          type="button"
          onClick={() => setMethod('magic-link')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            method === 'magic-link'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Magic Link
        </button>
        <button
          type="button"
          onClick={() => setMethod('password')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            method === 'password'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Password
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        {method === 'password' && (
          <Input
            type="password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={isLoading}
        >
          {method === 'magic-link' ? 'Send magic link' : 'Sign in'}
        </Button>
      </form>

      {method === 'password' && (
        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-sm text-blue-600 hover:text-blue-700"
            onClick={() => {
              // TODO: Implement forgot password
              alert('Forgot password flow coming soon!');
            }}
          >
            Forgot password?
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import type { SignUpProps } from '../../../types';

/**
 * SignUp component with password validation.
 * 
 * @example
 * ```tsx
 * <SignUp 
 *   onSuccess={(user) => console.log('Signed up:', user)}
 *   redirectUrl="/dashboard"
 * />
 * ```
 */
export function SignUp({ onSuccess, redirectUrl }: SignUpProps) {
  const { signUp, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validatePassword = (pwd: string): string => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return '';
  };

  const handlePasswordChange = (pwd: string) => {
    setPassword(pwd);
    const error = validatePassword(pwd);
    setPasswordError(error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const pwdError = validatePassword(password);
    if (pwdError) {
      setPasswordError(pwdError);
      return;
    }

    setIsLoading(true);

    try {
      const metadata = {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      };

      await signUp(email, password, metadata);

      if (redirectUrl) {
        window.location.href = redirectUrl;
      }

      if (onSuccess && user) {
        onSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create account</h2>
        <p className="mt-2 text-sm text-gray-600">
          Get started with your free account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="text"
            label="First name"
            placeholder="John"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            fullWidth
          />
          <Input
            type="text"
            label="Last name"
            placeholder="Doe"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            fullWidth
          />
        </div>

        <Input
          type="email"
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Input
          type="password"
          label="Password"
          placeholder="Create a strong password"
          value={password}
          onChange={(e) => handlePasswordChange(e.target.value)}
          error={passwordError}
          required
          autoComplete="new-password"
        />

        <Input
          type="password"
          label="Confirm password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

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
          disabled={!!passwordError}
        >
          Create account
        </Button>

        <p className="text-center text-sm text-gray-600">
          By signing up, you agree to our{' '}
          <a href="/terms" className="text-blue-600 hover:text-blue-700">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-blue-600 hover:text-blue-700">
            Privacy Policy
          </a>
        </p>
      </form>
    </div>
  );
}

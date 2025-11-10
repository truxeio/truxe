import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../lib/utils';
import { isValidEmail } from '../../lib/utils';
import { ARIA_LABELS, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../../lib/constants';
import type { BaseComponentProps } from '../../types';

export interface LoginFormProps extends BaseComponentProps {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  showOrganization?: boolean;
  redirectTo?: string;
  organizationSlug?: string;
  autoFocus?: boolean;
  submitText?: string;
  loadingText?: string;
}

interface LoginFormData {
  email: string;
  orgSlug: string;
}

/**
 * Comprehensive login form with magic link authentication
 */
export function LoginForm({
  className,
  onSuccess,
  onError,
  showOrganization = false,
  organizationSlug = '',
  autoFocus = true,
  submitText = 'Send magic link',
  loadingText = 'Sending magic link...',
  ...props
}: LoginFormProps) {
  const { login, isLoading } = useAuth();
  const { success, error } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    values,
    errors,
    handleSubmit,
    getFieldProps,
    formRef,
  } = useForm<LoginFormData>(
    {
      email: '',
      orgSlug: organizationSlug,
    },
    [
      {
        name: 'email',
        label: 'Email address',
        type: 'email',
        required: true,
        validation: {
          required: true,
          custom: (value: string) => {
            if (!isValidEmail(value)) {
              return ERROR_MESSAGES.INVALID_EMAIL;
            }
            return null;
          },
        },
      },
      {
        name: 'orgSlug',
        label: 'Organization',
        type: 'text',
        required: false,
      },
    ]
  );

  const handleLoginSubmit = async (data: LoginFormData) => {
    try {
      const result = await login(data.email, data.orgSlug || undefined);
      
      if (result.success) {
        setIsSubmitted(true);
        success(SUCCESS_MESSAGES.MAGIC_LINK_SENT);
        onSuccess?.(result);
      } else {
        error('Login failed', result.message);
        onError?.(new Error(result.message));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.GENERIC_ERROR;
      error('Login failed', errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  };

  if (isSubmitted) {
    return (
      <div
        className={cn(
          'rounded-lg border border-success-200 bg-success-50 p-6 text-center',
          'dark:border-success-800 dark:bg-success-900/20',
          className
        )}
        role="status"
        aria-live="polite"
        {...props}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/40">
          <svg
            className="h-6 w-6 text-success-600 dark:text-success-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        
        <h3 className="mb-2 text-lg font-semibold text-success-900 dark:text-success-100">
          Check your email
        </h3>
        
        <p className="mb-4 text-sm text-success-800 dark:text-success-200">
          We've sent a magic link to <strong>{values.email}</strong>. 
          Click the link in the email to sign in.
        </p>
        
        <p className="text-xs text-success-700 dark:text-success-300">
          Didn't receive the email? Check your spam folder or{' '}
          <button
            type="button"
            onClick={() => setIsSubmitted(false)}
            className="font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-success-500 focus:ring-offset-2 rounded"
          >
            try again
          </button>
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(handleLoginSubmit)}
      className={cn('space-y-6', className)}
      noValidate
      aria-label={ARIA_LABELS.LOGIN_FORM}
      {...props}
    >
      <div className="space-y-4">
        <Input
          {...getFieldProps('email')}
          type="email"
          label="Email address"
          placeholder="Enter your email address"
          description="We'll send you a secure link to sign in without a password"
          error={errors.email}
          autoComplete="email"
          autoFocus={autoFocus}
          leftIcon={
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
              />
            </svg>
          }
          required
        />

        {showOrganization && (
          <Input
            {...getFieldProps('orgSlug')}
            type="text"
            label="Organization (optional)"
            placeholder="Enter organization name or leave empty"
            description="Sign in to a specific organization or leave empty for personal account"
            error={errors.orgSlug}
            autoComplete="organization"
            leftIcon={
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            }
          />
        )}
      </div>

      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={isLoading}
        loadingText={loadingText}
        disabled={!values.email || !!errors.email}
        aria-describedby="login-help"
      >
        {submitText}
      </Button>

      <div id="login-help" className="text-center">
        <p className="text-xs text-secondary-600 dark:text-secondary-400">
          By continuing, you agree to our terms of service and privacy policy.
          We'll never share your email address.
        </p>
      </div>

      {/* Hidden honeypot field for bot protection */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute left-[-9999px] opacity-0"
        aria-hidden="true"
      />
    </form>
  );
}

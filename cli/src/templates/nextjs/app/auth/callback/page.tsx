'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@heimdall/ui';

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams.get('token');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Handle error from authentication provider
        if (error) {
          setStatus('error');
          setError(decodeURIComponent(error));
          return;
        }

        if (!token) {
          setStatus('error');
          setError('Missing authentication token');
          return;
        }

        // Process the callback with Heimdall API
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_HEIMDALL_URL || 'http://localhost:3001'}/auth/callback`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              token,
              state,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          setStatus('success');
          
          // Redirect to intended destination or dashboard
          const redirectTo = state ? decodeURIComponent(state) : '/dashboard';
          setTimeout(() => {
            router.push(redirectTo);
          }, 1500);
        } else {
          const errorData = await response.json();
          setStatus('error');
          setError(errorData.message || 'Authentication failed');
        }
      } catch (err) {
        setStatus('error');
        setError('Network error occurred. Please try again.');
        console.error('Callback processing error:', err);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  const handleRetryLogin = () => {
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <LoadingSpinner size="lg" className="mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Processing authentication...
              </h2>
              <p className="text-gray-600">
                Please wait while we complete your login.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Authentication Successful!
              </h2>
              <p className="text-gray-600">
                Welcome back! Redirecting you to your dashboard...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Authentication Failed
              </h2>
              <p className="text-gray-600 mb-6">
                {error || 'An error occurred during authentication.'}
              </p>
              <button
                onClick={handleRetryLogin}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Try Again
              </button>
            </>
          )}
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500">
            Need help?{' '}
            <a 
              href="mailto:support@truxe.io" 
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

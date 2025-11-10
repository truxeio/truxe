import React, { Component, ErrorInfo, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  className?: string;
}

/**
 * Error boundary component for graceful error handling
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          showDetails={this.props.showDetails}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  errorInfo?: ErrorInfo;
  onRetry?: () => void;
  showDetails?: boolean;
  className?: string;
}

/**
 * Default error fallback component
 */
export function ErrorFallback({
  error,
  errorInfo,
  onRetry,
  showDetails = false,
  className,
}: ErrorFallbackProps) {
  const [showFullError, setShowFullError] = React.useState(false);

  return (
    <div
      className={cn(
        'flex min-h-[400px] items-center justify-center rounded-lg border border-error-200 bg-error-50 p-8',
        'dark:border-error-800 dark:bg-error-900/20',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-100 dark:bg-error-900/40">
          <svg
            className="h-6 w-6 text-error-600 dark:text-error-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h2 className="mb-2 text-lg font-semibold text-error-900 dark:text-error-100">
          Something went wrong
        </h2>

        <p className="mb-6 text-sm text-error-800 dark:text-error-200">
          We're sorry, but something unexpected happened. Please try again or contact support if the problem persists.
        </p>

        <div className="space-y-3">
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="error"
              size="sm"
              className="w-full"
            >
              Try Again
            </Button>
          )}

          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
            className="w-full"
          >
            Refresh Page
          </Button>

          {showDetails && error && (
            <Button
              onClick={() => setShowFullError(!showFullError)}
              variant="ghost"
              size="sm"
              className="w-full text-error-700 dark:text-error-300"
            >
              {showFullError ? 'Hide' : 'Show'} Error Details
            </Button>
          )}
        </div>

        {showDetails && showFullError && error && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm font-medium text-error-800 dark:text-error-200 mb-2">
              Technical Details
            </summary>
            
            <div className="rounded-md bg-error-100 dark:bg-error-900/40 p-4 text-xs">
              <div className="mb-2">
                <strong className="text-error-900 dark:text-error-100">Error:</strong>
                <pre className="mt-1 whitespace-pre-wrap text-error-800 dark:text-error-200">
                  {error.message}
                </pre>
              </div>
              
              {error.stack && (
                <div className="mb-2">
                  <strong className="text-error-900 dark:text-error-100">Stack Trace:</strong>
                  <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-error-700 dark:text-error-300">
                    {error.stack}
                  </pre>
                </div>
              )}
              
              {errorInfo?.componentStack && (
                <div>
                  <strong className="text-error-900 dark:text-error-100">Component Stack:</strong>
                  <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-error-700 dark:text-error-300">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Hook for error boundaries
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    // Log error to external service
    console.error('Application error:', error, errorInfo);
    
    // You can integrate with error reporting services here
    // Example: Sentry, Bugsnag, etc.
  };
}

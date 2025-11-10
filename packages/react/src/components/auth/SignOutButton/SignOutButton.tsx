import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { Button, ButtonProps } from '../../ui/Button';

export interface SignOutButtonProps extends Omit<ButtonProps, 'onClick'> {
  redirectUrl?: string;
  onSignOut?: () => void;
}

/**
 * SignOutButton - Signs the user out and optionally redirects.
 * 
 * @example
 * ```tsx
 * <SignOutButton redirectUrl="/">Sign out</SignOutButton>
 * ```
 */
export function SignOutButton({
  redirectUrl,
  onSignOut,
  children = 'Sign out',
  ...buttonProps
}: SignOutButtonProps) {
  const { signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();

      if (onSignOut) {
        onSignOut();
      }

      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSignOut}
      isLoading={isLoading}
      {...buttonProps}
    >
      {children}
    </Button>
  );
}

import { useState } from 'react';
import { Button, ButtonProps } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { SignIn } from '../SignIn/SignIn';
import type { SignInProps } from '../../../types';

export interface SignInButtonProps extends Omit<ButtonProps, 'onClick'> {
  mode?: 'modal' | 'redirect';
  redirectUrl?: string;
  signInProps?: Omit<SignInProps, 'mode'>;
}

/**
 * SignInButton - Triggers sign-in flow via modal or redirect.
 * 
 * @example
 * ```tsx
 * // Modal mode (default)
 * <SignInButton mode="modal">Sign in</SignInButton>
 * 
 * // Redirect mode
 * <SignInButton mode="redirect" redirectUrl="/sign-in">
 *   Sign in
 * </SignInButton>
 * ```
 */
export function SignInButton({
  mode = 'modal',
  redirectUrl,
  signInProps,
  children = 'Sign in',
  ...buttonProps
}: SignInButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (mode === 'redirect') {
      window.location.href = redirectUrl || '/sign-in';
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <Button onClick={handleClick} {...buttonProps}>
        {children}
      </Button>

      {mode === 'modal' && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        >
          <SignIn
            {...signInProps}
            redirectUrl={redirectUrl}
            onSuccess={(user) => {
              setIsModalOpen(false);
              signInProps?.onSuccess?.(user);
            }}
          />
        </Modal>
      )}
    </>
  );
}

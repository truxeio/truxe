import { useState } from 'react';
import { Button, ButtonProps } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { SignUp } from '../SignUp/SignUp';

export interface SignUpButtonProps extends Omit<ButtonProps, 'onClick'> {
  mode?: 'modal' | 'redirect';
  redirectUrl?: string;
}

/**
 * SignUpButton - Triggers sign-up flow via modal or redirect.
 * 
 * @example
 * ```tsx
 * // Modal mode (default)
 * <SignUpButton mode="modal">Sign up</SignUpButton>
 * 
 * // Redirect mode
 * <SignUpButton mode="redirect" redirectUrl="/sign-up">
 *   Get started
 * </SignUpButton>
 * ```
 */
export function SignUpButton({
  mode = 'modal',
  redirectUrl,
  children = 'Sign up',
  ...buttonProps
}: SignUpButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (mode === 'redirect') {
      window.location.href = redirectUrl || '/sign-up';
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
          <SignUp
            redirectUrl={redirectUrl}
            onSuccess={() => setIsModalOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}

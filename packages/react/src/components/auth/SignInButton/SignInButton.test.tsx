import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignInButton } from './SignInButton';

vi.mock('../SignIn/SignIn', () => ({
  SignIn: () => <div data-testid="sign-in-form">Sign In Form</div>,
}));

describe('SignInButton', () => {
  it('renders with default text', () => {
    render(<SignInButton />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('renders with custom text', () => {
    render(<SignInButton>Log in</SignInButton>);
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });

  it('opens modal when clicked in modal mode', () => {
    render(<SignInButton mode="modal" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-form')).toBeInTheDocument();
  });

  it('applies custom variant', () => {
    render(<SignInButton variant="outline" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('border');
  });

  it('applies custom size', () => {
    render(<SignInButton size="lg" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-12');
  });
});

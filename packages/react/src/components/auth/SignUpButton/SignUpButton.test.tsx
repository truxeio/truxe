import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignUpButton } from './SignUpButton';

vi.mock('../SignUp/SignUp', () => ({
  SignUp: () => <div data-testid="sign-up-form">Sign Up Form</div>,
}));

describe('SignUpButton', () => {
  it('renders with default text', () => {
    render(<SignUpButton />);
    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('renders with custom children', () => {
    render(<SignUpButton>Get started</SignUpButton>);
    expect(screen.getByText('Get started')).toBeInTheDocument();
  });

  it('opens modal in modal mode', () => {
    render(<SignUpButton mode="modal" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('sign-up-form')).toBeInTheDocument();
  });

  it('applies variant styling', () => {
    render(<SignUpButton variant="outline" />);
    expect(screen.getByRole('button').className).toContain('border');
  });

  it('applies size styling', () => {
    render(<SignUpButton size="lg" />);
    expect(screen.getByRole('button').className).toContain('h-12');
  });
});

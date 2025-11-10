import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders input correctly', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders error message when provided', () => {
    render(<Input error="Invalid input" />);
    expect(screen.getByText('Invalid input')).toBeInTheDocument();
  });

  it('renders helper text when provided', () => {
    render(<Input helperText="Enter your email address" />);
    expect(screen.getByText('Enter your email address')).toBeInTheDocument();
  });

  it('does not show helper text when error is present', () => {
    render(<Input error="Error" helperText="Helper" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Helper')).not.toBeInTheDocument();
  });

  it('applies error styles when error prop is provided', () => {
    render(<Input error="Error" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-red-300');
    expect(input.className).toContain('focus:ring-red-500');
  });

  it('calls onChange handler when value changes', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('can be controlled', () => {
    const { rerender } = render(<Input value="initial" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('initial');

    rerender(<Input value="updated" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('updated');
  });
});

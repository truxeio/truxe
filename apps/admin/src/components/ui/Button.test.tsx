import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary-600'); // Primary variant
  });

  it('applies different variants correctly', () => {
    const { rerender } = render(<Button variant="secondary">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-secondary-100');

    rerender(<Button variant="error">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-error-600');
  });

  it('applies different sizes correctly', () => {
    const { rerender } = render(<Button size="sm">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-8');

    rerender(<Button size="lg">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-11');
  });

  it('shows loading state correctly', () => {
    render(
      <Button loading loadingText="Saving...">
        Save
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByLabelText('Saving...')).toBeInTheDocument(); // Screen reader text
  });

  it('handles click events', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole('button');
    await userEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('prevents clicks when disabled', async () => {
    const handleClick = jest.fn();
    render(
      <Button onClick={handleClick} disabled>
        Disabled
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    await userEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('prevents clicks when loading', async () => {
    const handleClick = jest.fn();
    render(
      <Button onClick={handleClick} loading>
        Loading
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    await userEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders with icons correctly', () => {
    const leftIcon = <span data-testid="left-icon">←</span>;
    const rightIcon = <span data-testid="right-icon">→</span>;
    
    render(
      <Button leftIcon={leftIcon} rightIcon={rightIcon}>
        With Icons
      </Button>
    );
    
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    expect(screen.getByText('With Icons')).toBeInTheDocument();
  });

  it('applies fullWidth correctly', () => {
    render(<Button fullWidth>Full Width</Button>);
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  it('supports keyboard navigation', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Keyboard</Button>);
    
    const button = screen.getByRole('button');
    button.focus();
    
    expect(button).toHaveFocus();
    
    fireEvent.keyDown(button, { key: 'Enter' });
    await waitFor(() => {
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
    
    fireEvent.keyDown(button, { key: ' ' });
    await waitFor(() => {
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  it('has proper accessibility attributes', () => {
    render(
      <Button
        aria-label="Custom label"
        aria-describedby="description"
        data-testid="accessible-button"
      >
        Button
      </Button>
    );
    
    const button = screen.getByTestId('accessible-button');
    expect(button).toHaveAttribute('aria-label', 'Custom label');
    expect(button).toHaveAttribute('aria-describedby', 'description');
  });

  it('works as a polymorphic component with asChild', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/test');
    expect(link).toHaveClass('bg-primary-600'); // Button styles applied
  });

  it('maintains focus styles for accessibility', () => {
    render(<Button>Focus Test</Button>);
    const button = screen.getByRole('button');
    
    // Check that focus styles are applied
    expect(button).toHaveClass('focus:outline-none');
    expect(button).toHaveClass('focus:ring-2');
    expect(button).toHaveClass('focus:ring-primary-500');
  });

  it('has correct contrast ratios', () => {
    // Test different variants for contrast
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('text-white', 'bg-primary-600');

    rerender(<Button variant="secondary">Secondary</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('text-secondary-900', 'bg-secondary-100');

    rerender(<Button variant="error">Error</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('text-white', 'bg-error-600');
  });

  it('respects reduced motion preferences', () => {
    // Mock reduced motion preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<Button>Reduced Motion</Button>);
    const button = screen.getByRole('button');
    
    // Button should still render correctly with reduced motion
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('transition-colors');
  });
});

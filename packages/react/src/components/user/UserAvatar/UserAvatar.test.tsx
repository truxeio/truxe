import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UserAvatar } from './UserAvatar';
import type { User } from '../../../types';

const mockUser: User = {
  id: '1',
  email: 'john.doe@example.com',
  emailVerified: true,
  firstName: 'John',
  lastName: 'Doe',
  fullName: 'John Doe',
  imageUrl: 'https://example.com/avatar.jpg',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('UserAvatar', () => {
  describe('Image Display', () => {
    it('renders image when imageUrl prop is provided', () => {
      render(<UserAvatar imageUrl="https://example.com/test.jpg" />);
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/test.jpg');
    });

    it('renders image from user.imageUrl when user is provided', () => {
      render(<UserAvatar user={mockUser} />);
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', mockUser.imageUrl);
    });

    it('imageUrl prop overrides user.imageUrl', () => {
      const customUrl = 'https://example.com/custom.jpg';
      render(<UserAvatar user={mockUser} imageUrl={customUrl} />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', customUrl);
    });
  });

  describe('Fallback Behavior', () => {
    it('shows initials when no image is available', () => {
      const userWithoutImage = { ...mockUser, imageUrl: undefined };
      render(<UserAvatar user={userWithoutImage} fallback="initials" />);
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('shows icon when fallback is set to icon', () => {
      const { container } = render(<UserAvatar fallback="icon" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('handles image load error by showing fallback', () => {
      const userWithBadImage = { ...mockUser };
      render(<UserAvatar user={userWithBadImage} />);
      
      const img = screen.getByRole('img');
      fireEvent.error(img);
      
      // After error, should show initials
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('shows correct initials for user with only first name', () => {
      const userWithFirstNameOnly = {
        ...mockUser,
        firstName: 'Jane',
        lastName: undefined,
        fullName: 'Jane',
        imageUrl: undefined,
      };
      render(<UserAvatar user={userWithFirstNameOnly} fallback="initials" />);
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('shows email initial when no name is available', () => {
      const userWithEmailOnly = {
        ...mockUser,
        firstName: undefined,
        lastName: undefined,
        fullName: undefined,
        imageUrl: undefined,
      };
      render(<UserAvatar user={userWithEmailOnly} fallback="initials" />);
      expect(screen.getByText('J')).toBeInTheDocument(); // First letter of email
    });
  });

  describe('Size Variants', () => {
    it('applies correct classes for sm size', () => {
      const { container } = render(<UserAvatar size="sm" fallback="icon" />);
      const avatar = container.firstChild;
      expect(avatar).toHaveClass('w-8', 'h-8', 'text-xs');
    });

    it('applies correct classes for md size (default)', () => {
      const { container } = render(<UserAvatar fallback="icon" />);
      const avatar = container.firstChild;
      expect(avatar).toHaveClass('w-10', 'h-10', 'text-sm');
    });

    it('applies correct classes for lg size', () => {
      const { container } = render(<UserAvatar size="lg" fallback="icon" />);
      const avatar = container.firstChild;
      expect(avatar).toHaveClass('w-12', 'h-12', 'text-base');
    });

    it('applies correct classes for xl size', () => {
      const { container } = render(<UserAvatar size="xl" fallback="icon" />);
      const avatar = container.firstChild;
      expect(avatar).toHaveClass('w-16', 'h-16', 'text-lg');
    });
  });

  describe('Shape Variants', () => {
    it('applies rounded-full for circle shape (default)', () => {
      const { container } = render(<UserAvatar fallback="icon" />);
      const avatar = container.firstChild;
      expect(avatar).toHaveClass('rounded-full');
    });

    it('applies rounded-md for square shape', () => {
      const { container } = render(<UserAvatar shape="square" fallback="icon" />);
      const avatar = container.firstChild;
      expect(avatar).toHaveClass('rounded-md');
    });
  });

  describe('Interactivity', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<UserAvatar onClick={handleClick} fallback="icon" />);
      
      const avatar = screen.getByRole('button');
      fireEvent.click(avatar);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('has cursor-pointer class when onClick is provided', () => {
      const { container } = render(<UserAvatar onClick={() => {}} fallback="icon" />);
      const avatar = container.firstChild;
      expect(avatar).toHaveClass('cursor-pointer');
    });

    it('supports keyboard interaction (Enter key)', () => {
      const handleClick = vi.fn();
      render(<UserAvatar onClick={handleClick} fallback="icon" />);
      
      const avatar = screen.getByRole('button');
      fireEvent.keyDown(avatar, { key: 'Enter' });
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('supports keyboard interaction (Space key)', () => {
      const handleClick = vi.fn();
      render(<UserAvatar onClick={handleClick} fallback="icon" />);
      
      const avatar = screen.getByRole('button');
      fireEvent.keyDown(avatar, { key: ' ' });
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has correct aria-label with user full name', () => {
      render(<UserAvatar user={mockUser} />);
      const avatar = screen.getByLabelText("John Doe's avatar");
      expect(avatar).toBeInTheDocument();
    });

    it('has correct aria-label with user first name when no full name', () => {
      const userWithFirstName = {
        ...mockUser,
        fullName: undefined,
      };
      render(<UserAvatar user={userWithFirstName} />);
      const avatar = screen.getByLabelText("John's avatar");
      expect(avatar).toBeInTheDocument();
    });

    it('has generic aria-label when no user provided', () => {
      render(<UserAvatar fallback="icon" />);
      const avatar = screen.getByLabelText('User avatar');
      expect(avatar).toBeInTheDocument();
    });

    it('has role="button" when onClick is provided', () => {
      render(<UserAvatar onClick={() => {}} fallback="icon" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('has tabIndex when onClick is provided', () => {
      render(<UserAvatar onClick={() => {}} fallback="icon" />);
      const avatar = screen.getByRole('button');
      expect(avatar).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(<UserAvatar isLoading={true} />);
      const skeleton = screen.getByLabelText('Loading avatar');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('animate-pulse');
    });

    it('does not show user content when loading', () => {
      render(<UserAvatar user={mockUser} isLoading={true} />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.queryByText('JD')).not.toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <UserAvatar className="custom-class" fallback="icon" />
      );
      const avatar = container.firstChild;
      expect(avatar).toHaveClass('custom-class');
    });

    it('maintains base classes with custom className', () => {
      const { container } = render(
        <UserAvatar className="custom-class" size="lg" fallback="icon" />
      );
      const avatar = container.firstChild;
      expect(avatar).toHaveClass('custom-class', 'w-12', 'h-12');
    });
  });
});

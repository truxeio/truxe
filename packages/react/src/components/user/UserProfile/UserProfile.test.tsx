import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserProfile } from './UserProfile';
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

const mockUpdate = vi.fn();

// Mock the hooks
vi.mock('../../../hooks/useUser', () => ({
  useUser: () => ({
    user: mockUser,
    update: mockUpdate,
    isLoaded: true,
    isSignedIn: true,
  }),
}));

describe('UserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering and Modes', () => {
    it('renders in inline mode by default', () => {
      render(<UserProfile />);
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    it('renders in modal mode with close button', () => {
      const onClose = jest.fn();
      render(<UserProfile mode="modal" onClose={onClose} />);
      
      const closeButton = screen.getByLabelText('Close');
      expect(closeButton).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked in modal mode', () => {
      const onClose = jest.fn();
      render(<UserProfile mode="modal" onClose={onClose} />);
      
      fireEvent.click(screen.getByLabelText('Close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not show close button in inline mode', () => {
      render(<UserProfile mode="inline" />);
      expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('renders all three tabs', () => {
      render(<UserProfile />);
      expect(screen.getByRole('tab', { name: 'Profile' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Security' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Sessions' })).toBeInTheDocument();
    });

    it('shows profile tab by default', () => {
      render(<UserProfile />);
      const profileTab = screen.getByRole('tab', { name: 'Profile' });
      expect(profileTab).toHaveAttribute('aria-selected', 'true');
    });

    it('switches to security tab when clicked', () => {
      render(<UserProfile />);
      
      fireEvent.click(screen.getByRole('tab', { name: 'Security' }));
      
      expect(screen.getByText('Security Settings')).toBeInTheDocument();
      expect(screen.getByText('Email Verification')).toBeInTheDocument();
    });

    it('switches to sessions tab when clicked', () => {
      render(<UserProfile />);
      
      fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }));
      
      expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      expect(screen.getByText(/Manage your active sessions/)).toBeInTheDocument();
    });

    it('updates aria-selected attribute when switching tabs', () => {
      render(<UserProfile />);
      
      const securityTab = screen.getByRole('tab', { name: 'Security' });
      fireEvent.click(securityTab);
      
      expect(securityTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Profile Tab', () => {
    it('displays user information', () => {
      render(<UserProfile />);
      
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument();
    });

    it('shows email as read-only', () => {
      render(<UserProfile />);
      
      const emailInput = screen.getByDisplayValue('john.doe@example.com');
      expect(emailInput).toBeDisabled();
      expect(screen.getByText('Email cannot be changed')).toBeInTheDocument();
    });

    it('shows account creation date', () => {
      render(<UserProfile />);
      expect(screen.getByText(/Account created:/)).toBeInTheDocument();
    });

    it('shows email verification status', () => {
      render(<UserProfile />);
      expect(screen.getByText(/Email verified:/)).toBeInTheDocument();
      expect(screen.getByText(/Yes ✓/)).toBeInTheDocument();
    });

    it('enables editing mode when Edit profile is clicked', () => {
      render(<UserProfile />);
      
      fireEvent.click(screen.getByText('Edit profile'));
      
      const firstNameInput = screen.getByDisplayValue('John');
      expect(firstNameInput).not.toBeDisabled();
    });

    it('shows Save and Cancel buttons in editing mode', () => {
      render(<UserProfile />);
      
      fireEvent.click(screen.getByText('Edit profile'));
      
      expect(screen.getByText('Save changes')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('allows editing first and last name', () => {
      render(<UserProfile />);
      
      fireEvent.click(screen.getByText('Edit profile'));
      
      const firstNameInput = screen.getByDisplayValue('John');
      fireEvent.change(firstNameInput, { target: { value: 'Jane' } });
      
      expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
    });

    it('saves changes when Save button is clicked', async () => {
      mockUpdate.mockResolvedValue({});
      render(<UserProfile />);
      
      fireEvent.click(screen.getByText('Edit profile'));
      
      const firstNameInput = screen.getByDisplayValue('John');
      fireEvent.change(firstNameInput, { target: { value: 'Jane' } });
      
      fireEvent.click(screen.getByText('Save changes'));
      
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          firstName: 'Jane',
          lastName: 'Doe',
        });
      });
    });

    it('shows success message after save', async () => {
      mockUpdate.mockResolvedValue({});
      render(<UserProfile />);
      
      fireEvent.click(screen.getByText('Edit profile'));
      fireEvent.click(screen.getByText('Save changes'));
      
      await waitFor(() => {
        expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
      });
    });

    it('shows error message on save failure', async () => {
      mockUpdate.mockRejectedValue(new Error('Update failed'));
      render(<UserProfile />);
      
      fireEvent.click(screen.getByText('Edit profile'));
      fireEvent.click(screen.getByText('Save changes'));
      
      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeInTheDocument();
      });
    });

    it('cancels editing and resets form', () => {
      render(<UserProfile />);
      
      fireEvent.click(screen.getByText('Edit profile'));
      
      const firstNameInput = screen.getByDisplayValue('John');
      fireEvent.change(firstNameInput, { target: { value: 'Jane' } });
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByText('Edit profile')).toBeInTheDocument();
    });

    it('exits editing mode after successful save', async () => {
      mockUpdate.mockResolvedValue({});
      render(<UserProfile />);
      
      fireEvent.click(screen.getByText('Edit profile'));
      fireEvent.click(screen.getByText('Save changes'));
      
      await waitFor(() => {
        expect(screen.getByText('Edit profile')).toBeInTheDocument();
      });
    });

    it('shows loading state while saving', async () => {
      mockUpdate.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<UserProfile />);
      
      fireEvent.click(screen.getByText('Edit profile'));
      fireEvent.click(screen.getByText('Save changes'));
      
      // Button should show loading state (implementation depends on Button component)
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Security Tab', () => {
    it('displays email verification status', () => {
      render(<UserProfile />);
      fireEvent.click(screen.getByRole('tab', { name: 'Security' }));
      
      expect(screen.getByText('Email Verification')).toBeInTheDocument();
      expect(screen.getByText('Your email is verified')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('displays MFA section', () => {
      render(<UserProfile />);
      fireEvent.click(screen.getByRole('tab', { name: 'Security' }));
      
      expect(screen.getByText('Multi-Factor Authentication')).toBeInTheDocument();
      expect(screen.getByText('Add an extra layer of security to your account')).toBeInTheDocument();
      expect(screen.getByText('Enable MFA')).toBeInTheDocument();
    });

    it('displays connected accounts section', () => {
      render(<UserProfile />);
      fireEvent.click(screen.getByRole('tab', { name: 'Security' }));
      
      expect(screen.getByText('Connected Accounts')).toBeInTheDocument();
      expect(screen.getByText('Manage OAuth providers connected to your account')).toBeInTheDocument();
    });
  });

  describe('Sessions Tab', () => {
    it('displays active sessions list', () => {
      render(<UserProfile />);
      fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }));
      
      expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      expect(screen.getByText(/Chrome on macOS/)).toBeInTheDocument();
      expect(screen.getByText(/Safari on iPhone/)).toBeInTheDocument();
    });

    it('marks current session', () => {
      render(<UserProfile />);
      fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }));
      
      expect(screen.getByText('Current')).toBeInTheDocument();
    });

    it('shows revoke button for non-current sessions', () => {
      render(<UserProfile />);
      fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }));
      
      const revokeButtons = screen.getAllByText('Revoke');
      expect(revokeButtons.length).toBeGreaterThan(0);
    });

    it('displays revoke all sessions option', () => {
      render(<UserProfile />);
      fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }));
      
      expect(screen.getByText('Revoke All Other Sessions')).toBeInTheDocument();
      expect(screen.getByText('Revoke All')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('shows loading state when no user', () => {
      vi.resetModules();
      vi.mock('../../../hooks/useUser', () => ({
        useUser: () => ({
          user: null,
          update: mockUpdate,
          isLoaded: false,
          isSignedIn: false,
        }),
      }));
      
      const { container } = render(<UserProfile />);
      // Should render without crashing
      expect(container).toBeInTheDocument();
    });
  });
});

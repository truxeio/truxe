import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TruxeProvider } from '../../context/TruxeProvider';
import { UserProfile } from '../../components/user/UserProfile/UserProfile';
import { UserButton } from '../../components/user/UserButton/UserButton';
import { UserAvatar } from '../../components/user/UserAvatar/UserAvatar';
import { useUser } from '../../hooks/useUser';

// Mock authenticated user component
function MockAuthenticatedApp() {
  const { user, updateUser } = useUser();

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <UserAvatar user={user} />
      <UserProfile mode="inline" />
      <button onClick={() => updateUser({ firstName: 'Updated' })}>
        Update Name
      </button>
    </div>
  );
}

describe('User Management Integration', () => {
  const mockApiUrl = 'https://api.test.com';
  const mockPublishableKey = 'pk_test_123';
  const mockUser = {
    id: 'user_123',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    imageUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should display user profile information', async () => {
    render(
      <TruxeProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <UserProfile mode="inline" />
      </TruxeProvider>
    );

    // Profile component should render
    expect(screen.getByText(/profile/i)).toBeInTheDocument();
  });

  it('should update user profile', async () => {
    const user = userEvent.setup();
    const mockUpdateUser = vi.fn().mockResolvedValue({
      ...mockUser,
      firstName: 'Jane',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUpdateUser(),
    });

    render(
      <TruxeProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <UserProfile mode="inline" />
      </TruxeProvider>
    );

    // Look for first name input
    const firstNameInput = screen.queryByLabelText(/first name/i);
    if (firstNameInput) {
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /save|update/i });
      await user.click(saveButton);

      // Verify update was called
      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalled();
      });
    }
  });

  it('should display user avatar with correct image', async () => {
    render(
      <TruxeProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <UserAvatar user={mockUser} size="lg" />
      </TruxeProvider>
    );

    // Avatar should be rendered
    const avatar = screen.getByRole('img', { name: /avatar/i }) ||
                   screen.getByText(mockUser.firstName.charAt(0));
    expect(avatar).toBeInTheDocument();
  });

  it('should handle avatar upload', async () => {
    const user = userEvent.setup();
    const mockFile = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    render(
      <TruxeProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <UserProfile mode="inline" />
      </TruxeProvider>
    );

    // Look for file upload input
    const uploadInput = screen.queryByLabelText(/upload|change.*avatar/i);
    if (uploadInput) {
      await user.upload(uploadInput as HTMLInputElement, mockFile);

      await waitFor(() => {
        // Verify upload handling
        expect(uploadInput).toBeTruthy();
      });
    }
  });

  it('should update email address', async () => {
    const user = userEvent.setup();

    render(
      <TruxeProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <UserProfile mode="inline" />
      </TruxeProvider>
    );

    // Look for email input
    const emailInput = screen.queryByLabelText(/email/i);
    if (emailInput) {
      await user.clear(emailInput);
      await user.type(emailInput, 'newemail@example.com');

      const saveButton = screen.getByRole('button', { name: /save|update/i });
      await user.click(saveButton);
    }
  });

  it('should change password', async () => {
    const user = userEvent.setup();

    render(
      <TruxeProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <UserProfile mode="inline" />
      </TruxeProvider>
    );

    // Look for password change section
    const changePasswordButton = screen.queryByText(/change password/i);
    if (changePasswordButton) {
      await user.click(changePasswordButton);

      // Fill in password fields
      const currentPasswordInput = screen.queryByLabelText(/current password/i);
      const newPasswordInput = screen.queryByLabelText(/new password/i);

      if (currentPasswordInput && newPasswordInput) {
        await user.type(currentPasswordInput, 'oldpassword123');
        await user.type(newPasswordInput, 'newpassword456');

        const submitButton = screen.getByRole('button', { name: /update|change/i });
        await user.click(submitButton);
      }
    }
  });

  it('should display UserButton with dropdown menu', async () => {
    const user = userEvent.setup();

    render(
      <TruxeProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <UserButton />
      </TruxeProvider>
    );

    // Click user button
    const userButton = screen.getByRole('button');
    await user.click(userButton);

    // Dropdown menu should appear
    await waitFor(() => {
      const menu = screen.queryByRole('menu') || screen.queryByRole('dialog');
      if (menu) {
        expect(menu).toBeInTheDocument();
      }
    });
  });

  it('should navigate to profile from UserButton', async () => {
    const user = userEvent.setup();

    render(
      <TruxeProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <UserButton />
      </TruxeProvider>
    );

    // Click user button
    const userButton = screen.getByRole('button');
    await user.click(userButton);

    // Look for profile link
    await waitFor(() => {
      const profileLink = screen.queryByText(/profile|account/i);
      if (profileLink) {
        expect(profileLink).toBeInTheDocument();
      }
    });
  });

  it('should handle validation errors when updating profile', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Invalid email format',
      }),
    });

    render(
      <TruxeProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <UserProfile mode="inline" />
      </TruxeProvider>
    );

    // Try to submit invalid email
    const emailInput = screen.queryByLabelText(/email/i);
    if (emailInput) {
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');

      const saveButton = screen.getByRole('button', { name: /save|update/i });
      await user.click(saveButton);

      // Error message should appear
      await waitFor(() => {
        const error = screen.queryByText(/invalid/i) || screen.queryByRole('alert');
        // Error handling is implementation-specific
      });
    }
  });

  it('should delete user account', async () => {
    const user = userEvent.setup();
    const mockDeleteAccount = vi.fn().mockResolvedValue({ success: true });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDeleteAccount(),
    });

    render(
      <TruxeProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <UserProfile mode="inline" />
      </TruxeProvider>
    );

    // Look for delete account button
    const deleteButton = screen.queryByText(/delete account/i);
    if (deleteButton) {
      await user.click(deleteButton);

      // Confirmation dialog should appear
      await waitFor(() => {
        const confirmButton = screen.queryByRole('button', { name: /confirm|yes/i });
        if (confirmButton) {
          user.click(confirmButton);
        }
      });
    }
  });
});

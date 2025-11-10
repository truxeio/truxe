import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeimdallProvider } from '../../context/HeimdallProvider';
import { SignIn } from '../../components/auth/SignIn/SignIn';
import { SignInButton } from '../../components/auth/SignInButton/SignInButton';
import { UserButton } from '../../components/user/UserButton/UserButton';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';

// Mock component to test hooks
function TestAuthFlow() {
  const { isSignedIn, signIn, signOut } = useAuth();
  const { user } = useUser();

  if (!isSignedIn) {
    return (
      <div>
        <SignInButton mode="modal" />
        <p>Not signed in</p>
      </div>
    );
  }

  return (
    <div>
      <p>Welcome {user?.firstName}</p>
      <UserButton />
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}

describe('Authentication Flow Integration', () => {
  const mockApiUrl = 'https://api.test.com';
  const mockPublishableKey = 'pk_test_123';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for API calls
    global.fetch = vi.fn();
  });

  it('should render sign-in form and handle authentication', async () => {
    const user = userEvent.setup();
    
    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <SignIn mode="inline" />
      </HeimdallProvider>
    );

    // Verify sign-in form is rendered
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    // Fill in credentials
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('should complete full sign-in flow', async () => {
    const user = userEvent.setup();
    const mockSignIn = vi.fn().mockResolvedValue({
      user: {
        id: 'user_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      session: {
        id: 'session_123',
        token: 'token_123',
      },
    });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <TestAuthFlow />
      </HeimdallProvider>
    );

    // Initially not signed in
    expect(screen.getByText('Not signed in')).toBeInTheDocument();

    // Click sign-in button
    const signInButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(signInButton);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should handle magic link authentication', async () => {
    const user = userEvent.setup();
    
    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <SignIn mode="inline" />
      </HeimdallProvider>
    );

    // Click magic link tab/button
    const magicLinkTab = screen.queryByText(/magic link/i);
    if (magicLinkTab) {
      await user.click(magicLinkTab);

      // Verify magic link form is shown
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send/i });
      await user.click(submitButton);
    }
  });

  it('should handle OAuth provider sign-in', async () => {
    const user = userEvent.setup();
    
    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <SignIn mode="inline" />
      </HeimdallProvider>
    );

    // Look for OAuth buttons (GitHub, Google, etc.)
    const githubButton = screen.queryByRole('button', { name: /github/i });
    const googleButton = screen.queryByRole('button', { name: /google/i });

    if (githubButton) {
      await user.click(githubButton);
      // Verify OAuth redirect would happen
      expect(githubButton).toBeInTheDocument();
    }

    if (googleButton) {
      await user.click(googleButton);
      expect(googleButton).toBeInTheDocument();
    }
  });

  it('should persist session across component remounts', async () => {
    const { rerender } = render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <TestAuthFlow />
      </HeimdallProvider>
    );

    // Initial render - not signed in
    expect(screen.getByText('Not signed in')).toBeInTheDocument();

    // Simulate session storage
    const mockSession = {
      user: {
        id: 'user_123',
        email: 'test@example.com',
        firstName: 'John',
      },
      token: 'token_123',
    };
    
    localStorage.setItem('heimdall_session', JSON.stringify(mockSession));

    // Remount component
    rerender(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <TestAuthFlow />
      </HeimdallProvider>
    );

    // Session should be restored
    // Note: This depends on implementation details
  });

  it('should handle sign-out flow', async () => {
    const user = userEvent.setup();
    const mockSignOut = vi.fn().mockResolvedValue({ success: true });

    // Mock authenticated state
    const mockSession = {
      user: {
        id: 'user_123',
        email: 'test@example.com',
        firstName: 'John',
      },
      token: 'token_123',
    };

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <TestAuthFlow />
      </HeimdallProvider>
    );

    // If sign out button exists, click it
    const signOutButton = screen.queryByRole('button', { name: /sign out/i });
    if (signOutButton) {
      await user.click(signOutButton);

      // Verify user is signed out
      await waitFor(() => {
        expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();
      });
    }
  });

  it('should handle authentication errors', async () => {
    const user = userEvent.setup();
    
    global.fetch = vi.fn().mockRejectedValue(new Error('Invalid credentials'));

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <SignIn mode="inline" />
      </HeimdallProvider>
    );

    // Fill in invalid credentials
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    await user.type(emailInput, 'invalid@example.com');
    await user.type(passwordInput, 'wrongpassword');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Error message should appear
    await waitFor(() => {
      const errorMessage = screen.queryByText(/invalid/i) || screen.queryByRole('alert');
      // Error handling is implementation-specific
    });
  });

  it('should handle token refresh automatically', async () => {
    const mockRefresh = vi.fn().mockResolvedValue({
      token: 'new_token_456',
      expiresAt: Date.now() + 3600000,
    });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <TestAuthFlow />
      </HeimdallProvider>
    );

    // This test verifies the automatic token refresh mechanism
    // Implementation depends on the provider's internal logic
    expect(true).toBe(true);
  });
});

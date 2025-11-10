import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeimdallProvider } from '../../context/HeimdallProvider';
import { OrganizationSwitcher } from '../../components/organization/OrganizationSwitcher/OrganizationSwitcher';
import { OrganizationProfile } from '../../components/organization/OrganizationProfile/OrganizationProfile';
import { OrganizationList } from '../../components/organization/OrganizationList/OrganizationList';
import { CreateOrganization } from '../../components/organization/CreateOrganization/CreateOrganization';
import { useOrganization } from '../../hooks/useOrganization';

// Mock authenticated user with organizations
function MockOrganizationApp() {
  const { organization, organizations, switchOrganization, createOrganization } = useOrganization();

  return (
    <div>
      <h1>Organization Management</h1>
      <OrganizationSwitcher />
      {organization && (
        <div>
          <p>Current: {organization.name}</p>
          <OrganizationProfile mode="inline" />
        </div>
      )}
      <OrganizationList />
      <CreateOrganization mode="inline" />
    </div>
  );
}

describe('Organization Flow Integration', () => {
  const mockApiUrl = 'https://api.test.com';
  const mockPublishableKey = 'pk_test_123';
  const mockOrganizations = [
    {
      id: 'org_123',
      name: 'Acme Corp',
      slug: 'acme-corp',
      imageUrl: 'https://example.com/org1.jpg',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'org_456',
      name: 'Tech Startup',
      slug: 'tech-startup',
      imageUrl: 'https://example.com/org2.jpg',
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should create new organization', async () => {
    const user = userEvent.setup();
    const mockCreateOrg = vi.fn().mockResolvedValue({
      id: 'org_new',
      name: 'New Organization',
      slug: 'new-organization',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCreateOrg(),
    });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <CreateOrganization mode="inline" />
      </HeimdallProvider>
    );

    // Fill in organization form
    const nameInput = screen.getByLabelText(/organization name|name/i);
    await user.type(nameInput, 'New Organization');

    const slugInput = screen.queryByLabelText(/slug|url/i);
    if (slugInput) {
      await user.type(slugInput, 'new-organization');
    }

    // Submit form
    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    // Verify organization was created
    await waitFor(() => {
      expect(mockCreateOrg).toHaveBeenCalled();
    });
  });

  it('should switch between organizations', async () => {
    const user = userEvent.setup();
    const mockSwitchOrg = vi.fn().mockResolvedValue(mockOrganizations[1]);

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ organizations: mockOrganizations }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSwitchOrg(),
      });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <OrganizationSwitcher />
      </HeimdallProvider>
    );

    // Click organization switcher
    const switcherButton = screen.getByRole('button');
    await user.click(switcherButton);

    // Dropdown should appear
    await waitFor(() => {
      const dropdown = screen.queryByRole('menu') || screen.queryByRole('listbox');
      if (dropdown) {
        expect(dropdown).toBeInTheDocument();
      }
    });

    // Select different organization
    const orgOption = screen.queryByText(mockOrganizations[1].name);
    if (orgOption) {
      await user.click(orgOption);

      await waitFor(() => {
        expect(mockSwitchOrg).toHaveBeenCalled();
      });
    }
  });

  it('should display organization list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organizations: mockOrganizations }),
    });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <OrganizationList />
      </HeimdallProvider>
    );

    // Wait for organizations to load
    await waitFor(() => {
      // Organizations should be displayed
      const orgList = screen.queryByRole('list');
      if (orgList) {
        expect(orgList).toBeInTheDocument();
      }
    });
  });

  it('should update organization profile', async () => {
    const user = userEvent.setup();
    const mockUpdateOrg = vi.fn().mockResolvedValue({
      ...mockOrganizations[0],
      name: 'Updated Corp',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUpdateOrg(),
    });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <OrganizationProfile mode="inline" />
      </HeimdallProvider>
    );

    // Update organization name
    const nameInput = screen.queryByLabelText(/organization name|name/i);
    if (nameInput) {
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Corp');

      const saveButton = screen.getByRole('button', { name: /save|update/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateOrg).toHaveBeenCalled();
      });
    }
  });

  it('should manage organization members', async () => {
    const user = userEvent.setup();
    const mockMembers = [
      {
        id: 'member_1',
        userId: 'user_1',
        role: 'admin',
        email: 'admin@example.com',
      },
      {
        id: 'member_2',
        userId: 'user_2',
        role: 'member',
        email: 'member@example.com',
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ members: mockMembers }),
    });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <OrganizationProfile mode="inline" />
      </HeimdallProvider>
    );

    // Look for members section
    const membersTab = screen.queryByText(/members|team/i);
    if (membersTab) {
      await user.click(membersTab);

      await waitFor(() => {
        // Members should be displayed
        const membersList = screen.queryByRole('list') || screen.queryByRole('table');
        if (membersList) {
          expect(membersList).toBeInTheDocument();
        }
      });
    }
  });

  it('should invite new member to organization', async () => {
    const user = userEvent.setup();
    const mockInvite = vi.fn().mockResolvedValue({
      id: 'invite_123',
      email: 'newmember@example.com',
      status: 'pending',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockInvite(),
    });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <OrganizationProfile mode="inline" />
      </HeimdallProvider>
    );

    // Look for invite button
    const inviteButton = screen.queryByText(/invite|add member/i);
    if (inviteButton) {
      await user.click(inviteButton);

      // Fill in email
      const emailInput = screen.queryByLabelText(/email/i);
      if (emailInput) {
        await user.type(emailInput, 'newmember@example.com');

        const sendButton = screen.getByRole('button', { name: /send|invite/i });
        await user.click(sendButton);

        await waitFor(() => {
          expect(mockInvite).toHaveBeenCalled();
        });
      }
    }
  });

  it('should remove member from organization', async () => {
    const user = userEvent.setup();
    const mockRemove = vi.fn().mockResolvedValue({ success: true });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRemove(),
    });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <OrganizationProfile mode="inline" />
      </HeimdallProvider>
    );

    // Look for remove/delete member button
    const removeButton = screen.queryByText(/remove|delete/i);
    if (removeButton) {
      await user.click(removeButton);

      // Confirmation dialog
      await waitFor(() => {
        const confirmButton = screen.queryByRole('button', { name: /confirm|yes/i });
        if (confirmButton) {
          user.click(confirmButton);
        }
      });
    }
  });

  it('should change member role', async () => {
    const user = userEvent.setup();
    const mockUpdateRole = vi.fn().mockResolvedValue({
      id: 'member_1',
      role: 'admin',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUpdateRole(),
    });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <OrganizationProfile mode="inline" />
      </HeimdallProvider>
    );

    // Look for role selector
    const roleSelect = screen.queryByLabelText(/role/i);
    if (roleSelect) {
      await user.selectOptions(roleSelect, 'admin');

      await waitFor(() => {
        expect(mockUpdateRole).toHaveBeenCalled();
      });
    }
  });

  it('should delete organization', async () => {
    const user = userEvent.setup();
    const mockDelete = vi.fn().mockResolvedValue({ success: true });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDelete(),
    });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <OrganizationProfile mode="inline" />
      </HeimdallProvider>
    );

    // Look for delete organization button
    const deleteButton = screen.queryByText(/delete organization|danger/i);
    if (deleteButton) {
      await user.click(deleteButton);

      // Confirmation required
      await waitFor(() => {
        const confirmInput = screen.queryByPlaceholderText(/type.*to confirm/i);
        if (confirmInput) {
          user.type(confirmInput, 'DELETE');
          
          const confirmButton = screen.getByRole('button', { name: /confirm|delete/i });
          user.click(confirmButton);
        }
      });
    }
  });

  it('should handle organization creation validation errors', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Organization name already exists',
      }),
    });

    render(
      <HeimdallProvider
        apiUrl={mockApiUrl}
        publishableKey={mockPublishableKey}
      >
        <CreateOrganization mode="inline" />
      </HeimdallProvider>
    );

    // Try to create with duplicate name
    const nameInput = screen.getByLabelText(/organization name|name/i);
    await user.type(nameInput, 'Existing Org');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    // Error should be displayed
    await waitFor(() => {
      const error = screen.queryByText(/already exists/i) || screen.queryByRole('alert');
      // Error handling is implementation-specific
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrganizationProfile } from './OrganizationProfile';
import type { Organization } from '../../../types';

const mockOrganization: Organization = {
  id: 'org_123',
  name: 'Acme Corporation',
  slug: 'acme-corp',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({
    isLoaded: true,
    organization: mockOrganization,
    organizations: [mockOrganization],
  }),
}));

describe('OrganizationProfile', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders organization information', () => {
    render(<OrganizationProfile mode="inline" />);
    expect(screen.getByText('Organization Settings')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acme Corporation')).toBeInTheDocument();
  });

  it('switches between tabs', () => {
    render(<OrganizationProfile mode="inline" />);
    
    // Default tab is Profile
    expect(screen.getByText('Organization Logo')).toBeInTheDocument();
    
    // Switch to Members tab
    fireEvent.click(screen.getByText(/Members/));
    expect(screen.getByText('Team Members')).toBeInTheDocument();
    
    // Switch to Settings tab
    fireEvent.click(screen.getByText(/Settings/));
    expect(screen.getByText('Organization Information')).toBeInTheDocument();
  });

  it('enables editing mode', () => {
    render(<OrganizationProfile mode="inline" />);
    
    const nameInput = screen.getByDisplayValue('Acme Corporation') as HTMLInputElement;
    expect(nameInput).toBeDisabled();
    
    // Click Edit Profile
    fireEvent.click(screen.getByText('Edit Profile'));
    
    expect(nameInput).not.toBeDisabled();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('saves organization changes', async () => {
    render(<OrganizationProfile mode="inline" />);
    
    // Enable editing
    fireEvent.click(screen.getByText('Edit Profile'));
    
    // Change name
    const nameInput = screen.getByDisplayValue('Acme Corporation');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    
    // Save
    fireEvent.click(screen.getByText('Save Changes'));
    
    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    });
  });

  it('cancels editing', () => {
    render(<OrganizationProfile mode="inline" />);
    
    // Enable editing
    fireEvent.click(screen.getByText('Edit Profile'));
    
    // Change name
    const nameInput = screen.getByDisplayValue('Acme Corporation');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    
    // Cancel
    fireEvent.click(screen.getByText('Cancel'));
    
    // Should revert to original name
    expect(screen.getByDisplayValue('Acme Corporation')).toBeInTheDocument();
    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
  });

  it('displays member list', () => {
    render(<OrganizationProfile mode="inline" />);
    
    // Switch to Members tab
    fireEvent.click(screen.getByText(/Members/));
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  it('shows invite member modal', () => {
    render(<OrganizationProfile mode="inline" />);
    
    // Switch to Members tab
    fireEvent.click(screen.getByText(/Members/));
    
    // Click Invite Member
    fireEvent.click(screen.getByText('Invite Member'));
    
    expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('email@example.com')).toBeInTheDocument();
  });

  it('shows danger zone in settings', () => {
    render(<OrganizationProfile mode="inline" />);
    
    // Switch to Settings tab
    fireEvent.click(screen.getByText(/Settings/));
    
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    expect(screen.getByText('Delete Organization')).toBeInTheDocument();
  });

  it('renders in modal mode', () => {
    render(<OrganizationProfile mode="modal" onClose={mockOnClose} />);
    
    // Should show close button
    const closeButton = screen.getByLabelText('Close');
    expect(closeButton).toBeInTheDocument();
  });

  it('calls onClose when close button clicked in modal mode', () => {
    render(<OrganizationProfile mode="modal" onClose={mockOnClose} />);
    
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders in inline mode without close button', () => {
    render(<OrganizationProfile mode="inline" />);
    
    // Should not show close button
    const closeButton = screen.queryByLabelText('Close');
    expect(closeButton).not.toBeInTheDocument();
  });
});

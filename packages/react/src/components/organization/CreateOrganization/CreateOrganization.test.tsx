import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateOrganization } from './CreateOrganization';
import { TruxeProvider } from '../../../context/TruxeProvider';

// Mock the useOrganization hook
const mockCreate = vi.fn();

vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({
    create: mockCreate,
    isLoaded: true,
    organization: null,
    organizations: [],
  }),
}));

const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <TruxeProvider publishableKey="test_key">
      {ui}
    </TruxeProvider>
  );
};

describe('CreateOrganization', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form in modal mode', () => {
    renderWithProvider(<CreateOrganization onClose={mockOnClose} />);
    expect(screen.getByText('Create Organization')).toBeInTheDocument();
    expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
  });

  it('auto-generates slug from organization name', async () => {
    renderWithProvider(<CreateOrganization onClose={mockOnClose} />);
    
    const nameInput = screen.getByLabelText(/organization name/i) as HTMLInputElement;
    const slugInput = screen.getByLabelText(/slug/i) as HTMLInputElement;
    
    fireEvent.change(nameInput, { target: { value: 'Acme Corporation' } });
    
    await waitFor(() => {
      expect(slugInput.value).toBe('acme-corporation');
    });
  });

  it('removes special characters from slug', async () => {
    renderWithProvider(<CreateOrganization onClose={mockOnClose} />);
    
    const nameInput = screen.getByLabelText(/organization name/i) as HTMLInputElement;
    const slugInput = screen.getByLabelText(/slug/i) as HTMLInputElement;
    
    fireEvent.change(nameInput, { target: { value: 'Test & Company!' } });
    
    await waitFor(() => {
      expect(slugInput.value).toBe('test-company');
    });
  });

  it('allows manual slug editing', () => {
    renderWithProvider(<CreateOrganization onClose={mockOnClose} />);
    
    const slugInput = screen.getByLabelText(/slug/i) as HTMLInputElement;
    
    fireEvent.change(slugInput, { target: { value: 'custom-slug' } });
    
    expect(slugInput.value).toBe('custom-slug');
  });

  it('validates required fields', async () => {
    renderWithProvider(<CreateOrganization onClose={mockOnClose} />);
    
    const submitButton = screen.getByText('Create Organization');
    
    // Button should be disabled when fields are empty
    expect(submitButton).toBeDisabled();
  });

  it('shows error when name is empty on submit', async () => {
    renderWithProvider(<CreateOrganization onClose={mockOnClose} />);
    
    const form = screen.getByRole('form');
    fireEvent.submit(form);
    
    await waitFor(() => {
      expect(screen.getByText(/organization name is required/i)).toBeInTheDocument();
    });
  });

  it('creates organization on valid submit', async () => {
    const newOrg = { id: 'org_123', name: 'Test Org', slug: 'test-org' };
    mockCreate.mockResolvedValueOnce(newOrg);
    
    renderWithProvider(
      <CreateOrganization onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    
    const nameInput = screen.getByLabelText(/organization name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Org' } });
    
    const submitButton = screen.getByText('Create Organization');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'Test Org',
        slug: 'test-org',
      });
      expect(mockOnSuccess).toHaveBeenCalledWith('org_123');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('shows error on creation failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Slug already exists'));
    
    renderWithProvider(<CreateOrganization onClose={mockOnClose} />);
    
    const nameInput = screen.getByLabelText(/organization name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Org' } });
    
    const submitButton = screen.getByText('Create Organization');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/slug already exists/i)).toBeInTheDocument();
    });
  });

  it('disables form during submission', async () => {
    mockCreate.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    renderWithProvider(<CreateOrganization onClose={mockOnClose} />);
    
    const nameInput = screen.getByLabelText(/organization name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Org' } });
    
    const submitButton = screen.getByText('Create Organization');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument();
      expect(nameInput).toBeDisabled();
    });
  });

  it('renders in inline mode', () => {
    renderWithProvider(<CreateOrganization mode="inline" onClose={mockOnClose} />);
    
    // In inline mode, there should be no close button in header
    const closeButtons = screen.queryAllByLabelText('Close');
    expect(closeButtons.length).toBe(0);
    
    expect(screen.getByText('Create Organization')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    renderWithProvider(<CreateOrganization onClose={mockOnClose} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});

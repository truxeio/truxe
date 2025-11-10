import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import type { Organization } from '../../../types';

const mockOrganizations: Organization[] = [
  {
    id: 'org_1',
    name: 'Acme Corporation',
    slug: 'acme-corp',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'org_2',
    name: 'Tech Startup Inc',
    slug: 'tech-startup',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

const mockSetActive = vi.fn();

vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({
    isLoaded: true,
    organization: mockOrganizations[0],
    organizations: mockOrganizations,
    setActive: mockSetActive,
  }),
}));

describe('OrganizationSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders current organization', () => {
    render(<OrganizationSwitcher />);
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
  });

  it('shows organization name when showName=true', () => {
    render(<OrganizationSwitcher showName />);
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
  });

  it('hides organization name when showName=false', () => {
    const { container } = render(<OrganizationSwitcher showName={false} />);
    const nameElement = container.querySelector('.max-w-\\[150px\\]');
    expect(nameElement).not.toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<OrganizationSwitcher />);
    const button = screen.getByRole('button', { expanded: false });
    
    fireEvent.click(button);
    
    expect(screen.getByText('Tech Startup Inc')).toBeInTheDocument();
    expect(screen.getByText('tech-startup')).toBeInTheDocument();
  });

  it('switches organization on selection', async () => {
    mockSetActive.mockResolvedValueOnce(undefined);
    
    render(<OrganizationSwitcher />);
    
    // Open dropdown
    const button = screen.getByRole('button', { expanded: false });
    fireEvent.click(button);
    
    // Click on second organization
    const orgButton = screen.getByText('Tech Startup Inc');
    fireEvent.click(orgButton);
    
    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith('org_2');
    });
  });

  it('shows search when > 5 organizations', () => {
    const manyOrgs = Array.from({ length: 10 }, (_, i) => ({
      id: `org_${i}`,
      name: `Organization ${i}`,
      slug: `org-${i}`,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }));

    vi.mocked(vi.importActual('../../../hooks/useOrganization')).useOrganization = () => ({
      isLoaded: true,
      organization: manyOrgs[0],
      organizations: manyOrgs,
      setActive: mockSetActive,
    });

    render(<OrganizationSwitcher />);
    
    // Open dropdown
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    // Should show search input
    expect(screen.getByPlaceholderText('Search organizations...')).toBeInTheDocument();
  });

  it('filters organizations by search query', async () => {
    const manyOrgs = [
      { id: 'org_1', name: 'Apple Inc', slug: 'apple', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      { id: 'org_2', name: 'Microsoft Corp', slug: 'microsoft', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      { id: 'org_3', name: 'Amazon LLC', slug: 'amazon', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      { id: 'org_4', name: 'Meta Platforms', slug: 'meta', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      { id: 'org_5', name: 'Google LLC', slug: 'google', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      { id: 'org_6', name: 'Tesla Inc', slug: 'tesla', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
    ];

    vi.mocked(vi.importActual('../../../hooks/useOrganization')).useOrganization = () => ({
      isLoaded: true,
      organization: manyOrgs[0],
      organizations: manyOrgs,
      setActive: mockSetActive,
    });

    render(<OrganizationSwitcher />);
    
    // Open dropdown
    fireEvent.click(screen.getByRole('button'));
    
    const searchInput = screen.getByPlaceholderText('Search organizations...');
    fireEvent.change(searchInput, { target: { value: 'app' } });
    
    await waitFor(() => {
      expect(screen.getByText('Apple Inc')).toBeInTheDocument();
      expect(screen.queryByText('Microsoft Corp')).not.toBeInTheDocument();
    });
  });

  it('shows "Create Organization" button by default', () => {
    render(<OrganizationSwitcher />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(screen.getByText('Create Organization')).toBeInTheDocument();
  });

  it('hides create button when hideCreateOrganization=true', () => {
    render(<OrganizationSwitcher hideCreateOrganization />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(screen.queryByText('Create Organization')).not.toBeInTheDocument();
  });

  it('shows check icon on current organization', () => {
    render(<OrganizationSwitcher />);
    
    fireEvent.click(screen.getByRole('button'));
    
    const currentOrgRow = screen.getByText('Acme Corporation').closest('button');
    const checkIcon = currentOrgRow?.querySelector('svg.text-blue-600');
    
    expect(checkIcon).toBeInTheDocument();
  });

  it('closes dropdown on escape key', () => {
    render(<OrganizationSwitcher />);
    
    // Open dropdown
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Tech Startup Inc')).toBeInTheDocument();
    
    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    
    // Dropdown should close
    expect(screen.queryByText('Tech Startup Inc')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrganizationList } from './OrganizationList';
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
  {
    id: 'org_3',
    name: 'Digital Agency',
    slug: 'digital-agency',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
  },
];

const mockUseOrganization = vi.fn();

vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => mockUseOrganization(),
}));

describe('OrganizationList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrganization.mockReturnValue({
      isLoaded: true,
      organizations: mockOrganizations,
    });
  });

  it('renders organization list', () => {
    render(<OrganizationList />);
    
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    expect(screen.getByText('Tech Startup Inc')).toBeInTheDocument();
    expect(screen.getByText('Digital Agency')).toBeInTheDocument();
  });

  it('shows card layout by default', () => {
    const { container } = render(<OrganizationList />);
    
    // Card layout uses grid
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
  });

  it('shows list layout when specified', () => {
    const { container } = render(<OrganizationList layout="list" />);
    
    // List layout uses space-y
    const list = container.querySelector('.space-y-2');
    expect(list).toBeInTheDocument();
  });

  it('handles organization click', () => {
    const handleClick = vi.fn();
    render(<OrganizationList onOrganizationClick={handleClick} />);
    
    const org = screen.getByText('Acme Corporation');
    fireEvent.click(org);
    
    expect(handleClick).toHaveBeenCalledWith('org_1');
  });

  it('shows create organization button by default', () => {
    render(<OrganizationList />);
    
    expect(screen.getByText('Create Organization')).toBeInTheDocument();
  });

  it('hides create button when hideCreate is true', () => {
    render(<OrganizationList hideCreate />);
    
    expect(screen.queryByText('Create Organization')).not.toBeInTheDocument();
  });

  it('shows empty state when no organizations', () => {
    mockUseOrganization.mockReturnValue({
      isLoaded: true,
      organizations: [],
    });
    
    render(<OrganizationList />);
    
    expect(screen.getByText('No organizations')).toBeInTheDocument();
    expect(screen.getByText('Get started by creating your first organization.')).toBeInTheDocument();
  });

  it('shows loading state when not loaded', () => {
    mockUseOrganization.mockReturnValue({
      isLoaded: false,
      organizations: [],
    });
    
    const { container } = render(<OrganizationList />);
    
    // Check for loading skeletons
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('opens create modal when create button clicked', () => {
    render(<OrganizationList />);
    
    const createButton = screen.getByText('Create Organization');
    fireEvent.click(createButton);
    
    // Modal should appear
    expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
  });

  it('displays member count in card layout', () => {
    render(<OrganizationList layout="card" />);
    
    const memberCounts = screen.getAllByText('3 members');
    expect(memberCounts.length).toBe(mockOrganizations.length);
  });

  it('displays role badge', () => {
    render(<OrganizationList />);
    
    const badges = screen.getAllByText('Admin');
    expect(badges.length).toBe(mockOrganizations.length);
  });

  it('applies custom className', () => {
    const { container } = render(<OrganizationList className="custom-class" />);
    
    const wrapper = container.querySelector('.custom-class');
    expect(wrapper).toBeInTheDocument();
  });
});

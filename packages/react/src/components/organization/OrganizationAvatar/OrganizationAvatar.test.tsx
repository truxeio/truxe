import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrganizationAvatar } from './OrganizationAvatar';
import type { Organization } from '../../../types';

const mockOrganization: Organization = {
  id: 'org_123',
  name: 'Acme Corporation',
  slug: 'acme-corp',
  imageUrl: 'https://example.com/logo.png',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('OrganizationAvatar', () => {
  it('renders organization image when imageUrl is provided', () => {
    render(<OrganizationAvatar organization={mockOrganization} />);
    const img = screen.getByRole('img', { name: /acme corporation/i });
    expect(img).toHaveAttribute('src', mockOrganization.imageUrl);
  });

  it('renders organization initials as fallback when no image', () => {
    const orgWithoutImage = { ...mockOrganization, imageUrl: undefined };
    render(<OrganizationAvatar organization={orgWithoutImage} fallback="initials" />);
    expect(screen.getByText('AC')).toBeInTheDocument();
  });

  it('renders single-word organization initials correctly', () => {
    const singleWordOrg = { ...mockOrganization, name: 'Microsoft', imageUrl: undefined };
    render(<OrganizationAvatar organization={singleWordOrg} fallback="initials" />);
    expect(screen.getByText('MI')).toBeInTheDocument();
  });

  it('renders building icon when fallback is set to icon', () => {
    const orgWithoutImage = { ...mockOrganization, imageUrl: undefined };
    const { container } = render(<OrganizationAvatar organization={orgWithoutImage} fallback="icon" />);
    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { container } = render(
      <OrganizationAvatar organization={mockOrganization} size="lg" />
    );
    const avatar = container.firstChild as HTMLElement;
    expect(avatar.className).toContain('w-12');
    expect(avatar.className).toContain('h-12');
  });

  it('applies correct shape classes', () => {
    const { container } = render(
      <OrganizationAvatar organization={mockOrganization} shape="circle" />
    );
    const avatar = container.firstChild as HTMLElement;
    expect(avatar.className).toContain('rounded-full');
  });

  it('handles onClick callback', () => {
    const handleClick = vi.fn();
    render(<OrganizationAvatar organization={mockOrganization} onClick={handleClick} />);
    const avatar = screen.getByRole('button');
    fireEvent.click(avatar);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard interaction when onClick is provided', () => {
    const handleClick = vi.fn();
    render(<OrganizationAvatar organization={mockOrganization} onClick={handleClick} />);
    const avatar = screen.getByRole('button');
    
    fireEvent.keyDown(avatar, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    fireEvent.keyDown(avatar, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(<OrganizationAvatar organization={mockOrganization} isLoading />);
    expect(screen.getByLabelText('Loading organization logo')).toBeInTheDocument();
  });

  it('handles image load error gracefully', () => {
    render(<OrganizationAvatar organization={mockOrganization} fallback="initials" />);
    const img = screen.getByRole('img') as HTMLImageElement;
    
    // Simulate image error
    fireEvent.error(img);
    
    // Should fallback to initials
    expect(screen.getByText('AC')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <OrganizationAvatar organization={mockOrganization} className="custom-class" />
    );
    const avatar = container.firstChild as HTMLElement;
    expect(avatar.className).toContain('custom-class');
  });

  it('uses direct imageUrl prop over organization.imageUrl', () => {
    const directImageUrl = 'https://example.com/direct-logo.png';
    render(
      <OrganizationAvatar 
        organization={mockOrganization} 
        imageUrl={directImageUrl} 
      />
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', directImageUrl);
  });
});

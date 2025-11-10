import type { Meta, StoryObj } from '@storybook/react';
import { OrganizationAvatar } from './OrganizationAvatar';
import type { Organization } from '../../../types';

const meta: Meta<typeof OrganizationAvatar> = {
  title: 'Organization/OrganizationAvatar',
  component: OrganizationAvatar,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Size variant of the avatar',
    },
    shape: {
      control: 'select',
      options: ['circle', 'square'],
      description: 'Shape of the avatar',
    },
    fallback: {
      control: 'select',
      options: ['initials', 'icon'],
      description: 'Fallback type when no image is available',
    },
  },
};

export default meta;
type Story = StoryObj<typeof OrganizationAvatar>;

const mockOrganization: Organization = {
  id: 'org_123',
  name: 'Acme Corporation',
  slug: 'acme-corp',
  imageUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Acme%20Corporation',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const orgWithoutImage: Organization = {
  ...mockOrganization,
  imageUrl: undefined,
};

export const Default: Story = {
  args: {
    organization: mockOrganization,
    size: 'md',
    shape: 'square',
  },
};

export const WithInitials: Story = {
  args: {
    organization: orgWithoutImage,
    size: 'md',
    shape: 'square',
    fallback: 'initials',
  },
};

export const WithIcon: Story = {
  args: {
    organization: orgWithoutImage,
    size: 'md',
    shape: 'square',
    fallback: 'icon',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <OrganizationAvatar organization={mockOrganization} size="sm" />
      <OrganizationAvatar organization={mockOrganization} size="md" />
      <OrganizationAvatar organization={mockOrganization} size="lg" />
      <OrganizationAvatar organization={mockOrganization} size="xl" />
    </div>
  ),
};

export const Shapes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <OrganizationAvatar organization={mockOrganization} shape="square" size="lg" />
      <OrganizationAvatar organization={mockOrganization} shape="circle" size="lg" />
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    organization: mockOrganization,
    size: 'lg',
    onClick: () => alert('Organization clicked!'),
  },
};

export const Loading: Story = {
  args: {
    organization: mockOrganization,
    size: 'md',
    isLoading: true,
  },
};

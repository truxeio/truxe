import type { Meta, StoryObj } from '@storybook/react';
import { UserAvatar } from './UserAvatar';
import type { User } from '../../../types';

const meta: Meta<typeof UserAvatar> = {
  title: 'Components/User/UserAvatar',
  component: UserAvatar,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Display user profile pictures with intelligent fallbacks. Supports images, initials, and icon fallbacks with multiple size and shape variants.',
      },
    },
  },
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
    onClick: {
      action: 'clicked',
      description: 'Click handler for interactive avatars',
    },
  },
};

export default meta;
type Story = StoryObj<typeof UserAvatar>;

const mockUserWithImage: User = {
  id: '1',
  email: 'sarah.johnson@example.com',
  emailVerified: true,
  firstName: 'Sarah',
  lastName: 'Johnson',
  fullName: 'Sarah Johnson',
  imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockUserWithoutImage: User = {
  id: '2',
  email: 'alex.martinez@example.com',
  emailVerified: true,
  firstName: 'Alex',
  lastName: 'Martinez',
  fullName: 'Alex Martinez',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

/**
 * Default avatar with image
 */
export const WithImage: Story = {
  args: {
    user: mockUserWithImage,
    size: 'md',
    shape: 'circle',
  },
};

/**
 * Avatar showing user initials as fallback
 */
export const WithInitials: Story = {
  args: {
    user: mockUserWithoutImage,
    size: 'md',
    shape: 'circle',
    fallback: 'initials',
  },
};

/**
 * Avatar showing icon as fallback
 */
export const WithIconFallback: Story = {
  args: {
    fallback: 'icon',
    size: 'md',
    shape: 'circle',
  },
};

/**
 * All available size variants
 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <UserAvatar user={mockUserWithImage} size="sm" />
        <p className="text-xs mt-2 text-gray-600">Small (32px)</p>
      </div>
      <div className="text-center">
        <UserAvatar user={mockUserWithImage} size="md" />
        <p className="text-xs mt-2 text-gray-600">Medium (40px)</p>
      </div>
      <div className="text-center">
        <UserAvatar user={mockUserWithImage} size="lg" />
        <p className="text-xs mt-2 text-gray-600">Large (48px)</p>
      </div>
      <div className="text-center">
        <UserAvatar user={mockUserWithImage} size="xl" />
        <p className="text-xs mt-2 text-gray-600">X-Large (64px)</p>
      </div>
    </div>
  ),
};

/**
 * Different shape variants
 */
export const Shapes: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <div className="text-center">
        <UserAvatar user={mockUserWithImage} size="xl" shape="circle" />
        <p className="text-sm mt-2 text-gray-600">Circle</p>
      </div>
      <div className="text-center">
        <UserAvatar user={mockUserWithImage} size="xl" shape="square" />
        <p className="text-sm mt-2 text-gray-600">Square</p>
      </div>
    </div>
  ),
};

/**
 * Interactive avatar with click handler
 */
export const Interactive: Story = {
  args: {
    user: mockUserWithImage,
    size: 'lg',
    onClick: () => alert('Avatar clicked!'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Avatars can be interactive with onClick handlers. They include hover effects and keyboard support.',
      },
    },
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  args: {
    isLoading: true,
    size: 'lg',
  },
};

/**
 * Using direct imageUrl prop
 */
export const DirectImageUrl: Story = {
  args: {
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    size: 'lg',
  },
};

/**
 * Initials with different sizes
 */
export const InitialsSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <UserAvatar user={mockUserWithoutImage} size="sm" fallback="initials" />
      <UserAvatar user={mockUserWithoutImage} size="md" fallback="initials" />
      <UserAvatar user={mockUserWithoutImage} size="lg" fallback="initials" />
      <UserAvatar user={mockUserWithoutImage} size="xl" fallback="initials" />
    </div>
  ),
};

/**
 * Icon fallback with different sizes
 */
export const IconSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <UserAvatar size="sm" fallback="icon" />
      <UserAvatar size="md" fallback="icon" />
      <UserAvatar size="lg" fallback="icon" />
      <UserAvatar size="xl" fallback="icon" />
    </div>
  ),
};

/**
 * Square shapes with initials
 */
export const SquareInitials: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <UserAvatar user={mockUserWithoutImage} size="sm" shape="square" fallback="initials" />
      <UserAvatar user={mockUserWithoutImage} size="md" shape="square" fallback="initials" />
      <UserAvatar user={mockUserWithoutImage} size="lg" shape="square" fallback="initials" />
      <UserAvatar user={mockUserWithoutImage} size="xl" shape="square" fallback="initials" />
    </div>
  ),
};

/**
 * Real-world examples
 */
export const RealWorldExamples: Story = {
  render: () => (
    <div className="space-y-8">
      {/* User list */}
      <div>
        <h3 className="text-sm font-semibold mb-3">User List</h3>
        <div className="space-y-2">
          {[mockUserWithImage, mockUserWithoutImage].map((user) => (
            <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
              <UserAvatar user={user} size="md" />
              <div>
                <p className="text-sm font-medium">{user.fullName}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Profile header */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Profile Header</h3>
        <div className="flex items-center gap-4">
          <UserAvatar user={mockUserWithImage} size="xl" />
          <div>
            <h2 className="text-xl font-bold">{mockUserWithImage.fullName}</h2>
            <p className="text-gray-600">{mockUserWithImage.email}</p>
          </div>
        </div>
      </div>

      {/* Comments section */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Comments</h3>
        <div className="space-y-3">
          <div className="flex gap-3">
            <UserAvatar user={mockUserWithImage} size="sm" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">{mockUserWithImage.fullName}</p>
              <p className="text-sm">This looks great! Thanks for sharing.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <UserAvatar user={mockUserWithoutImage} size="sm" fallback="initials" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">{mockUserWithoutImage.fullName}</p>
              <p className="text-sm">Agreed, excellent work!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Examples of UserAvatar in real-world UI patterns like user lists, profile headers, and comment sections.',
      },
    },
  },
};

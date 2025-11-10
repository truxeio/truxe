import type { Meta, StoryObj } from '@storybook/react';
import { UserButton } from './UserButton';
import { TruxeProvider } from '../../../context/TruxeProvider';
import type { User } from '../../../types';

const meta: Meta<typeof UserButton> = {
  title: 'Components/User/UserButton',
  component: UserButton,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A comprehensive user menu dropdown that provides access to user profile management and sign-out functionality. Includes keyboard navigation and accessibility features.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ minHeight: '400px', display: 'flex', justifyContent: 'flex-end', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    showName: {
      control: 'boolean',
      description: 'Display user name next to avatar',
      defaultValue: false,
    },
    userProfileMode: {
      control: 'select',
      options: ['modal', 'navigation'],
      description: 'How to open user profile (modal or navigate)',
      defaultValue: 'modal',
    },
    afterSignOutUrl: {
      control: 'text',
      description: 'URL to redirect to after sign out',
      defaultValue: '/',
    },
  },
};

export default meta;
type Story = StoryObj<typeof UserButton>;

/**
 * Default user button (avatar only, no name)
 */
export const Default: Story = {
  args: {
    showName: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'The default user button shows just the avatar. Click to see the dropdown menu with user info and actions.',
      },
    },
  },
};

/**
 * User button with name displayed
 */
export const WithName: Story = {
  args: {
    showName: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Display the user\'s first name next to their avatar for better recognition.',
      },
    },
  },
};

/**
 * Custom sign-out redirect
 */
export const CustomSignOutRedirect: Story = {
  args: {
    showName: true,
    afterSignOutUrl: '/login',
  },
  parameters: {
    docs: {
      description: {
        story: 'Specify a custom URL to redirect to after signing out (default is "/").',
      },
    },
  },
};

/**
 * Navigation mode
 */
export const NavigationMode: Story = {
  args: {
    showName: true,
    userProfileMode: 'navigation',
  },
  parameters: {
    docs: {
      description: {
        story: 'In navigation mode, clicking "Manage account" would navigate to a profile page instead of opening a modal. Requires router integration in your app.',
      },
    },
  },
};

/**
 * Interactive demo
 */
export const InteractiveDemo: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Different Configurations</h3>
        <div className="flex items-center justify-between gap-8 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <UserButton />
            <p className="text-xs mt-2 text-gray-600">Avatar Only</p>
          </div>
          <div className="text-center">
            <UserButton showName />
            <p className="text-xs mt-2 text-gray-600">With Name</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Interaction Guide</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Click the button to open the dropdown menu</li>
          <li>• Press <kbd className="px-2 py-1 bg-white rounded border text-xs">Escape</kbd> to close</li>
          <li>• Click outside to dismiss the dropdown</li>
          <li>• Try "Manage account" to see the profile modal</li>
          <li>• "Sign out" will trigger authentication cleanup</li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Interactive demonstration showing different UserButton configurations and usage patterns.',
      },
    },
  },
};

/**
 * In navigation layouts
 */
export const InNavigationBar: Story = {
  render: () => (
    <div>
      {/* Example navigation bar */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
            MyApp
          </h1>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href="#" style={{ color: '#6b7280', fontSize: '14px' }}>Dashboard</a>
            <a href="#" style={{ color: '#6b7280', fontSize: '14px' }}>Projects</a>
            <a href="#" style={{ color: '#6b7280', fontSize: '14px' }}>Team</a>
          </div>
        </div>

        <UserButton showName />
      </nav>

      <div style={{ padding: '24px' }}>
        <p style={{ color: '#6b7280' }}>
          The UserButton fits naturally in navigation bars and headers.
        </p>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Example of UserButton integrated into a typical application navigation bar.',
      },
    },
  },
};

/**
 * Mobile responsive example
 */
export const MobileLayout: Story = {
  render: () => (
    <div style={{
      maxWidth: '375px',
      margin: '0 auto',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      {/* Mobile header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <button style={{
          padding: '8px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h1 style={{ fontSize: '16px', fontWeight: '600' }}>MyApp</h1>

        <UserButton />
      </header>

      <div style={{ padding: '16px', backgroundColor: '#f9fafb', minHeight: '200px' }}>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          Mobile layout with compact UserButton
        </p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'UserButton in a mobile-optimized layout. The compact avatar-only design works well on small screens.',
      },
    },
  },
};

/**
 * Dark mode example
 */
export const DarkMode: Story = {
  render: () => (
    <div style={{
      backgroundColor: '#1f2937',
      padding: '24px',
      borderRadius: '8px',
      minHeight: '300px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600' }}>
          Dashboard
        </h2>
        <UserButton showName />
      </div>
      <p style={{ color: '#9ca3af', marginTop: '16px' }}>
        The UserButton adapts to dark backgrounds. Note: Full dark mode styling would require theme customization.
      </p>
    </div>
  ),
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'UserButton in a dark-themed interface. The component uses light colors that contrast well with dark backgrounds.',
      },
    },
  },
};

/**
 * Accessibility features
 */
export const AccessibilityFeatures: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="bg-green-50 border-l-4 border-green-500 p-4">
        <h4 className="font-semibold text-green-900 mb-2">♿ Accessibility Features</h4>
        <ul className="text-sm text-green-800 space-y-2">
          <li>✅ <strong>Keyboard Navigation:</strong> Fully keyboard accessible</li>
          <li>✅ <strong>Screen Readers:</strong> Proper ARIA labels and roles</li>
          <li>✅ <strong>Focus Management:</strong> Clear focus indicators</li>
          <li>✅ <strong>Escape Key:</strong> Close dropdown with Escape</li>
          <li>✅ <strong>Click Outside:</strong> Dismiss on outside click</li>
          <li>✅ <strong>ARIA Expanded:</strong> Indicates dropdown state</li>
        </ul>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <UserButton showName />
      </div>

      <div className="text-sm text-gray-600">
        <p><strong>Try these keyboard interactions:</strong></p>
        <ul className="mt-2 space-y-1 ml-4">
          <li>• <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Tab</kbd> to focus the button</li>
          <li>• <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Enter</kbd> or <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Space</kbd> to open dropdown</li>
          <li>• <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Escape</kbd> to close dropdown</li>
          <li>• <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Tab</kbd> through menu items</li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The UserButton is built with accessibility in mind, supporting keyboard navigation, screen readers, and WCAG 2.1 Level AA compliance.',
      },
    },
  },
};

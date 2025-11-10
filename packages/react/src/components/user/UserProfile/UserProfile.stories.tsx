import type { Meta, StoryObj } from '@storybook/react';
import { UserProfile } from './UserProfile';

const meta: Meta<typeof UserProfile> = {
  title: 'Components/User/UserProfile',
  component: UserProfile,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Comprehensive user profile management component with tabbed interface for Profile, Security, and Sessions management. Supports both modal and inline display modes.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    mode: {
      control: 'select',
      options: ['modal', 'inline'],
      description: 'Display mode: modal or inline',
      defaultValue: 'inline',
    },
    onClose: {
      action: 'closed',
      description: 'Callback when modal is closed (only used in modal mode)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof UserProfile>;

/**
 * Default inline mode
 */
export const Inline: Story = {
  args: {
    mode: 'inline',
  },
  parameters: {
    docs: {
      description: {
        story: 'The default inline mode displays the profile in the page flow, perfect for dedicated profile pages or settings screens.',
      },
    },
  },
};

/**
 * Modal mode
 */
export const Modal: Story = {
  args: {
    mode: 'modal',
    onClose: () => console.log('Modal closed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal mode displays the profile in a contained view with a close button, typically used when opened from UserButton.',
      },
    },
  },
};

/**
 * Interactive demo showing all tabs
 */
export const InteractiveDemo: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
        <h4 className="font-semibold text-blue-900 mb-2">🎯 Interaction Guide</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Click tabs to navigate: Profile, Security, Sessions</li>
          <li>• Try editing profile fields and saving changes</li>
          <li>• View email verification and MFA status in Security tab</li>
          <li>• See active sessions and revoke options in Sessions tab</li>
        </ul>
      </div>

      <UserProfile mode="inline" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Full interactive demonstration of the UserProfile component with all features.',
      },
    },
  },
};

/**
 * Profile tab focused
 */
export const ProfileTab: Story = {
  render: () => (
    <div>
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Profile Tab Features:</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>✓ Avatar display with upload placeholder</li>
          <li>✓ First and last name editing</li>
          <li>✓ Read-only email field</li>
          <li>✓ Account creation date</li>
          <li>✓ Email verification status</li>
          <li>✓ Edit/Save/Cancel workflow</li>
        </ul>
      </div>
      <UserProfile mode="inline" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The Profile tab allows users to update their personal information including name and view account details.',
      },
    },
  },
};

/**
 * Security tab view
 */
export const SecurityTab: Story = {
  render: () => (
    <div>
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Security Tab Features:</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>✓ Email verification status with visual indicator</li>
          <li>✓ Multi-Factor Authentication setup</li>
          <li>✓ Connected OAuth providers management</li>
          <li>✓ Clear security status indicators</li>
        </ul>
      </div>
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <UserProfile mode="inline" />
        <p className="text-sm text-gray-500 mt-4 italic">
          Click the "Security" tab to view security settings
        </p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The Security tab provides an overview of account security settings including email verification, MFA, and connected accounts.',
      },
    },
  },
};

/**
 * Sessions tab view
 */
export const SessionsTab: Story = {
  render: () => (
    <div>
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Sessions Tab Features:</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>✓ List of active sessions across devices</li>
          <li>✓ Current session indicator</li>
          <li>✓ Device and location information</li>
          <li>✓ Last active timestamp</li>
          <li>✓ Individual session revocation</li>
          <li>✓ Revoke all other sessions option</li>
        </ul>
      </div>
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <UserProfile mode="inline" />
        <p className="text-sm text-gray-500 mt-4 italic">
          Click the "Sessions" tab to view active sessions
        </p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The Sessions tab allows users to view and manage active sessions across different devices and browsers.',
      },
    },
  },
};

/**
 * In a settings page layout
 */
export const SettingsPageLayout: Story = {
  render: () => (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
    }}>
      {/* Page Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
            Account Settings
          </h1>
          <p style={{ color: '#6b7280', marginTop: '4px' }}>
            Manage your profile, security settings, and active sessions
          </p>
        </div>
      </header>

      {/* Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          padding: '24px',
        }}>
          <UserProfile mode="inline" />
        </div>
      </main>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Example of UserProfile integrated into a full settings page layout with header and container.',
      },
    },
  },
};

/**
 * Mobile responsive view
 */
export const MobileView: Story = {
  render: () => (
    <div style={{
      maxWidth: '375px',
      margin: '0 auto',
      backgroundColor: '#f9fafb',
      minHeight: '600px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '16px',
      }}>
        <UserProfile mode="inline" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'UserProfile is fully responsive and works well on mobile devices with smaller screens.',
      },
    },
  },
};

/**
 * Editing workflow demonstration
 */
export const EditingWorkflow: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
        <h4 className="font-semibold text-purple-900 mb-2">✏️ Editing Workflow</h4>
        <ol className="text-sm text-purple-800 space-y-1 list-decimal ml-4">
          <li>Click "Edit profile" button to enter editing mode</li>
          <li>Fields become editable (except email which is read-only)</li>
          <li>Make changes to first name or last name</li>
          <li>Click "Save changes" to persist changes</li>
          <li>Or click "Cancel" to discard changes</li>
          <li>Success message appears after successful save</li>
          <li>Component returns to view mode</li>
        </ol>
      </div>

      <UserProfile mode="inline" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstration of the complete editing workflow from view mode to edit mode and back.',
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
          <li>✅ <strong>Semantic HTML:</strong> Proper heading hierarchy and landmarks</li>
          <li>✅ <strong>Keyboard Navigation:</strong> All interactive elements are keyboard accessible</li>
          <li>✅ <strong>ARIA Labels:</strong> Tab roles and selection states</li>
          <li>✅ <strong>Form Labels:</strong> All inputs have associated labels</li>
          <li>✅ <strong>Error Messages:</strong> Properly associated with form fields</li>
          <li>✅ <strong>Focus Management:</strong> Clear focus indicators</li>
          <li>✅ <strong>Screen Readers:</strong> Descriptive text and helper messages</li>
        </ul>
      </div>

      <UserProfile mode="inline" />

      <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
        <p><strong>Keyboard shortcuts:</strong></p>
        <ul className="mt-2 space-y-1 ml-4">
          <li>• <kbd className="px-2 py-1 bg-white rounded border text-xs">Tab</kbd> - Navigate through form fields and buttons</li>
          <li>• <kbd className="px-2 py-1 bg-white rounded border text-xs">Enter</kbd> - Activate buttons</li>
          <li>• <kbd className="px-2 py-1 bg-white rounded border text-xs">Escape</kbd> - Close modal (when in modal mode)</li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'UserProfile is built with accessibility in mind, supporting keyboard navigation, screen readers, and WCAG 2.1 Level AA compliance.',
      },
    },
  },
};

/**
 * With custom styling
 */
export const CustomStyling: Story = {
  render: () => (
    <div style={{
      padding: '24px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '12px',
      minHeight: '600px',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      }}>
        <UserProfile mode="inline" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'UserProfile can be styled and integrated into custom-designed interfaces.',
      },
    },
  },
};

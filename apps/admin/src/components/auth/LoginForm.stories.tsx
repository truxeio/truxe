import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { LoginForm } from './LoginForm';
import { AuthProvider } from '../../providers/AuthProvider';
import { ToastProvider } from '../../providers/ToastProvider';
import { ToastContainer } from '../ui/Toast';

const meta = {
  title: 'Auth/LoginForm',
  component: LoginForm,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A comprehensive login form component with magic link authentication, organization support, and full accessibility.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ToastProvider>
        <AuthProvider
          apiConfig={{
            baseUrl: 'http://localhost:3001',
            timeout: 10000,
          }}
        >
          <div className="max-w-md w-full">
            <Story />
          </div>
          <ToastContainer />
        </AuthProvider>
      </ToastProvider>
    ),
  ],
  argTypes: {
    showOrganization: {
      control: 'boolean',
      description: 'Show organization input field',
    },
    autoFocus: {
      control: 'boolean',
      description: 'Auto-focus the email input on mount',
    },
    submitText: {
      control: 'text',
      description: 'Custom text for the submit button',
    },
    loadingText: {
      control: 'text',
      description: 'Custom text shown when loading',
    },
    onSuccess: {
      action: 'success',
      description: 'Callback fired on successful login',
    },
    onError: {
      action: 'error',
      description: 'Callback fired on login error',
    },
  },
  args: {
    onSuccess: fn(),
    onError: fn(),
  },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Default login form with email input and magic link authentication.',
      },
    },
  },
};

export const WithOrganization: Story = {
  args: {
    showOrganization: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Login form with organization field for multi-tenant applications.',
      },
    },
  },
};

export const CustomText: Story = {
  args: {
    submitText: 'Send Login Link',
    loadingText: 'Sending link...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Login form with customized button text.',
      },
    },
  },
};

export const PrefilledOrganization: Story = {
  args: {
    showOrganization: true,
    organizationSlug: 'acme-corp',
  },
  parameters: {
    docs: {
      description: {
        story: 'Login form with pre-filled organization for branded login pages.',
      },
    },
  },
};

export const NoAutoFocus: Story = {
  args: {
    autoFocus: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Login form without auto-focus for better accessibility in some contexts.',
      },
    },
  },
};

export const LoadingState: Story = {
  render: (args) => {
    const [isLoading, setIsLoading] = React.useState(false);
    
    const handleSubmit = async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
    };
    
    return (
      <div className="space-y-4">
        <LoginForm {...args} />
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Simulate Loading
        </button>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the loading state of the login form.',
      },
    },
  },
};

export const AccessibilityFeatures: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Accessibility Features</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li>Proper form labels and ARIA attributes</li>
          <li>Keyboard navigation support</li>
          <li>Screen reader announcements</li>
          <li>Error message associations</li>
          <li>Focus management</li>
          <li>High contrast mode support</li>
        </ul>
      </div>
      <LoginForm showOrganization />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Login form showcasing comprehensive accessibility features.',
      },
    },
  },
};

export const ErrorHandling: Story = {
  render: () => {
    const mockAuthProvider = {
      login: async (email: string) => {
        if (email === 'error@example.com') {
          throw new Error('Invalid email address');
        }
        if (email === 'network@example.com') {
          throw new Error('Network error occurred');
        }
        return { success: true, message: 'Magic link sent!' };
      },
    };

    return (
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <h4 className="font-medium text-yellow-800">Test Error Handling</h4>
          <p className="text-sm text-yellow-700 mt-1">
            Try these emails to see error states:
          </p>
          <ul className="text-sm text-yellow-700 list-disc list-inside mt-2">
            <li>error@example.com - Invalid email error</li>
            <li>network@example.com - Network error</li>
            <li>Any other email - Success state</li>
          </ul>
        </div>
        <LoginForm />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive example showing error handling and validation.',
      },
    },
  },
};

// Import React for the LoadingState story
import React from 'react';

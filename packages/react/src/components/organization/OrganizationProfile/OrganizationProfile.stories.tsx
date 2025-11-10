import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { OrganizationProfile } from './OrganizationProfile';
import { Button } from '../../ui/Button';

const meta: Meta<typeof OrganizationProfile> = {
  title: 'Organization/OrganizationProfile',
  component: OrganizationProfile,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof OrganizationProfile>;

export const ModalMode: Story = {
  render: () => {
    const [show, setShow] = useState(true);
    
    return (
      <div>
        <Button onClick={() => setShow(true)}>Open Organization Profile</Button>
        {show && (
          <OrganizationProfile 
            mode="modal"
            onClose={() => setShow(false)}
          />
        )}
      </div>
    );
  },
};

export const InlineMode: Story = {
  render: () => (
    <div className="w-full max-w-4xl">
      <OrganizationProfile mode="inline" />
    </div>
  ),
};

export const ProfileTab: Story = {
  render: () => (
    <div className="w-full max-w-4xl">
      <OrganizationProfile mode="inline" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The Profile tab allows editing organization name, slug, and description.',
      },
    },
  },
};

export const MembersTab: Story = {
  render: () => {
    const [key, setKey] = useState(0);
    
    // Force re-render to show members tab
    return (
      <div className="w-full max-w-4xl">
        <OrganizationProfile mode="inline" key={key} />
        <Button 
          onClick={() => {
            setKey(k => k + 1);
            setTimeout(() => {
              const membersButton = document.querySelector('button:has-text("Members")') as HTMLButtonElement;
              if (membersButton) membersButton.click();
            }, 0);
          }}
          className="mt-4"
        >
          Switch to Members Tab
        </Button>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'The Members tab displays team members with their roles and allows inviting new members.',
      },
    },
  },
};

export const SettingsTab: Story = {
  render: () => (
    <div className="w-full max-w-4xl">
      <OrganizationProfile mode="inline" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The Settings tab shows organization information and danger zone actions.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const [show, setShow] = useState(false);
    
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Button onClick={() => setShow(true)}>
            Open Profile Settings
          </Button>
        </div>
        
        <div className="text-sm text-gray-600 max-w-lg">
          <p className="mb-2">Try these interactions:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Switch between Profile, Members, and Settings tabs</li>
            <li>Click "Edit Profile" to enable editing</li>
            <li>Click "Invite Member" to see the invite modal</li>
            <li>View organization details in Settings</li>
          </ul>
        </div>
        
        {show && (
          <OrganizationProfile 
            mode="modal"
            onClose={() => setShow(false)}
          />
        )}
      </div>
    );
  },
};

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CreateOrganization } from './CreateOrganization';
import { Button } from '../../ui/Button';

const meta: Meta<typeof CreateOrganization> = {
  title: 'Organization/CreateOrganization',
  component: CreateOrganization,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof CreateOrganization>;

export const ModalMode: Story = {
  render: () => {
    const [show, setShow] = useState(true);
    
    return (
      <div>
        <Button onClick={() => setShow(true)}>Open Create Organization</Button>
        {show && (
          <CreateOrganization 
            onClose={() => setShow(false)}
            onSuccess={(orgId) => {
              console.log('Organization created:', orgId);
              setShow(false);
            }}
          />
        )}
      </div>
    );
  },
};

export const InlineMode: Story = {
  render: () => (
    <CreateOrganization 
      mode="inline"
      onClose={() => console.log('Close clicked')}
      onSuccess={(orgId) => console.log('Organization created:', orgId)}
    />
  ),
};

export const WithCallbacks: Story = {
  render: () => {
    const [show, setShow] = useState(true);
    const [message, setMessage] = useState('');
    
    return (
      <div className="space-y-4">
        <Button onClick={() => setShow(true)}>Create Organization</Button>
        {message && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{message}</p>
          </div>
        )}
        {show && (
          <CreateOrganization 
            onClose={() => setShow(false)}
            onSuccess={(orgId) => {
              setMessage(`Successfully created organization: ${orgId}`);
              setShow(false);
            }}
          />
        )}
      </div>
    );
  },
};

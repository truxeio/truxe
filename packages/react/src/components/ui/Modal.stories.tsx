import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Modal, ModalProps } from './Modal';
import { Button } from './Button';

const meta = {
  title: 'UI/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
    },
    title: {
      control: 'text',
    },
  },
  args: {
    title: 'Dialog title',
    size: 'md',
    children: (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          This is a basic modal dialog. Use it to show important information or actions.
        </p>
        <div className="flex justify-end space-x-2">
          <Button variant="ghost">Cancel</Button>
          <Button>Confirm</Button>
        </div>
      </div>
    ),
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

const ModalDemo = (args: ModalProps) => {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <div className="space-y-4">
      <Button onClick={() => setIsOpen(true)}>Open modal</Button>
      <Modal
        {...args}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
};

export const Default: Story = {
  render: (args) => <ModalDemo {...args} />,
};

export const Large: Story = {
  render: (args) => <ModalDemo {...args} />,
  args: {
    size: 'lg',
  },
};

export const ExtraLarge: Story = {
  render: (args) => <ModalDemo {...args} />,
  args: {
    size: 'xl',
  },
};

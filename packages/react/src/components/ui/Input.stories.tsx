import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'text',
    },
    label: {
      control: 'text',
    },
    error: {
      control: 'text',
    },
    helperText: {
      control: 'text',
    },
    fullWidth: {
      control: 'boolean',
    },
  },
  args: {
    placeholder: 'you@example.com',
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: 'email',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Email address',
  },
};

export const WithError: Story = {
  args: {
    label: 'Email address',
    error: 'Please enter a valid email',
  },
};

export const WithHelperText: Story = {
  args: {
    label: 'Email address',
    helperText: 'We will never share your email.',
  },
};

export const Password: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: '••••••••',
  },
};

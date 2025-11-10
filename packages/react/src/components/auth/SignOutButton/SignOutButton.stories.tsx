import type { Meta, StoryObj } from '@storybook/react';
import { SignOutButton } from './SignOutButton';
import { MockTruxeProvider } from '../../../storybook/MockTruxeProvider';

const meta = {
  title: 'Auth/SignOutButton',
  component: SignOutButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MockTruxeProvider isSignedIn>
        <Story />
      </MockTruxeProvider>
    ),
  ],
} satisfies Meta<typeof SignOutButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Sign out',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
  },
};

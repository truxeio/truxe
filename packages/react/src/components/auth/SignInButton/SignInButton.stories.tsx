import type { Meta, StoryObj } from '@storybook/react';
import { SignInButton } from './SignInButton';
import { MockTruxeProvider } from '../../../storybook/MockTruxeProvider';

const meta = {
  title: 'Auth/SignInButton',
  component: SignInButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MockTruxeProvider>
        <Story />
      </MockTruxeProvider>
    ),
  ],
} satisfies Meta<typeof SignInButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const CustomText: Story = {
  args: {
    children: 'Log in to your account',
  },
};

export const RedirectMode: Story = {
  args: {
    mode: 'redirect',
    redirectUrl: '/auth/signin',
  },
};

export const OutlineVariant: Story = {
  args: {
    variant: 'outline',
  },
};

export const LargeSize: Story = {
  args: {
    size: 'lg',
  },
};

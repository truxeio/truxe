import type { Meta, StoryObj } from '@storybook/react';
import { SignUpButton } from './SignUpButton';
import { MockHeimdallProvider } from '../../../storybook/MockHeimdallProvider';

const meta = {
  title: 'Auth/SignUpButton',
  component: SignUpButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MockHeimdallProvider>
        <Story />
      </MockHeimdallProvider>
    ),
  ],
} satisfies Meta<typeof SignUpButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const CustomText: Story = {
  args: {
    children: 'Create your account',
  },
};

export const RedirectMode: Story = {
  args: {
    mode: 'redirect',
    redirectUrl: '/auth/signup',
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

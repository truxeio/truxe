import type { Meta, StoryObj } from '@storybook/react';
import { OrganizationSwitcher } from './OrganizationSwitcher';

const meta: Meta<typeof OrganizationSwitcher> = {
  title: 'Organization/OrganizationSwitcher',
  component: OrganizationSwitcher,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof OrganizationSwitcher>;

export const Default: Story = {
  args: {
    showName: true,
  },
};

export const WithoutName: Story = {
  args: {
    showName: false,
  },
};

export const HideCreateButton: Story = {
  args: {
    showName: true,
    hideCreateOrganization: true,
  },
};

export const ManyOrganizations: Story = {
  args: {
    showName: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'When there are more than 5 organizations, a search input is displayed to help users find the organization they want to switch to.',
      },
    },
  },
};

export const CustomStyling: Story = {
  args: {
    showName: true,
    className: 'border-2 border-blue-500 rounded-xl',
  },
};

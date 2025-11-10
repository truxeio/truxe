import type { Meta, StoryObj } from '@storybook/react';
import { OrganizationList } from './OrganizationList';

const meta: Meta<typeof OrganizationList> = {
  title: 'Organization/OrganizationList',
  component: OrganizationList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof OrganizationList>;

export const CardLayout: Story = {
  args: {
    layout: 'card',
  },
  parameters: {
    docs: {
      description: {
        story: 'Grid layout displaying organizations as cards with avatars, names, and member information.',
      },
    },
  },
};

export const ListLayout: Story = {
  args: {
    layout: 'list',
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact list layout for viewing organizations.',
      },
    },
  },
};

export const WithClickHandler: Story = {
  args: {
    layout: 'card',
    onOrganizationClick: (orgId: string) => {
      alert(`Clicked organization: ${orgId}`);
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Organizations are clickable and trigger the onOrganizationClick callback.',
      },
    },
  },
};

export const HideCreateButton: Story = {
  args: {
    layout: 'card',
    hideCreate: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'The create organization button can be hidden using the hideCreate prop.',
      },
    },
  },
};

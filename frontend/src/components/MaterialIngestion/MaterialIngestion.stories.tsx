import type { Meta, StoryObj } from '@storybook/react';
import MaterialIngestion from './MaterialIngestion';

const meta: Meta<typeof MaterialIngestion> = {
  title: 'Components/MaterialIngestion',
  component: MaterialIngestion,
  parameters: { layout: 'padded' },
  args: {
    onSnippetsReady: (snippets) => console.log('snippets ready', snippets),
  },
};

export default meta;
type Story = StoryObj<typeof MaterialIngestion>;

export const PasteText: Story = {};

export const FileUpload: Story = {
  play: async ({ canvas }) => {
    const { getByText } = canvas;
    getByText('Upload File').click();
  },
};

export const GitHub: Story = {
  play: async ({ canvas }) => {
    const { getByText } = canvas;
    getByText('GitHub').click();
  },
};

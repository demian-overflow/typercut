import type { Meta, StoryObj } from '@storybook/react';
import SnippetBrowser from './SnippetBrowser';

const SAMPLE_SNIPPETS = [
  { id: '1', material_id: 'm1', text: 'Mitosis is the process by which a cell divides into two identical daughter cells.', word_count: 14 },
  { id: '2', material_id: 'm1', text: 'The cell cycle consists of interphase and the mitotic phase.', word_count: 11 },
  { id: '3', material_id: 'm1', text: 'During prophase, chromatin condenses into visible chromosomes.', word_count: 8 },
  { id: '4', material_id: 'm1', text: 'Spindle fibers attach to chromosomes at the kinetochore during metaphase.', word_count: 11 },
  { id: '5', material_id: 'm1', text: 'Cytokinesis physically separates the cytoplasm of the two new cells.', word_count: 11 },
];

const meta: Meta<typeof SnippetBrowser> = {
  title: 'Components/SnippetBrowser',
  component: SnippetBrowser,
  parameters: { layout: 'padded' },
  args: {
    onSelect: (text) => console.log('selected:', text),
    onBack: () => console.log('back'),
  },
};

export default meta;
type Story = StoryObj<typeof SnippetBrowser>;

export const WithSnippets: Story = {
  args: { snippets: SAMPLE_SNIPPETS },
};

export const Empty: Story = {
  args: { snippets: [] },
};

import type { Meta, StoryObj } from '@storybook/react';
import ResultsPanel from './ResultsPanel';

const meta: Meta<typeof ResultsPanel> = {
  title: 'ResultsPanel',
  component: ResultsPanel,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ResultsPanel>;

export const Good: Story = {
  args: {
    stats: { wpm: 72, accuracy: 97, durationSeconds: 31, totalKeystrokes: 224, correctKeystrokes: 217 },
    onRetry: () => {},
    onNewText: () => {},
  },
};

export const Perfect: Story = {
  args: {
    stats: { wpm: 95, accuracy: 100, durationSeconds: 22, totalKeystrokes: 185, correctKeystrokes: 185 },
    onRetry: () => {},
    onNewText: () => {},
  },
};

export const Slow: Story = {
  args: {
    stats: { wpm: 28, accuracy: 84, durationSeconds: 80, totalKeystrokes: 210, correctKeystrokes: 176 },
    onRetry: () => {},
    onNewText: () => {},
  },
};

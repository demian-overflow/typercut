import type { Meta, StoryObj } from '@storybook/react-vite';
import SpeedTyper, { type TypingStats } from './SpeedTyper';

const meta: Meta<typeof SpeedTyper> = {
  title: 'SpeedTyper',
  component: SpeedTyper,
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
type Story = StoryObj<typeof SpeedTyper>;

export const Idle: Story = {
  args: {
    text: 'The quick brown fox jumps over the lazy dog.',
    onComplete: (stats: TypingStats) => console.log('Complete', stats),
  },
};

export const LongText: Story = {
  args: {
    text: 'React hooks are functions that let you use state and other React features in function components. The useState hook returns a stateful value and a function to update it. The useEffect hook lets you perform side effects in function components.',
    onComplete: (stats: TypingStats) => console.log('Complete', stats),
  },
};

export const CodeSnippet: Story = {
  args: {
    text: 'const greet = (name: string): string => `Hello, ${name}!`;',
    onComplete: (stats: TypingStats) => console.log('Complete', stats),
  },
};

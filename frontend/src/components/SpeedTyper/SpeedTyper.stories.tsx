import type { Meta, StoryObj } from '@storybook/react-vite';
import SpeedTyper, { type TypingStats } from './SpeedTyper';
import type { GraphData } from '../../lib/textGenerator';

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

const REACT_GRAPH: GraphData = {
  nodes: [
    { id: 'n0', label: 'React', x: 0.05, y: 0.5, segment_start: 0, segment_end: 48 },
    { id: 'n1', label: 'useState', x: 0.3, y: 0.15, segment_start: 48, segment_end: 120 },
    { id: 'n2', label: 'closures', x: 0.55, y: 0.5, segment_start: 120, segment_end: 180 },
    { id: 'n3', label: 're-renders', x: 0.78, y: 0.15, segment_start: 180, segment_end: 240 },
  ],
  edges: [
    { from: 'n0', to: 'n1', label: 'enables' },
    { from: 'n1', to: 'n2', label: 'via' },
    { from: 'n2', to: 'n3', label: 'causes' },
  ],
  traversal_order: ['n0', 'n1', 'n2', 'n3'],
};

export const WithGraph: Story = {
  args: {
    text: 'React hooks let you use state inside function components. The useState hook captures values via closures created on each render. Updating state schedules a re-render, producing a fresh closure with the new value.',
    graph: REACT_GRAPH,
    onComplete: (stats: TypingStats) => console.log('Complete', stats),
  },
};

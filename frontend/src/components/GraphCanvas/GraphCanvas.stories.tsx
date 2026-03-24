import type { Meta, StoryObj } from '@storybook/react-vite';
import GraphCanvas from './GraphCanvas';
import type { GraphData } from '../../lib/textGenerator';

const meta: Meta<typeof GraphCanvas> = {
  title: 'GraphCanvas',
  component: GraphCanvas,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GraphCanvas>;

const GRAPH: GraphData = {
  nodes: [
    { id: 'n0', label: 'React', x: 0.05, y: 0.5, segment_start: 0, segment_end: 60 },
    { id: 'n1', label: 'useState', x: 0.28, y: 0.15, segment_start: 60, segment_end: 130 },
    { id: 'n2', label: 'closures', x: 0.5, y: 0.5, segment_start: 130, segment_end: 200 },
    { id: 'n3', label: 're-renders', x: 0.72, y: 0.15, segment_start: 200, segment_end: 270 },
    { id: 'n4', label: 'useEffect', x: 0.95, y: 0.5, segment_start: 270, segment_end: 340 },
  ],
  edges: [
    { from: 'n0', to: 'n1', label: 'enables' },
    { from: 'n1', to: 'n2', label: 'via' },
    { from: 'n2', to: 'n3', label: 'causes' },
    { from: 'n3', to: 'n4', label: 'triggers' },
  ],
  traversal_order: ['n0', 'n1', 'n2', 'n3', 'n4'],
};

export const Idle: Story = {
  args: {
    graph: GRAPH,
    activeNodeId: null,
    visitedNodeIds: new Set(),
  },
};

export const MidTraversal: Story = {
  args: {
    graph: GRAPH,
    activeNodeId: 'n2',
    visitedNodeIds: new Set(['n0', 'n1']),
  },
};

export const Complete: Story = {
  args: {
    graph: GRAPH,
    activeNodeId: null,
    visitedNodeIds: new Set(['n0', 'n1', 'n2', 'n3', 'n4']),
  },
};

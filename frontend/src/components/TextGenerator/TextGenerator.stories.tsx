import type { Meta, StoryObj } from '@storybook/react-vite';
import TextGenerator from './TextGenerator';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">{children}</div>
);

const meta: Meta<typeof TextGenerator> = {
  title: 'TextGenerator',
  component: TextGenerator,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <Wrapper><Story /></Wrapper>],
};

export default meta;
type Story = StoryObj<typeof TextGenerator>;

export const Default: Story = {
  args: {
    onGenerated: (text: string) => console.log('Generated:', text),
  },
};

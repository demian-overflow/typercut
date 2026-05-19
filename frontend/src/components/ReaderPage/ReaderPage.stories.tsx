import type { Meta, StoryObj } from '@storybook/react-vite';
import ReaderPage from './ReaderPage';
import { schedulerEssay } from '../../fixtures/scheduler-essay';

const meta = {
  title: 'Reader/ReaderPage',
  component: ReaderPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ReaderPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Scheduler: Story = {
  args: { essay: schedulerEssay },
};

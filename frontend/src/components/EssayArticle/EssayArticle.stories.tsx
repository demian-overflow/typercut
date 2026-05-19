import type { Meta, StoryObj } from '@storybook/react-vite';
import EssayArticle from './EssayArticle';
import { schedulerEssay } from '../../fixtures/scheduler-essay';

const meta = {
  title: 'Reader/EssayArticle',
  component: EssayArticle,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof EssayArticle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Scheduler: Story = {
  args: { essay: schedulerEssay },
};

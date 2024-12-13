import type { Meta, StoryObj } from '@storybook/react';
// import { within, userEvent, expect } from '@storybook/test';

import { Destinations } from './Destinations';

const meta = {
  title: 'App/Pages/Sink',
  component: Destinations,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Destinations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Landing: Story = {};



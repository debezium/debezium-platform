import type { Meta, StoryObj } from "@storybook/react";
// import { within, userEvent, expect } from '@storybook/test';

import { Sources } from "./Sources";

const meta = {
  title: "App/Pages/Source",
  component: Sources,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: "fullscreen",
  },
} satisfies Meta<typeof Sources>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Landing: Story = {};

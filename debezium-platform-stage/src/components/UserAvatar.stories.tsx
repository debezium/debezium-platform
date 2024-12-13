// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from "@storybook/react";

import UserAvatar from "./UserAvatar";

const meta: Meta<typeof UserAvatar> = {
  title: "App/Components/Header/UserAvatar",
  component: UserAvatar,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof UserAvatar>;

export const Primary: Story = {
  args: {

  },
};

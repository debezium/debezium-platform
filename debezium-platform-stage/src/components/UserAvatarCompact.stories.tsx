// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from "@storybook/react";

import UserAvatarCompact from "./UserAvatarCompact";

const meta: Meta<typeof UserAvatarCompact> = {
  title: "App/Components/Header/UserAvatarCompact",
  component: UserAvatarCompact,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof UserAvatarCompact>;

export const Primary: Story = {
  args: {

  },
};

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import UserAvatarCompact from "./UserAvatarCompact";
import { render } from "../__test__/unit/test-utils";

describe("UserAvatarCompact", () => {
  it("opens the compact menu from the kebab toggle", async () => {
    const user = userEvent.setup();
    render(<UserAvatarCompact />);

    await user.click(
      screen.getByRole("button", { name: "kebab dropdown toggle" }),
    );
    expect(screen.getByRole("menuitem", { name: "Username" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "My profile" })).toBeInTheDocument();
  });

  it("closes via toggle click and Escape", async () => {
    const user = userEvent.setup();
    render(<UserAvatarCompact />);

    const toggle = screen.getByRole("button", { name: "kebab dropdown toggle" });
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));

    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));

    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
  });

  it("collapses when selecting a menu item", async () => {
    const user = userEvent.setup();
    render(<UserAvatarCompact />);

    const toggle = screen.getByRole("button", { name: "kebab dropdown toggle" });
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));
    await user.click(screen.getByRole("menuitem", { name: "Logout" }));
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
  });
});

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import UserAvatar from "./UserAvatar";
import { render } from "../__test__/unit/test-utils";

describe("UserAvatar", () => {
  it("opens the menu and lists profile actions", async () => {
    const user = userEvent.setup();
    render(<UserAvatar />);

    await user.click(screen.getByRole("button", { name: /username/i }));
    expect(screen.getByRole("menuitem", { name: "My profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "User management" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
  });

  it("closes the menu from the toggle and via Escape (onOpenChange)", async () => {
    const user = userEvent.setup();
    render(<UserAvatar />);

    const toggle = screen.getByRole("button", { name: /username/i });
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));

    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));

    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
  });

  it("collapses the menu when a menu item is selected (onSelect)", async () => {
    const user = userEvent.setup();
    render(<UserAvatar />);

    const toggle = screen.getByRole("button", { name: /username/i });
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));
    await user.click(screen.getByRole("menuitem", { name: "My profile" }));
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
  });
});

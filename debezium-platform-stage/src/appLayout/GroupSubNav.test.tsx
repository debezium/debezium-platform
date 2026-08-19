import { screen, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GroupSubNav, { useActiveGroupSubNav } from "./GroupSubNav";
import { useData } from "./AppContext";
import { render } from "../__test__/unit/test-utils";

vi.mock("./AppContext", () => ({
  useData: vi.fn(),
}));

const mockUseData = (navigationCollapsed: boolean) =>
  vi.mocked(useData).mockReturnValue({
    darkMode: false,
    navigationCollapsed,
    setDarkMode: vi.fn(),
    glassMode: false,
    setGlassMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  });

describe("GroupSubNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when the sidebar is open, regardless of current route", () => {
    mockUseData(false);
    render(<GroupSubNav />, { initialEntries: ["/alerts/rules"] });

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders nothing on routes that don't belong to any sidebar group", () => {
    mockUseData(true);
    render(<GroupSubNav />, { initialEntries: ["/pipeline"] });

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("mirrors the Alerts sidebar group as a horizontal subnav when the sidebar is collapsed", () => {
    mockUseData(true);
    render(<GroupSubNav />, { initialEntries: ["/alerts/channels"] });

    expect(screen.getByRole("navigation", { name: "Alerts sub-navigation" })).toBeInTheDocument();

    const channelsLink = screen.getByRole("link", { name: "Channels" });
    expect(channelsLink).toHaveClass("pf-m-current");
    expect(screen.getByRole("link", { name: "Rules" })).not.toHaveClass("pf-m-current");
    expect(screen.getByRole("link", { name: "Events" })).not.toHaveClass("pf-m-current");
  });

  it("keeps the Rules subnav item current on create and edit rule pages", () => {
    mockUseData(true);
    render(<GroupSubNav />, { initialEntries: ["/alerts/rules/create_rule"] });

    expect(screen.getByRole("link", { name: "Rules" })).toHaveClass("pf-m-current");
    expect(screen.getByRole("link", { name: "Channels" })).not.toHaveClass("pf-m-current");
  });
});

describe("useActiveGroupSubNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AppLayout relies on this returning null/non-null *before* rendering <GroupSubNav />,
  // so Page's horizontalSubnav wrapper is never mounted with empty content.
  it("returns null when the sidebar is open", () => {
    mockUseData(false);
    const { result } = renderHook(() => useActiveGroupSubNav(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/alerts/rules"]}>{children}</MemoryRouter>
      ),
    });

    expect(result.current).toBeNull();
  });

  it("returns the matching group and its visible routes when applicable", () => {
    mockUseData(true);
    const { result } = renderHook(() => useActiveGroupSubNav(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/alerts/history"]}>{children}</MemoryRouter>
      ),
    });

    expect(result.current?.group.label).toBe("Alerts");
    expect(result.current?.routes.map((route) => route.label)).toEqual(
      expect.arrayContaining(["Rules", "Channels", "Events"])
    );
  });
});

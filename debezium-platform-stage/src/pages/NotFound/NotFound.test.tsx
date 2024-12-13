import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFound } from "./NotFound";
import { MemoryRouter } from "react-router-dom";
import { useData } from "../../appLayout/AppContext";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../appLayout/AppContext", () => ({
  useData: vi.fn(),
}));

describe("NotFound Component", () => {
  beforeEach(() => {
    vi.mocked(useData).mockReturnValue({
      darkMode: false,
      navigationCollapsed: false,
      setDarkMode: vi.fn(),
      updateNavigationCollapsed: vi.fn(),
    });
  });

  it("renders the component with correct content", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );

    expect(
      screen.getByText(
        "We didn't find a page that matches the address you navigated to."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Take me home")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Destination")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
  });
});

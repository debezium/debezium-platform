import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DebeziumNode from "./DebeziumNode";
import { render } from "../../__test__/unit/test-utils";

vi.mock("../../appLayout/AppContext", () => ({
  useData: () => ({
    darkMode: false,
    navigationCollapsed: false,
    setDarkMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  }),
}));

describe("DebeziumNode", () => {
  it("renders the Debezium logo", () => {
    render(
      <DebeziumNode
        data={{ label: "Debezium", handleCollapsed: vi.fn() }}
      />,
    );

    expect(screen.getByRole("img", { name: /Debezium icon/i })).toBeInTheDocument();
  });
});

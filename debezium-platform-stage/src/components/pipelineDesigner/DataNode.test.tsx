import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ReactFlowProvider } from "reactflow";
import DataNode from "./DataNode";
import { AppStrings } from "../../utils/constants";
import { render } from "../../__test__/unit/test-utils";

vi.mock("../../appLayout/AppContext", () => ({
  useData: () => ({
    darkMode: false,
    navigationCollapsed: false,
    setDarkMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  }),
}));

describe("DataNode", () => {
  it("renders label and connector image for a source node", () => {
    const editAction = vi.fn();
    render(
      <ReactFlowProvider>
        <DataNode
          data={{
            connectorType: "mongodb",
            label: "Orders",
            type: AppStrings.source,
            editAction,
          }}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /MongoDB icon/i }),
    ).toBeInTheDocument();
  });

  it("renders edit control when editAction is provided", async () => {
    const editAction = vi.fn();
    const user = userEvent.setup();

    render(
      <ReactFlowProvider>
        <DataNode
          data={{
            connectorType: "kafka",
            label: "K",
            type: AppStrings.source,
            editAction,
          }}
        />
      </ReactFlowProvider>,
    );

    const editHitArea = document.querySelector(".editDataNodeSource");
    expect(editHitArea).toBeTruthy();
    await user.click(editHitArea as HTMLElement);
    expect(editAction).toHaveBeenCalled();
  });
});

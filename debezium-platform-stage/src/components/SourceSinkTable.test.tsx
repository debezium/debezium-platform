/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "react-query";
import SourceSinkTable from "./SourceSinkTable";
import { useDeleteData } from "src/apis";
import { useNotification } from "../appLayout/AppNotificationContext";
import pipelinesMock from "../__mocks__/data/Pipelines.json";
import { render } from "../__test__/unit/test-utils";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
  };
});

vi.mock("src/apis", async (importOriginal) => {
  const mod = await importOriginal<typeof import("src/apis")>();
  return {
    ...mod,
    useDeleteData: vi.fn(),
  };
});

vi.mock("../appLayout/AppNotificationContext", () => ({
  useNotification: vi.fn(),
}));

vi.mock("./UsedIn", () => ({
  default: () => <span data-testid="used-in-stub" />,
}));

vi.mock("./ComponentImage", () => ({
  default: () => <span data-testid="connector-stub" />,
}));

const sourceInstance = {
  id: 7,
  name: "Warehouse",
  type: "postgresql",
  schema: "",
  vaults: [],
  config: {},
};

describe("SourceSinkTable", () => {
  const addNotification = vi.fn();
  let deletedUrls: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    deletedUrls = [];
    vi.mocked(useQuery).mockReturnValue({
      data: pipelinesMock,
      error: null,
      isLoading: false,
    } as any);
    vi.mocked(useDeleteData).mockImplementation(
      (opts: any): any => ({
        mutate: vi.fn((url: string) => {
          deletedUrls.push(url);
          opts?.onSuccess?.();
        }),
      }),
    );
    vi.mocked(useNotification).mockReturnValue({
      addNotification,
    } as any);
  });

  it("shows empty search state for source and calls onClear", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <SourceSinkTable tableType="source" data={[]} onClear={onClear} />,
    );

    await user.click(screen.getByRole("button", { name: /clear search/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it("navigates to source view from name link", async () => {
    const user = userEvent.setup();
    render(
      <SourceSinkTable tableType="source" data={[sourceInstance]} onClear={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Warehouse" }));
    expect(mockNavigate).toHaveBeenCalledWith("/source/7?state=view", {
      state: { mode: "view" },
    });
  });

  it("deletes a destination after confirmation", async () => {
    const user = userEvent.setup();
    const dest = {
      id: 9,
      name: "Events",
      type: "kafka",
      schema: "",
      vaults: [],
      config: {},
    };

    render(
      <SourceSinkTable tableType="destination" data={[dest]} onClear={vi.fn()} />,
    );

    const row = screen.getByRole("button", { name: "Events" }).closest("tr");
    await user.click(
      within(row as HTMLElement).getByRole("button", { name: /kebab toggle/i }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/delete name/i), "Events");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(deletedUrls.some((u) => u.includes("/api/destinations/9"))).toBe(
        true,
      );
    });
    expect(addNotification).toHaveBeenCalledWith(
      "success",
      expect.any(String),
      expect.stringContaining("destination"),
    );
  });

  it("notifies on delete error", async () => {
    vi.mocked(useDeleteData).mockImplementation(
      (opts: any): any => ({
        mutate: vi.fn(() => {
          opts?.onError?.(new Error("boom"));
        }),
      }),
    );

    const user = userEvent.setup();
    render(
      <SourceSinkTable tableType="source" data={[sourceInstance]} onClear={vi.fn()} />,
    );

    const row = screen.getByRole("button", { name: "Warehouse" }).closest("tr");
    await user.click(
      within(row as HTMLElement).getByRole("button", { name: /kebab toggle/i }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/delete name/i), "Warehouse");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(addNotification).toHaveBeenCalledWith(
        "danger",
        expect.any(String),
        expect.stringContaining("source"),
      );
    });
  });
});

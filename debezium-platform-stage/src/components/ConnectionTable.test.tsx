/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ConnectionTable from "./ConnectionTable";
import type { Catalog } from "src/apis/types";
import type { Connection } from "src/apis/apis";
import { useDeleteData } from "src/apis";
import { useNotification } from "../appLayout/AppNotificationContext";
import { render } from "../__test__/unit/test-utils";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
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

const catalog: Catalog[] = [
  {
    class: "mariadb",
    name: "MariaDB",
    description: "",
    descriptor: "",
    role: "source",
  },
];

const connectionRow: Connection = {
  id: 42,
  name: "Alpha connection",
  type: "mariadb",
  config: {},
};

describe("ConnectionTable", () => {
  const addNotification = vi.fn();
  let mutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mutate = vi.fn();
    vi.mocked(useDeleteData).mockImplementation((opts: any) => ({
      mutate: vi.fn((url: string) => {
        mutate(url);
        opts?.onSuccess?.();
      }),
    }));
    vi.mocked(useNotification).mockReturnValue({
      addNotification,
    } as any);
  });

  it("renders empty search state and invokes onClear", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <ConnectionTable
        data={[]}
        sourceList={[]}
        destinationList={[]}
        catalog={catalog}
        onClear={onClear}
      />,
    );

    await user.click(screen.getByRole("button", { name: /clear search/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it("navigates to view when connection name is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionTable
        data={[connectionRow]}
        sourceList={[]}
        destinationList={[]}
        catalog={catalog}
        onClear={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Alpha connection" }));
    expect(mockNavigate).toHaveBeenCalledWith("/connections/42?state=view");
  });

  it("opens delete modal, confirms delete, and calls mutate", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionTable
        data={[connectionRow]}
        sourceList={[]}
        destinationList={[]}
        catalog={catalog}
        onClear={vi.fn()}
      />,
    );

    const row = screen.getByRole("button", { name: "Alpha connection" }).closest("tr");
    expect(row).toBeTruthy();
    const actionsButton = within(row as HTMLElement).getByRole("button", {
      name: /kebab toggle/i,
    });
    await user.click(actionsButton);
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/delete name/i), "Alpha connection");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        expect.stringContaining("/api/connections/42"),
      );
    });
    expect(addNotification).toHaveBeenCalledWith(
      "success",
      expect.any(String),
      expect.any(String),
    );
  });

  it("navigates to edit from row actions", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionTable
        data={[connectionRow]}
        sourceList={[]}
        destinationList={[]}
        catalog={catalog}
        onClear={vi.fn()}
      />,
    );

    const row = screen.getByRole("button", { name: "Alpha connection" }).closest("tr");
    const actionsButton = within(row as HTMLElement).getByRole("button", {
      name: /kebab toggle/i,
    });
    await user.click(actionsButton);
    await user.click(await screen.findByRole("menuitem", { name: /edit/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/connections/42?state=edit");
  });

  it("posts a structured delete error notification", async () => {
    vi.mocked(useDeleteData).mockImplementation((opts: any) => ({
      mutate: vi.fn(() => {
        opts?.onError?.(
          new Error(
            "prefix: [ERROR:summary text Detail: detail text] trailing",
          ),
        );
      }),
    }));

    const user = userEvent.setup();
    render(
      <ConnectionTable
        data={[connectionRow]}
        sourceList={[]}
        destinationList={[]}
        catalog={catalog}
        onClear={vi.fn()}
      />,
    );

    const row = screen.getByRole("button", { name: "Alpha connection" }).closest("tr");
    await user.click(
      within(row as HTMLElement).getByRole("button", { name: /kebab toggle/i }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/delete name/i), "Alpha connection");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(addNotification).toHaveBeenCalledWith(
        "danger",
        expect.any(String),
        expect.stringContaining("ERROR:"),
      );
    });
  });
});

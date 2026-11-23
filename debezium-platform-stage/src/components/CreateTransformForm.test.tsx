/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
import { render } from "../__test__/unit/test-utils";
import CreateTransformForm from "./CreateTransformForm";

const refetchCatalog = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
  };
});

describe("CreateTransformForm catalog errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockImplementation((options: any) => {
      const queryKey = Array.isArray(options?.queryKey)
        ? options.queryKey[0]
        : options?.queryKey;
      if (queryKey === "componentCatalog") {
        return {
          data: undefined,
          error: new Error("network failed"),
          isLoading: false,
          refetch: refetchCatalog,
        };
      }
      return {
        data: undefined,
        error: null,
        isLoading: false,
        refetch: vi.fn(),
      };
    });
  });

  it("shows the catalog failure inside the transform dropdown", () => {
    render(
      <CreateTransformForm onSubmit={vi.fn()} defaultLayoutMode="tabs" />,
    );

    expect(screen.getByText("Transform name")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load catalog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByPlaceholderText("Select a transform"));

    expect(
      screen.getByText("Failed to load catalog: network failed"),
    ).toBeInTheDocument();
    expect(screen.getByText("Transform name")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetchCatalog).toHaveBeenCalledTimes(1);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "react-query";
import TransformSelectionList from "./TransformSelectionList";
import type { TransformData } from "../apis/apis";
import pipelinesMock from "../__mocks__/data/Pipelines.json";
import { render } from "../__test__/unit/test-utils";

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
  };
});

describe("TransformSelectionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue({
      data: pipelinesMock,
      error: null,
      isLoading: false,
    } as any);
  });

  it("renders empty state when there are no transforms", () => {
    const onSelection = vi.fn();
    render(<TransformSelectionList data={[]} onSelection={onSelection} />);

    expect(
      screen.getByRole("heading", { name: /no transform available/i }),
    ).toBeInTheDocument();
  });

  it("renders table rows and invokes onSelection on row click", () => {
    const onSelection = vi.fn();
    const row: TransformData = {
      id: 6,
      name: "filter-transform",
      type: "io.debezium.transforms.Filter",
      schema: "",
      vaults: [],
      config: {},
    };

    render(<TransformSelectionList data={[row]} onSelection={onSelection} />);

    expect(screen.getByRole("cell", { name: "filter-transform" })).toBeInTheDocument();
    const [, dataRow] = screen.getAllByRole("row");
    fireEvent.click(dataRow);
    expect(onSelection).toHaveBeenCalledWith([row]);
  });
});

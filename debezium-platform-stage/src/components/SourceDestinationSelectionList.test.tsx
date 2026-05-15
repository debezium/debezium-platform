/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "react-query";
import SourceDestinationSelectionList from "./SourceDestinationSelectionList";
import type { Source } from "../apis/apis";
import pipelinesMock from "../__mocks__/data/Pipelines.json";
import { render } from "../__test__/unit/test-utils";

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
  };
});

vi.mock("./TrademarkMessage", () => ({
  default: () => null,
}));

describe("SourceDestinationSelectionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue({
      data: pipelinesMock,
      error: null,
      isLoading: false,
    } as any);
  });

  it("renders empty state for source when data is empty", () => {
    const onSelection = vi.fn();
    render(
      <SourceDestinationSelectionList
        tableType="source"
        data={[]}
        onSelection={onSelection}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /no source available/i }),
    ).toBeInTheDocument();
  });

  it("renders source rows and calls onSelection", () => {
    const onSelection = vi.fn();
    const src: Source = {
      id: 2,
      name: "test-case",
      type: "postgresql",
      schema: "",
      vaults: [],
      config: {},
    };

    render(
      <SourceDestinationSelectionList
        tableType="source"
        data={[src]}
        onSelection={onSelection}
      />,
    );

    expect(screen.getByRole("cell", { name: "test-case" })).toBeInTheDocument();
    const [, dataRow] = screen.getAllByRole("row");
    fireEvent.click(dataRow);
    expect(onSelection).toHaveBeenCalledWith(src);
  });
});

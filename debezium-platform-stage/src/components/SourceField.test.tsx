/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Table, Tbody, Tr } from "@patternfly/react-table";
import SourceField from "./SourceField";
import { fetchDataTypeTwo } from "../apis/apis";
import { render } from "../__test__/unit/test-utils";

vi.mock("../apis/apis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../apis/apis")>();
  return {
    ...actual,
    fetchDataTypeTwo: vi.fn(),
  };
});

vi.mock("./ComponentImage", () => ({
  default: ({ connectorType }: { connectorType: string }) => (
    <span data-testid="connector">{connectorType}</span>
  ),
}));

describe("SourceField", () => {
  beforeEach(() => {
    vi.mocked(fetchDataTypeTwo).mockReset();
  });

  it("loads source and shows name with connector", async () => {
    vi.mocked(fetchDataTypeTwo).mockResolvedValue({
      data: {
        id: 9,
        name: "ignored",
        type: "postgresql",
        schema: "",
        vaults: [],
        config: {},
      },
      error: null,
    } as any);

    render(
      <Table aria-label="t">
        <Tbody>
          <Tr>
            <SourceField pipelineSource={{ id: 9, name: "Warehouse PG" }} />
          </Tr>
        </Tbody>
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByText("Warehouse PG")).toBeInTheDocument();
    });
    expect(screen.getByTestId("connector")).toHaveTextContent("postgresql");
  });

  it("shows small ApiError when fetch fails", async () => {
    vi.mocked(fetchDataTypeTwo).mockResolvedValue({
      data: null,
      error: "nope",
    } as any);

    render(
      <Table aria-label="t">
        <Tbody>
          <Tr>
            <SourceField pipelineSource={{ id: 1, name: "x" }} />
          </Tr>
        </Tbody>
      </Table>,
    );

    expect(await screen.findByText("Error : Failed to load")).toBeInTheDocument();
  });
});

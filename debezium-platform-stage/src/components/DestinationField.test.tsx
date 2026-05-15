/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Table, Tbody, Tr } from "@patternfly/react-table";
import DestinationField from "./DestinationField";
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

describe("DestinationField", () => {
  beforeEach(() => {
    vi.mocked(fetchDataTypeTwo).mockReset();
  });

  it("loads destination and shows name with connector", async () => {
    vi.mocked(fetchDataTypeTwo).mockResolvedValue({
      data: {
        id: 3,
        name: "ignored",
        type: "kafka",
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
            <DestinationField
              pipelineDestination={{ id: 3, name: "Events topic" }}
            />
          </Tr>
        </Tbody>
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByText("Events topic")).toBeInTheDocument();
    });
    expect(screen.getByTestId("connector")).toHaveTextContent("kafka");
  });
});

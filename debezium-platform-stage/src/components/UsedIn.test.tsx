/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import UsedIn from "./UsedIn";
import type { Connection, Pipeline, Source } from "src/apis";
import { sourcePageNavState } from "@sourcePage/sourcePageNavigation";
import { render } from "../__test__/unit/test-utils";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

const pipeline = (overrides: Partial<Pipeline> = {}): Pipeline =>
  ({
    id: 1,
    name: "indra-ui-test",
    description: "",
    destination: { id: 2, name: "test-infi" },
    source: { id: 2, name: "test-case" },
    transforms: [{ id: 6, name: "filter-transform" }],
    logLevel: "ERROR",
    logLevels: {},
    ...overrides,
  }) as Pipeline;

describe("UsedIn", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("renders a disabled label when nothing references the instance", () => {
    render(
      <UsedIn
        resourceList={[]}
        resourceType="pipeline"
        instance={{ id: 99, name: "x" } as Source}
        requestedPageType="source"
      />,
    );

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows popover with pipeline link for an active source", async () => {
    const user = userEvent.setup();
    const src: Source = {
      id: 2,
      name: "My source",
      type: "postgresql",
      schema: "",
      vaults: [],
      config: {},
    };

    render(
      <UsedIn
        resourceList={[pipeline()]}
        resourceType="pipeline"
        instance={src}
        requestedPageType="source"
      />,
    );

    const trigger = document.querySelector(".pf-v6-c-label.pf-m-blue");
    expect(trigger).toBeTruthy();
    await user.hover(trigger as HTMLElement);
    const link = await screen.findByRole("button", { name: "indra-ui-test" });
    await user.click(link);
    expect(mockNavigate).toHaveBeenCalledWith("/pipeline/1/overview");
  });

  it("navigates to source detail when connection mode and resource is source", async () => {
    const user = userEvent.setup();
    const src: Source = {
      id: 5,
      name: "ConnSrc",
      type: "mysql",
      schema: "",
      vaults: [],
      config: {},
      connection: { id: 10, name: "c" },
    };

    render(
      <UsedIn
        resourceList={[src]}
        resourceType="source"
        instance={{ id: 10, name: "conn" } as Connection}
        requestedPageType="connection"
      />,
    );

    const trigger = document.querySelector(".pf-v6-c-label.pf-m-blue");
    expect(trigger).toBeTruthy();
    await user.hover(trigger as HTMLElement);
    await user.click(await screen.findByRole("button", { name: "ConnSrc" }));
    expect(mockNavigate).toHaveBeenCalledWith("/source/5?state=view", {
      state: sourcePageNavState.view,
    });
  });
});

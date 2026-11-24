/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
import { render } from "../__test__/unit/test-utils";
import CreateTransformForm from "./CreateTransformForm";

const refetchCatalog = vi.fn();

let catalogPhase: "error" | "success" = "error";

const editCatalog = {
  components: {
    transformation: [
      {
        class: "io.example.Filter",
        name: "Filter",
        description: "Filter records",
        descriptor: "transformation/filter.json",
      },
      {
        class: "io.example.Router",
        name: "Router",
        description: "Route records",
        descriptor: "transformation/router.json",
      },
    ],
    predicate: [],
  },
};

const transformSchema = {
  name: "filter",
  type: "transform",
  version: "1",
  metadata: { description: "" },
  groups: [],
  properties: [
    {
      name: "expression",
      type: "string",
      display: {
        label: "Expression",
        description: "Expression",
        group: "General",
        groupOrder: 1,
      },
      validation: [],
      valueDependants: [],
    },
  ],
};

const editTransform = {
  id: 7,
  name: "my-filter",
  type: "io.example.Filter",
  schema: "transformation/filter",
  vaults: [],
  description: "keeps rows",
  config: { expression: "keep-me" },
};

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
  };
});

describe("CreateTransformForm catalog errors", () => {
  beforeEach(() => {
    catalogPhase = "error";
    vi.clearAllMocks();
    vi.mocked(useQuery).mockImplementation((options: any): any => {
      const queryKey = Array.isArray(options?.queryKey)
        ? options.queryKey[0]
        : options?.queryKey;
      if (queryKey === "componentCatalog") {
        if (catalogPhase === "error") {
          return {
            data: undefined,
            error: new Error("network failed"),
            isLoading: false,
            refetch: refetchCatalog,
          };
        }
        return {
          data: editCatalog,
          error: null,
          isLoading: false,
          refetch: refetchCatalog,
        };
      }
      if (queryKey === "transformSchema") {
        return {
          data: transformSchema,
          error: null,
          isLoading: false,
          refetch: vi.fn(),
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

    const classInput = screen.getByPlaceholderText("Select a transform");
    fireEvent.click(classInput);

    expect(
      screen.getByText("Failed to load catalog: network failed"),
    ).toBeInTheDocument();
    expect(screen.getByText("Transform name")).toBeInTheDocument();

    fireEvent.keyDown(classInput, { key: "Tab" });
    expect(
      screen.getByText("Failed to load catalog: network failed"),
    ).toBeInTheDocument();

    fireEvent.keyDown(classInput, { key: "Escape" });
    expect(
      screen.queryByText("Failed to load catalog: network failed"),
    ).not.toBeInTheDocument();

    fireEvent.click(classInput);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetchCatalog).toHaveBeenCalledTimes(1);
  });

  it("keeps the loaded class and configuration after catalog retry in edit mode", () => {
    refetchCatalog.mockImplementation(() => {
      catalogPhase = "success";
    });

    const form = (
      <CreateTransformForm
        onSubmit={vi.fn()}
        defaultLayoutMode="tabs"
        initialTransform={editTransform}
      />
    );
    const { rerender } = render(form);

    const classField = document.getElementById("transform-class-input") as HTMLElement;
    expect(classField.closest("[disabled]")).not.toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Predicate" }));
    fireEvent.click(screen.getByPlaceholderText("Select a predicate (optional)"));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    rerender(form);

    const loadedClassField = document.getElementById(
      "transform-class-input",
    ) as HTMLElement;
    const loadedClassInput = loadedClassField.querySelector(
      "input",
    ) as HTMLInputElement;
    expect(loadedClassInput).toHaveValue("Filter");
    expect(loadedClassField.closest("[disabled]")).not.toBeNull();
    expect(screen.getByDisplayValue("my-filter")).toBeInTheDocument();
    expect(screen.getByDisplayValue("keep-me")).toBeInTheDocument();

    fireEvent.click(loadedClassInput);
    expect(screen.queryByRole("option", { name: "Router" })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("keep-me")).toBeInTheDocument();
  });

  it("keeps a typed name and description when the catalog retry succeeds", () => {
    refetchCatalog.mockImplementation(() => {
      catalogPhase = "success";
    });

    const form = (
      <CreateTransformForm
        onSubmit={vi.fn()}
        defaultLayoutMode="tabs"
        initialTransform={editTransform}
      />
    );
    const { rerender } = render(form);

    const nameInput = document.getElementById("transform-name") as HTMLInputElement;
    const descriptionInput = document.getElementById(
      "transform-description",
    ) as HTMLInputElement;
    expect(nameInput).toHaveValue("my-filter");
    expect(descriptionInput).toHaveValue("keeps rows");

    fireEvent.change(nameInput, { target: { value: "custom-name" } });
    fireEvent.change(descriptionInput, { target: { value: "custom description" } });

    fireEvent.click(screen.getByRole("tab", { name: "Predicate" }));
    fireEvent.click(screen.getByPlaceholderText("Select a predicate (optional)"));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    rerender(form);

    expect(document.getElementById("transform-name")).toHaveValue("custom-name");
    expect(document.getElementById("transform-description")).toHaveValue(
      "custom description",
    );
    expect(
      document
        .getElementById("transform-class-input")
        ?.querySelector("input"),
    ).toHaveValue("Filter");
    expect(screen.getByDisplayValue("keep-me")).toBeInTheDocument();
  });
});

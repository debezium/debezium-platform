import type { PageContext } from "./types";

export const pageContextMap: Record<string, PageContext> = {
  "/": { label: "Overview", hint: "debezium platform overview" },
  "/source/create_source": {
    label: "Creating a Source",
    hint: "source connector configuration",
  },
  "/source/catalog": {
    label: "Source Catalog",
    hint: "source connector catalog",
  },
  "/source": { label: "Source Details", hint: "source connector configuration" },
  "/destination/create_destination": {
    label: "Creating a Destination",
    hint: "destination sink configuration",
  },
  "/destination/catalog": {
    label: "Destination Catalog",
    hint: "destination sink catalog",
  },
  "/destination": {
    label: "Destination Details",
    hint: "destination sink configuration",
  },
  "/pipeline/pipeline_designer/create_pipeline": {
    label: "Creating a Pipeline",
    hint: "pipeline setup debezium",
  },
  "/pipeline/pipeline_designer": {
    label: "Creating a Pipeline",
    hint: "pipeline setup debezium",
  },
  "/pipeline": { label: "Pipeline Details", hint: "pipeline" },
  "/transform/create_transform": {
    label: "Creating a Transform",
    hint: "single message transforms SMT",
  },
  "/transform": {
    label: "Transforms",
    hint: "single message transforms SMT",
  },
  "/connections/create_connection": {
    label: "Creating a Connection",
    hint: "connection configuration",
  },
  "/connections/catalog": {
    label: "Connections Catalog",
    hint: "connection catalog",
  },
  "/connections": {
    label: "Connections",
    hint: "connections configuration",
  },
  "/vaults": { label: "Vaults", hint: "debezium platform vault secrets" },
};

export const defaultContext: PageContext = {
  label: "Debezium Platform",
  hint: "",
};

export function getPageContext(pathname: string): PageContext {
  const sorted = Object.keys(pageContextMap).sort(
    (a, b) => b.length - a.length
  );
  const match =
    sorted.find((key) => pathname.startsWith(key) && key !== "/") ??
    (pathname === "/" ? "/" : null);
  return match ? pageContextMap[match] : defaultContext;
}

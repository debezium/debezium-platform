
export type DestinationPageLocationState = {
  mode: "view" | "edit";
};

/** Use with navigate(url, { state: destinationPageNavState.view }) */
export const destinationPageNavState = {
  view: { mode: "view" } satisfies DestinationPageLocationState,
  edit: { mode: "edit" } satisfies DestinationPageLocationState,
};

export function resolveDestinationPageViewMode(
  locationState: unknown,
  queryState: string | null
): boolean {
  const s = locationState as DestinationPageLocationState | null | undefined;
  if (s?.mode === "view") return true;
  if (s?.mode === "edit") return false;

  if (queryState === "view") return true;
  if (queryState === "edit") return false;

  return false;
}

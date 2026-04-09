
export type SourcePageLocationState = {
  mode: "view" | "edit";
};

/** Use with navigate(url, { state: sourcePageNavState.view }) */
export const sourcePageNavState = {
  view: { mode: "view" } satisfies SourcePageLocationState,
  edit: { mode: "edit" } satisfies SourcePageLocationState,
};

export function resolveSourcePageViewMode(
  locationState: unknown,
  queryState: string | null
): boolean {
  const s = locationState as SourcePageLocationState | null | undefined;
  if (s?.mode === "view") return true;
  if (s?.mode === "edit") return false;

  if (queryState === "view") return true;
  if (queryState === "edit") return false;

  return false;
}

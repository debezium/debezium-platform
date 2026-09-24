
export type TransformPageLocationState = {
  mode: "view" | "edit";
};

/** Use with navigate(url, { state: transformPageNavState.view }) */
export const transformPageNavState = {
  view: { mode: "view" } satisfies TransformPageLocationState,
  edit: { mode: "edit" } satisfies TransformPageLocationState,
};

export function resolveTransformPageViewMode(
  locationState: unknown,
  queryState: string | null
): boolean {
  const s = locationState as TransformPageLocationState | null | undefined;
  if (s?.mode === "view") return true;
  if (s?.mode === "edit") return false;

  if (queryState === "view") return true;
  if (queryState === "edit") return false;

  return false;
}

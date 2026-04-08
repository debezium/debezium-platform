/**
 * How the source detail page should open — pass via react-router location.state and/or ?state= query.
 * Query params survive refresh; location.state expresses intent for in-app navigation.
 */
export type SourcePageLocationState = {
  mode: "view" | "edit";
};

/** Use with navigate(url, { state: sourcePageNavState.view }) */
export const sourcePageNavState = {
  view: { mode: "view" } satisfies SourcePageLocationState,
  edit: { mode: "edit" } satisfies SourcePageLocationState,
};

/**
 * view = read-only summary + form; edit = full schema form with save.
 * Precedence: `location.state.mode` (in-app navigation), then `?state=view|edit` (bookmark/refresh),
 * else default edit mode.
 */
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

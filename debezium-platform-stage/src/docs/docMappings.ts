import rawMappings from "./docMappings.json";
import { DOC_BASE, connectorDocUrl, connectorRoutes } from "./connectorDocUrl";

export interface DocMapping {
  /**
   * Base path prefix(es) to match against the current route (e.g.
   * "/source/create_source"). An array lets the same doc target be reused
   * across multiple sections - e.g. a connector class reachable both from
   * "/destination/create_destination" and "/connections/create_connection".
   */
  route: string | string[];
  /**
   * When true, `route` must equal the pathname exactly rather than merely
   * prefix it. Needed for routes like "/" that would otherwise match every
   * pathname in the app.
   */
  exact?: boolean;
  /**
   * Optional substring that must also appear in the pathname for this mapping
   * to apply - used for connector-specific entries, since the selected
   * connector class (e.g. "io.debezium.connector.postgresql.PostgresConnector")
   * is embedded directly in the create-source/create-destination URL. Entries
   * without a classMatch act as the generic fallback for their route.
   */
  classMatch?: string;
  title: string;
  docUrl: string;
  /** HTML id of the target section on docUrl. Omit to link the page as a whole. */
  sectionId?: string;
}

/** A single one-off page mapping, as authored in docMappings.json's "pages" list. */
interface PageEntry {
  route: string | string[];
  exact?: boolean;
  title: string;
  /** Path relative to DOC_BASE, e.g. "connectors/index.html". */
  docUrl: string;
  sectionId?: string;
}

/**
 * A connector class, as authored in docMappings.json's "connectorClasses"
 * list. Unlike PageEntry, `route` and `docUrl` are deliberately *not*
 * present here - they're derived from `class` itself (see connectorDocUrl.ts)
 * so that adding a new connector never requires re-deriving which routes it
 * should appear on or which debezium.io page documents it by hand.
 */
interface ConnectorClassEntry {
  class: string;
  title: string;
  /** HTML id of the target section on the derived docUrl. */
  sectionId: string;
}

interface RawDocMappings {
  pages: PageEntry[];
  connectorClasses: ConnectorClassEntry[];
}

const raw = rawMappings as RawDocMappings;

function expandPage(page: PageEntry): DocMapping {
  return { ...page, docUrl: `${DOC_BASE}${page.docUrl}` };
}

function expandConnectorClass(entry: ConnectorClassEntry): DocMapping {
  return {
    route: connectorRoutes(entry.class),
    classMatch: entry.class,
    title: entry.title,
    docUrl: connectorDocUrl(entry.class),
    sectionId: entry.sectionId,
  };
}

export const docMappings: DocMapping[] = [
  ...raw.pages.map(expandPage),
  ...raw.connectorClasses.map(expandConnectorClass),
];

function routeList(route: string | string[]): string[] {
  return Array.isArray(route) ? route : [route];
}

/** Length of the most specific route in `mapping` that matches `pathname`, or -1 if none match. */
function matchedRouteLength(pathname: string, mapping: DocMapping): number {
  const lengths = routeList(mapping.route)
    .filter((r) => (mapping.exact ? pathname === r : pathname.startsWith(r)))
    .map((r) => r.length);
  return lengths.length ? Math.max(...lengths) : -1;
}

function mostSpecific(pathname: string, mappings: DocMapping[]): DocMapping {
  return mappings.reduce((best, m) =>
    matchedRouteLength(pathname, m) > matchedRouteLength(pathname, best) ? m : best
  );
}

/**
 * Resolves the doc mapping (if any) that applies to the current route.
 * Class-specific entries (classMatch set, and the class name is actually
 * present in the pathname) always win over the generic per-section fallback,
 * since a connector's create page URL embeds its fully-qualified class name.
 */
export function resolveDocMapping(pathname: string): DocMapping | null {
  const routeMatches = docMappings.filter((m) => matchedRouteLength(pathname, m) >= 0);
  if (routeMatches.length === 0) return null;

  const classMatches = routeMatches.filter(
    (m) => m.classMatch && pathname.includes(m.classMatch)
  );
  if (classMatches.length > 0) return mostSpecific(pathname, classMatches);

  const genericMatches = routeMatches.filter((m) => !m.classMatch);
  if (genericMatches.length === 0) return null;
  return mostSpecific(pathname, genericMatches);
}

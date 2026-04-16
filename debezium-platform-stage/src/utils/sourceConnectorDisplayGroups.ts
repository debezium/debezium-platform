import type { ConnectorSchema, SchemaProperty } from "../apis/types";

/**
 * Groups schema properties for source-connector create/edit/review UIs.
 * Hides the catalog "Connection" and "Connection Advanced Ssl" groups in the UI
 * except `topic.prefix`, which is shown under the Connector group.
 */
export function buildSourceConnectorDisplayGroupedProperties(
  connectorSchema: ConnectorSchema
): Map<string, SchemaProperty[]> {
  const map = new Map<string, SchemaProperty[]>();
  const { properties, groups } = connectorSchema;

  const topicPrefixDisplayGroup = groups.some((g) => g.name === "Connector")
    ? "Connector"
    : groups
        .slice()
        .sort((a, b) => a.order - b.order)
        .find((g) => g.name !== "Connection")?.name ?? "Advanced";

  for (const prop of properties) {
    const { group } = prop.display;
    if (group === "Connection Advanced Ssl") {
      continue;
    }
    if (group === "Connection" && prop.name !== "topic.prefix") {
      continue;
    }
    const effectiveGroup =
      group === "Connection" && prop.name === "topic.prefix" ? topicPrefixDisplayGroup : group;
    if (!map.has(effectiveGroup)) map.set(effectiveGroup, []);
    map.get(effectiveGroup)!.push(prop);
  }

  return map;
}

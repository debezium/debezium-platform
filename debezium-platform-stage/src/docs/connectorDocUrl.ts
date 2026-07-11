
export const DOC_BASE = "https://debezium.io/documentation/reference/stable/";

const SOURCE_CONNECTOR_PREFIX = "io.debezium.connector.";
const SERVER_SINK_PREFIX = "io.debezium.server.";

const DOC_SLUG_OVERRIDES: Record<string, string> = {
  "io.debezium.connector.mongodb.MongoDbSinkConnector": "mongodb-sink",
};

//  Debezium Server sink consumer
export function isServerSinkClass(connectorClass: string): boolean {
  return connectorClass.startsWith(SERVER_SINK_PREFIX);
}


export function isSinkConnectorClass(connectorClass: string): boolean {
  return (
    connectorClass.startsWith(SOURCE_CONNECTOR_PREFIX) &&
    connectorClass.endsWith("SinkConnector")
  );
}

/** True for any class reachable from the destination/sink side of the app. */
export function isDestinationClass(connectorClass: string): boolean {
  return isServerSinkClass(connectorClass) || isSinkConnectorClass(connectorClass);
}

function classPackageSegment(connectorClass: string, prefix: string): string | null {
  if (!connectorClass.startsWith(prefix)) return null;
  return connectorClass.slice(prefix.length).split(".")[0];
}


export function connectorDocUrl(connectorClass: string): string {
  if (isServerSinkClass(connectorClass)) {
    return `${DOC_BASE}operations/debezium-server.html`;
  }
  const slug =
    DOC_SLUG_OVERRIDES[connectorClass] ??
    classPackageSegment(connectorClass, SOURCE_CONNECTOR_PREFIX) ??
    connectorClass;
  return `${DOC_BASE}connectors/${slug}.html`;
}


export function connectorRoutes(connectorClass: string): string[] {
  const base = isDestinationClass(connectorClass)
    ? "/destination/create_destination"
    : "/source/create_source";
  return [base, "/connections/create_connection"];
}

import { describe, expect, it } from "vitest";
import { API_URL } from "@utils/constants";
import {
  alertRuleActionPath,
  catalogDescriptorPath,
  connectionCollectionsPath,
  destinationPath,
  monitoringPanelQueryPath,
  pipelineLogsStreamPath,
  resourceCollectionPath,
  snapshotHistoryDetailPath,
  snapshotHistoryPath,
  snapshotProgressStreamPath,
  sourcePath,
  sourcesPath,
} from "./endpoints";

describe("endpoint paths", () => {
  it("builds absolute resource URLs", () => {
    expect(sourcesPath()).toBe(`${API_URL}/api/sources`);
    expect(sourcePath(7)).toBe(`${API_URL}/api/sources/7`);
    expect(destinationPath("orders")).toBe(`${API_URL}/api/destinations/orders`);
    expect(connectionCollectionsPath(3)).toBe(`${API_URL}/api/connections/3/collections`);
    expect(catalogDescriptorPath("io.debezium.connector.postgresql.PostgresConnector")).toBe(
      `${API_URL}/api/catalog/io.debezium.connector.postgresql.PostgresConnector`
    );
    expect(resourceCollectionPath("source")).toBe(`${API_URL}/api/sources`);
  });

  it("keeps query strings and nested pipeline routes on the same URL shape", () => {
    expect(snapshotHistoryPath("7", "page=0&size=20")).toBe(
      `${API_URL}/api/pipelines/7/snapshots/history?page=0&size=20`
    );
    expect(snapshotHistoryDetailPath("7", 9)).toBe(
      `${API_URL}/api/pipelines/7/snapshots/history/9`
    );
    expect(snapshotProgressStreamPath("7")).toBe(
      `${API_URL}/api/pipelines/7/snapshots/progress/stream`
    );
    expect(monitoringPanelQueryPath("source-lag", "pipeline_id=orders&start=0&end=1")).toBe(
      `${API_URL}/api/monitoring/panels/source-lag/query?pipeline_id=orders&start=0&end=1`
    );
    expect(alertRuleActionPath(4, "disable")).toBe(`${API_URL}/api/alerts/rules/4/disable`);
  });

  it("builds the pipeline log stream as a plain http url", () => {
    // Not ws:// — the log stream is SSE now, so a bearer token can be attached
    // to it the same way as to any other request.
    expect(pipelineLogsStreamPath("7")).toBe(
      `${API_URL}/api/pipelines/7/logs/stream`
    );
  });
});

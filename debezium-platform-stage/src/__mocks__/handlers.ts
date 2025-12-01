import { http, HttpResponse } from "msw";

import pipelinesData from "./data/Pipelines.json";
import sourcesData from "./data/Sources.json";
import destinationsData from "./data/Destinations.json";
import sourceDetails_2 from "./data/SourceDetails_2.json";
import destinationDetails_2 from "./data/DestinationDetails_2.json";

// Intercept API requests - using wildcard to match both relative and absolute URLs
export const handlers = [
  //Pipeline
  http.get("*/api/pipelines", () => {
    return HttpResponse.json(pipelinesData);
  }),
  http.get("*/api/pipelines/:pipelineId/logs", () => {
    return new HttpResponse("log line 1\nlog line 2\nlog line 3", {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }),
  http.get("*/api/pipelines/:pipelineId", () => {
    // Return the first pipeline from mock data for any pipeline ID
    return HttpResponse.json(pipelinesData[0]);
  }),
  //Source
  http.get("*/api/sources", () => {
    return HttpResponse.json(sourcesData);
  }),
  http.get("*/api/sources/:sourceId", ({ params }) => {
    const { sourceId } = params;
    // Return specific mock data for ID 2, or generic data for others
    if (sourceId === "2") {
      return HttpResponse.json(sourceDetails_2);
    }
    return HttpResponse.json(sourceDetails_2); // Default response
  }),
  //Destination
  http.get("*/api/destinations", () => {
    return HttpResponse.json(destinationsData);
  }),
  http.get("*/api/destinations/:destinationId", ({ params }) => {
    const { destinationId } = params;
    // Return specific mock data for ID 2, or generic data for others
    if (destinationId === "2") {
      return HttpResponse.json(destinationDetails_2);
    }
    return HttpResponse.json(destinationDetails_2); // Default response
  }),
  //Connection
  http.get("*/api/connections", () => {
    return HttpResponse.json(destinationsData);
  }),
  http.get("*/api/connections/:connectionId/collections", () => {
    // Return empty collections data
    return HttpResponse.json({ collections: [] });
  }),
];

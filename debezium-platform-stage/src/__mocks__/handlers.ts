import { http, HttpResponse } from "msw";

import pipelinesData from "./data/Pipelines.json";
import sourcesData from "./data/Sources.json";
import destinationsData from "./data/Destinations.json";
import sourceDetails_2 from "./data/SourceDetails_2.json";
import destinationDetails_2 from "./data/DestinationDetails_2.json";

// Intercept "GET https://example.com/user" requests...
export const handlers = [
  //Pipeline
  http.get("/api/pipelines", () => {
    return HttpResponse.json(pipelinesData);
  }),
  //Source
  http.get("/api/sources", () => {
    return HttpResponse.json(sourcesData);
  }),
  http.get("/api/sources/2", () => {
    return HttpResponse.json(sourceDetails_2);
  }),
  //Destination
  http.get("/api/destinations", () => {
    return HttpResponse.json(destinationsData);
  }),
  http.get("/api/destinations/2", () => {
    return HttpResponse.json(destinationDetails_2);
  }),
  //Connection
  http.get("/api/connections", () => {
    return HttpResponse.json(destinationsData);
  }),
];

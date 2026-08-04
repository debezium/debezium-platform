import { Pipeline, PipelinePayload } from "../apis/apis";

export const getActivePipelineCount = (
  pipelineList: Pipeline[],
  id: number,
  type: "source" | "destination" | "transform" = "transform"
): number => {
  if (type === "transform") {
    return pipelineList.filter((pipeline) =>
      Array.isArray(pipeline["transforms"]) &&
      pipeline["transforms"].some(transform => transform.id === id)
    ).length;
  } else {
    return pipelineList.filter((pipeline) => pipeline[type].id === id).length;
  }
};

export const buildPipelineRestartPayload = (
  pipeline: Pipeline
): PipelinePayload => ({
  name: pipeline.name,
  description: pipeline.description,
  source: {
    id: pipeline.source.id,
    name: pipeline.source.name,
  },
  destination: {
    id: pipeline.destination.id,
    name: pipeline.destination.name,
  },
  transforms: pipeline.transforms.map(({ id, name }) => ({ id, name })),
  logLevel: pipeline.logLevel,
  logLevels: pipeline.logLevels ?? {},
});

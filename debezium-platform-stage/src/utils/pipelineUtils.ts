import { Pipeline } from "../apis/apis";

export const getActivePipelineCount = (
  pipelineList: Pipeline[],
  id: number,
  type: "source" | "destination"
): number => {
  return pipelineList.filter((pipeline) => pipeline[type].id === id).length;
};

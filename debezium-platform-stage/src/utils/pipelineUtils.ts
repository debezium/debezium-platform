import { Pipeline } from "../apis/apis";

export const getActivePipelineCount = (
  pipelineList: Pipeline[],
  id: number,
  type: "source" | "destination" | "transform" = "transform"
): number => {
  if(type === "transform") {
return pipelineList.filter((pipeline) =>
  Array.isArray(pipeline["transforms"]) &&
  pipeline["transforms"].some(transform => transform.id === id)
).length;
  }else {
return pipelineList.filter((pipeline) => pipeline[type].id === id).length;
  }
  
};

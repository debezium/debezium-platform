import { Source, Destination } from "../apis/apis";

export const getActiveConnectionCount = (
  resourceList: Source[] | Destination[],
  id: number,
): number => {
    return resourceList.filter((resource) => resource?.connection?.id === id).length;
};

import { Source, Destination } from "../apis/apis";

export const getActiveConnectionCount = (
  resourceList: Source[] | Destination[],
  id: number,
): number => {
  return resourceList.filter((resource) => resource?.connection?.id === id).length;
};

export const getActiveResourceName = (
  resourceList: Source[] | Destination[],
  id: number,
): string => {
  const resourceNames = resourceList.map((resource) => {
    if (resource?.connection?.id === id) {
      return resource?.name;
    }
  });
  return resourceNames.join(", ");
};

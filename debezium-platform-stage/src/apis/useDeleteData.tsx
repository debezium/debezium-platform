import { useQueryClient, useMutation } from "react-query";
import { deleteData } from "./apis";

export const useDeleteData = ({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>((url: string) => deleteData(url), {
    onSuccess: () => {
      // Invalidate and refetch the data after deletion
      queryClient.invalidateQueries("pipelines");
      queryClient.invalidateQueries("destinations");
      queryClient.invalidateQueries("sources");
      queryClient.invalidateQueries("transforms");

      // Call the optional onSuccess callback from the component
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      console.error("Error deleting data:", error);

      // Call the optional onError callback from the component
      if (onError) {
        onError(error);
      }
    },
  });
};

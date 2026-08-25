import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskEstimate from "@/fetchers/task/update-task-estimate";

type UpdateTaskEstimateVariables = {
  taskId: string;
  projectId: string;
  estimatedMinutes: number | null;
};

export function useUpdateTaskEstimate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, estimatedMinutes }: UpdateTaskEstimateVariables) =>
      updateTaskEstimate(taskId, estimatedMinutes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.taskId],
      });
      // The due-date sibling also invalidates ["notifications"]; this route
      // publishes no event, so no notification can exist to invalidate.
    },
  });
}

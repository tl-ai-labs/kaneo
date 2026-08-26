import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskEstimatedHours from "@/fetchers/task/update-task-estimated-hours";

export function useUpdateTaskEstimatedHours() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: {
      id: string;
      projectId: string;
      estimatedHours: number | null;
    }) => updateTaskEstimatedHours(variables.id, variables.estimatedHours),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
    },
  });
}

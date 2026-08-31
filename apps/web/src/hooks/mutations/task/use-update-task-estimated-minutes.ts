import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskEstimatedMinutes from "@/fetchers/task/update-task-estimated-minutes";
import type Task from "@/types/task";

export function useUpdateTaskEstimatedMinutes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      task,
      estimatedMinutes,
    }: {
      task: Task;
      estimatedMinutes: number | null;
    }) => updateTaskEstimatedMinutes(task.id, estimatedMinutes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.task.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.task.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
    },
  });
}

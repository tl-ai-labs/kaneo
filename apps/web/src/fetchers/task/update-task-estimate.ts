import { client } from "@kaneo/libs";

async function updateTaskEstimate(
  taskId: string,
  estimatedMinutes: number | null,
) {
  const response = await client.task.estimate[":id"].$put({
    param: { id: taskId },
    json: {
      estimatedMinutes,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskEstimate;

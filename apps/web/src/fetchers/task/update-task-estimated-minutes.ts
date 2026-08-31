import { client } from "@kaneo/libs";

async function updateTaskEstimatedMinutes(
  taskId: string,
  estimatedMinutes: number | null,
) {
  const response = await client.task["estimated-minutes"][":id"].$put({
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

export default updateTaskEstimatedMinutes;

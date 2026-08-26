import { client } from "@kaneo/libs";

async function updateTaskEstimatedHours(
  taskId: string,
  estimatedHours: number | null,
) {
  const response = await client.task["estimated-hours"][":id"].$put({
    param: { id: taskId },
    json: { estimatedHours },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default updateTaskEstimatedHours;

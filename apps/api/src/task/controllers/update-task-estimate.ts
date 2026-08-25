import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function updateTaskEstimate({
  id,
  estimatedMinutes,
}: {
  id: string;
  estimatedMinutes: number | null;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({ estimatedMinutes })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task estimate",
    });
  }

  // No publishEvent here, unlike every sibling task controller: activitySchema's
  // type is a closed picklist with no estimate member, so there is no valid event
  // to emit. Publishing one requires widening that picklist first.
  return updatedTask;
}

export default updateTaskEstimate;

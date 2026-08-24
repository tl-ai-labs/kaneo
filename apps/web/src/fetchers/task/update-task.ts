import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import type Task from "@/types/task";

type UpdateTaskPriority = InferRequestType<
  (typeof client)["task"][":id"]["$put"]
>["json"]["priority"];

async function updateTask(taskId: string, task: Task) {
  const response = await client.task[":id"].$put({
    param: { id: taskId },
    json: {
      userId: task.userId || "",
      title: task.title,
      description: task.description || "",
      status: task.status,
      // The API validates priority against a picklist that has no empty
      // member, so a task carrying no priority has to be sent as the explicit
      // "no priority" value rather than "". Sending "" rejected the whole
      // update, which is what broke dragging every imported task.
      priority: (task.priority || "no-priority") as UpdateTaskPriority,
      startDate: task.startDate?.toString(),
      dueDate: task.dueDate?.toString(),
      // `undefined` (a cached task predating the field, e.g. a drag-and-drop
      // payload) omits the key so the stored value is preserved; explicit
      // `null` clears; a number sets. `?? null` here would silently wipe the
      // estimate on every card move.
      ...(task.estimatedHours === undefined
        ? {}
        : { estimatedHours: task.estimatedHours }),
      position: task.position ?? 0,
      projectId: task.projectId,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTask;

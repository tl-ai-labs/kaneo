import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import db from "../database";
import { columnTable } from "../database/schema";
import { ESTIMATED_MINUTES_MAX } from "../schemas";

export { ESTIMATED_MINUTES_MAX };

export const VALID_PRIORITIES = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const VIRTUAL_STATUSES = ["planned", "archived"] as const;

export const estimatedMinutesSchema = v.nullable(
  v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(ESTIMATED_MINUTES_MAX),
  ),
);

export function assertValidPriority(priority: string): void {
  if (!(VALID_PRIORITIES as readonly string[]).includes(priority)) {
    throw new HTTPException(400, {
      message: `Invalid priority "${priority}". Valid values: ${VALID_PRIORITIES.join(", ")}`,
    });
  }
}

export async function getValidTaskStatuses(
  projectId: string,
): Promise<string[]> {
  const columns = await db
    .select({ slug: columnTable.slug })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position));

  return [...columns.map((c) => c.slug), ...VIRTUAL_STATUSES];
}

export async function assertValidTaskStatus(
  status: string,
  projectId: string,
): Promise<void> {
  const validStatuses = await getValidTaskStatuses(projectId);

  if (!validStatuses.includes(status)) {
    throw new HTTPException(400, {
      message: `Invalid status "${status}". Valid statuses for this project: ${validStatuses.join(", ")}`,
    });
  }
}

export function coerceStatus(
  status: string,
  validStatuses: string[],
): { status: string; warning?: string } {
  if (validStatuses.includes(status)) {
    return { status };
  }
  return {
    status: "planned",
    warning: `Unknown status "${status}" mapped to "planned"`,
  };
}

export function coercePriority(priority: string): {
  priority: string;
  warning?: string;
} {
  if ((VALID_PRIORITIES as readonly string[]).includes(priority)) {
    return { priority };
  }
  return {
    priority: "no-priority",
    warning: `Unknown priority "${priority}" mapped to "no-priority"`,
  };
}

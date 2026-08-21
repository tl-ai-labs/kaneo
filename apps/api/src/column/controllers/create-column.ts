import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import db from "../../database";
import { columnTable } from "../../database/schema";
import { VIRTUAL_STATUSES } from "../../task/validate-task-fields";

export function toSlug(name: string): string {
  const slug = name
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return /[\p{L}\p{N}]/u.test(slug) ? slug : "";
}

// Bounded at the int4 ceiling so an out-of-range limit is a 400 from the API
// rather than an "integer out of range" 500 raised by PostgreSQL. `v.integer()`
// is required because `v.number()` alone accepts floats.
export const wipLimitSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(2147483647),
);

async function createColumn({
  projectId,
  name,
  icon,
  color,
  isFinal,
  wipLimit,
}: {
  projectId: string;
  name: string;
  icon?: string;
  color?: string;
  isFinal?: boolean;
  wipLimit?: number | null;
}) {
  const slug = toSlug(name);

  if (!slug) {
    throw new HTTPException(400, {
      message: "Column name must contain at least one alphanumeric character",
    });
  }

  if ((VIRTUAL_STATUSES as readonly string[]).includes(slug)) {
    throw new HTTPException(409, {
      message: `Column slug "${slug}" is reserved for virtual task statuses`,
    });
  }

  const existing = await db
    .select({ id: columnTable.id })
    .from(columnTable)
    .where(
      sql`${columnTable.projectId} = ${projectId} AND ${columnTable.slug} = ${slug}`,
    );

  if (existing.length > 0) {
    throw new HTTPException(409, {
      message: `Column with slug "${slug}" already exists in this project`,
    });
  }

  const [maxPos] = await db
    .select({
      maxPosition: sql<number>`COALESCE(MAX(${columnTable.position}), -1)`,
    })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId));

  const position = (maxPos?.maxPosition ?? -1) + 1;

  const [created] = await db
    .insert(columnTable)
    .values({
      projectId,
      name,
      slug,
      position,
      icon: icon || null,
      color: color || null,
      isFinal: isFinal ?? false,
      // `??` and never `||`: 0 is not a legal limit, but `0 || null` would
      // silently coerce a caller-supplied 0 to "no limit" instead of storing it.
      wipLimit: wipLimit ?? null,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create column" });
  }

  return created;
}

export default createColumn;

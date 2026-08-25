import * as v from "valibot";

/**
 * Soft work-in-progress cap for a column.
 * Positive integer sets the cap; `null` clears it; omitting the field on update
 * leaves the stored value untouched. Advisory only — never enforced.
 */
export const wipLimitSchema = v.optional(
  v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
);

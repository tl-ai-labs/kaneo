import * as v from "valibot";

/**
 * Soft work-in-progress cap for a column.
 * Positive integer sets the cap; `null` clears it; omitting the field on update
 * leaves the stored value untouched. Advisory only — never enforced.
 * Upper bound is PostgreSQL's int4 max, so an out-of-range value is a clean 400
 * from the validator rather than a 22003 error surfacing as a 500.
 */
export const wipLimitSchema = v.optional(
  v.nullable(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647)),
  ),
);

import * as v from "valibot";

// PostgreSQL int4 upper bound. A larger value would reach the driver as a
// range error and surface as a 500 instead of a 400.
export const MAX_ESTIMATED_MINUTES = 2147483647;
export const MIN_ESTIMATED_MINUTES = 1;

export const estimatedMinutesSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(MIN_ESTIMATED_MINUTES),
  v.maxValue(MAX_ESTIMATED_MINUTES),
);

export const estimatedMinutesFieldSchema = v.optional(
  v.nullable(estimatedMinutesSchema),
);

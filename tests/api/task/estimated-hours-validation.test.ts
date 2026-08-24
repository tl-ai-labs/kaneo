import * as v from "valibot";
import { describe, expect, it } from "vitest";

// Mirrors the estimatedHours validator in apps/api/src/task/index.ts. If the
// bounds there change, change them here too.
const estimatedHoursSchema = v.optional(
  v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1000))),
);

describe("task estimatedHours Valibot schema validation", () => {
  const validCases = [0, 1, 1000, undefined, null];
  const invalidCases = [
    -1,
    1001,
    0.5,
    "8",
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ];

  for (const val of validCases) {
    it(`accepts valid value: ${String(val)}`, () => {
      const result = v.safeParse(estimatedHoursSchema, val);
      expect(result.success).toBe(true);
    });
  }

  for (const val of invalidCases) {
    it(`rejects invalid value: ${String(val)}`, () => {
      const result = v.safeParse(estimatedHoursSchema, val);
      expect(result.success).toBe(false);
    });
  }
});

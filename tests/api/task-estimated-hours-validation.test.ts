import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  MAX_ESTIMATED_HOURS,
  nullableEstimatedHoursSchema,
  optionalEstimatedHoursSchema,
} from "../../apps/api/src/task/validate-task-fields";

describe("MAX_ESTIMATED_HOURS", () => {
  it("should be 10000", () => {
    expect(MAX_ESTIMATED_HOURS).toBe(10000);
  });
});

describe("nullableEstimatedHoursSchema", () => {
  it("should accept 2.5 and preserve the value exactly", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, 2.5);
    expect(result.success).toBe(true);
    expect(result.output).toBe(2.5);
  });

  it("should accept 0.25 and preserve the value exactly", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, 0.25);
    expect(result.success).toBe(true);
    expect(result.output).toBe(0.25);
  });

  it("should accept 0.5 and preserve the value exactly", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, 0.5);
    expect(result.success).toBe(true);
    expect(result.output).toBe(0.5);
  });

  it("should accept 0 as a legal estimate, not treat it as unset", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, 0);
    expect(result.success).toBe(true);
    expect(result.output).toBe(0);
  });

  it("should accept null", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, null);
    expect(result.success).toBe(true);
    expect(result.output).toBeNull();
  });

  it("should reject -1 with the exact negative-value message", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, -1);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0].message).toBe(
        "Estimated hours cannot be negative",
      );
    }
  });

  it("should reject -0.5 with the exact negative-value message", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, -0.5);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0].message).toBe(
        "Estimated hours cannot be negative",
      );
    }
  });

  it("should reject Number.POSITIVE_INFINITY", () => {
    const result = v.safeParse(
      nullableEstimatedHoursSchema,
      Number.POSITIVE_INFINITY,
    );
    expect(result.success).toBe(false);
  });

  it("should reject Number.NaN", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, Number.NaN);
    expect(result.success).toBe(false);
  });

  it("should reject 10001 as exceeding the maximum", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, 10001);
    expect(result.success).toBe(false);
  });

  it("should accept 10000 as the inclusive boundary", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, 10000);
    expect(result.success).toBe(true);
    expect(result.output).toBe(10000);
  });

  it("should round 2.005 to 2.01 to match the numeric(7,2) column scale", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, 2.005);
    expect(result.success).toBe(true);
    expect(result.output).toBe(2.01);
  });

  it("should reject undefined because the single-field route requires the key to be present", () => {
    const result = v.safeParse(nullableEstimatedHoursSchema, undefined);
    expect(result.success).toBe(false);
  });
});

describe("optionalEstimatedHoursSchema", () => {
  it("should accept undefined", () => {
    const result = v.safeParse(optionalEstimatedHoursSchema, undefined);
    expect(result.success).toBe(true);
    expect(result.output).toBeUndefined();
  });
});

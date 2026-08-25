import { describe, expect, it } from "vitest";
import {
  MAX_ESTIMATED_MINUTES,
  normalizeEstimatedMinutes,
} from "../../../apps/api/src/task/estimated-minutes";

const TYPE_MESSAGE = "estimatedMinutes must be a number or null";
const RANGE_MESSAGE =
  "estimatedMinutes must be a whole number of minutes between 1 and 525600";

// The thrown value is a hono HTTPException. Its constructor name is checked
// instead of instanceof so this suite keeps importing only the module under
// test.
function catchThrown(value: unknown): Error & { status: number } {
  try {
    normalizeEstimatedMinutes(value);
  } catch (error) {
    return error as Error & { status: number };
  }

  throw new Error(
    `normalizeEstimatedMinutes(${String(value)}) was expected to throw`,
  );
}

describe("MAX_ESTIMATED_MINUTES", () => {
  it("is one year of minutes", () => {
    expect(MAX_ESTIMATED_MINUTES).toBe(525600);
  });
});

describe("normalizeEstimatedMinutes", () => {
  it("returns an accepted estimate unchanged", () => {
    expect(normalizeEstimatedMinutes(150)).toBe(150);
    expect(normalizeEstimatedMinutes(1)).toBe(1);
    expect(normalizeEstimatedMinutes(525600)).toBe(525600);
  });

  it("clears the estimate for null and undefined", () => {
    expect(normalizeEstimatedMinutes(null)).toBeNull();
    expect(normalizeEstimatedMinutes(undefined)).toBeNull();
  });

  it("rejects numbers that are not whole minutes in range", () => {
    const rejected = [
      0,
      -5,
      90.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      525601,
      999999999,
    ];

    for (const value of rejected) {
      expect(() => normalizeEstimatedMinutes(value)).toThrow();

      const error = catchThrown(value);
      expect(error.constructor.name).toBe("HTTPException");
      expect(error.status).toBe(400);
      expect(error.message).toBe(RANGE_MESSAGE);
    }
  });

  it("rejects values that are not numbers when called directly", () => {
    const rejected = ["abc", "150", true];

    for (const value of rejected) {
      expect(() => normalizeEstimatedMinutes(value)).toThrow();

      const error = catchThrown(value);
      expect(error.constructor.name).toBe("HTTPException");
      expect(error.status).toBe(400);
      expect(error.message).toBe(TYPE_MESSAGE);
    }
  });
});

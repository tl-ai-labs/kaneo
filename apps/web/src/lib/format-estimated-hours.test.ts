import { describe, expect, it } from "vitest";
import {
  formatEstimatedHours,
  sumEstimatedMinutes,
} from "./format-estimated-hours";

describe("formatEstimatedHours", () => {
  it("formats 120 minutes as 2h", () => {
    expect(formatEstimatedHours(120)).toBe("2h");
  });

  it("formats 60 minutes as 1h", () => {
    expect(formatEstimatedHours(60)).toBe("1h");
  });

  it("formats 150 minutes as 2.5h", () => {
    expect(formatEstimatedHours(150)).toBe("2.5h");
  });

  it("formats 45 minutes as 0.75h", () => {
    expect(formatEstimatedHours(45)).toBe("0.75h");
  });

  it("returns null for 0", () => {
    expect(formatEstimatedHours(0)).toBeNull();
  });

  it("returns null for -10", () => {
    expect(formatEstimatedHours(-10)).toBeNull();
  });

  it("returns null for null", () => {
    expect(formatEstimatedHours(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(formatEstimatedHours(undefined)).toBeNull();
  });
});

describe("sumEstimatedMinutes", () => {
  it("returns 0 for an empty task list", () => {
    expect(sumEstimatedMinutes([])).toBe(0);
  });

  it("sums tasks with estimated minutes [120, 240] to 360", () => {
    expect(
      sumEstimatedMinutes([
        { estimatedMinutes: 120 },
        { estimatedMinutes: 240 },
      ]),
    ).toBe(360);
  });

  it("sums a mix of [150, null, undefined] to 150", () => {
    expect(
      sumEstimatedMinutes([
        { estimatedMinutes: 150 },
        { estimatedMinutes: null },
        { estimatedMinutes: undefined },
      ]),
    ).toBe(150);
  });

  it("returns 0 for all-null estimates [null, null]", () => {
    expect(
      sumEstimatedMinutes([
        { estimatedMinutes: null },
        { estimatedMinutes: null },
      ]),
    ).toBe(0);
  });
});

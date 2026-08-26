import { describe, expect, it } from "vitest";
import {
  estimatedHoursForRequest,
  parseEstimatedHoursInput,
  sumEstimatedHours,
} from "./estimated-hours";

describe("sumEstimatedHours", () => {
  it("returns 0 for an empty array", () => {
    expect(sumEstimatedHours([])).toBe(0);
  });

  it("treats null and missing estimatedHours as 0", () => {
    expect(
      sumEstimatedHours([
        { estimatedHours: 2.5 },
        { estimatedHours: null },
        {},
        { estimatedHours: 0.25 },
      ]),
    ).toBe(2.75);
  });

  it("avoids floating point artifacts", () => {
    expect(
      sumEstimatedHours([{ estimatedHours: 0.1 }, { estimatedHours: 0.2 }]),
    ).toBe(0.3);
  });

  it("returns 0 when all estimatedHours are 0", () => {
    expect(
      sumEstimatedHours([{ estimatedHours: 0 }, { estimatedHours: 0 }]),
    ).toBe(0);
  });
});

describe("parseEstimatedHoursInput", () => {
  it("returns null value for an empty string", () => {
    expect(parseEstimatedHoursInput("")).toEqual({ ok: true, value: null });
  });

  it("returns null value for a whitespace-only string", () => {
    expect(parseEstimatedHoursInput("   ")).toEqual({ ok: true, value: null });
  });

  it("treats an explicit 0 as distinct from empty", () => {
    expect(parseEstimatedHoursInput("0")).toEqual({ ok: true, value: 0 });
  });

  it("parses a decimal value", () => {
    expect(parseEstimatedHoursInput("2.5")).toEqual({ ok: true, value: 2.5 });
  });

  it("rejects negative values", () => {
    expect(parseEstimatedHoursInput("-1").ok).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(parseEstimatedHoursInput("abc").ok).toBe(false);
  });

  it("rejects values above the maximum", () => {
    expect(parseEstimatedHoursInput("10001").ok).toBe(false);
  });

  it("accepts the maximum value", () => {
    expect(parseEstimatedHoursInput("10000").ok).toBe(true);
  });
});

describe("estimatedHoursForRequest", () => {
  it("returns undefined for an empty string", () => {
    expect(estimatedHoursForRequest("")).toBeUndefined();
  });

  it("returns undefined for a whitespace-only string", () => {
    expect(estimatedHoursForRequest("   ")).toBeUndefined();
  });

  it("returns undefined for non-numeric input", () => {
    expect(estimatedHoursForRequest("abc")).toBeUndefined();
  });

  it("returns undefined for negative values", () => {
    expect(estimatedHoursForRequest("-1")).toBeUndefined();
  });

  it("returns undefined for values above the maximum", () => {
    expect(estimatedHoursForRequest("10001")).toBeUndefined();
  });

  it("returns 0 for an explicit zero", () => {
    const result = estimatedHoursForRequest("0");
    expect(result).not.toBeUndefined();
    expect(result).toBe(0);
  });

  it("parses a decimal value", () => {
    expect(estimatedHoursForRequest("2.5")).toBe(2.5);
  });

  it("accepts the maximum value", () => {
    expect(estimatedHoursForRequest("10000")).toBe(10000);
  });
});

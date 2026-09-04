import { describe, expect, it } from "vitest";
import {
  estimateMinutesToHoursInput,
  formatEstimateMinutes,
  parseEstimateHours,
  sumEstimateMinutes,
} from "./estimate";

describe("formatEstimateMinutes", () => {
  it("formats valid minute counts according to the section 2.2 table", () => {
    expect(formatEstimateMinutes(1)).toBe("0.02h");
    expect(formatEstimateMinutes(30)).toBe("0.5h");
    expect(formatEstimateMinutes(90)).toBe("1.5h");
    expect(formatEstimateMinutes(100)).toBe("1.67h");
    expect(formatEstimateMinutes(120)).toBe("2h");
    expect(formatEstimateMinutes(300)).toBe("5h");
    expect(formatEstimateMinutes(4825)).toBe("80.42h");
    expect(formatEstimateMinutes(6000)).toBe("100h");
    expect(formatEstimateMinutes(2147483647)).toBe("35791394.12h");
  });

  it("returns null for non-positive, non-integer, out-of-range, or non-number values", () => {
    expect(formatEstimateMinutes(0)).toBeNull();
    expect(formatEstimateMinutes(-5)).toBeNull();
    expect(formatEstimateMinutes(1.5)).toBeNull();
    expect(formatEstimateMinutes(null)).toBeNull();
    expect(formatEstimateMinutes(undefined)).toBeNull();
    expect(formatEstimateMinutes(Number.NaN)).toBeNull();
  });
});

describe("parseEstimateHours", () => {
  it("parses valid decimal hours into storable integer minutes", () => {
    expect(parseEstimateHours("1.5")).toBe(90);
    expect(parseEstimateHours("2")).toBe(120);
    expect(parseEstimateHours("0.25")).toBe(15);
    expect(parseEstimateHours("  1.5  ")).toBe(90);
    expect(parseEstimateHours("0.02")).toBe(1);
  });

  it("returns null for empty, malformed, negative, zero, or out-of-range inputs", () => {
    expect(parseEstimateHours("")).toBeNull();
    expect(parseEstimateHours("   ")).toBeNull();
    expect(parseEstimateHours("abc")).toBeNull();
    expect(parseEstimateHours("-1")).toBeNull();
    expect(parseEstimateHours("0")).toBeNull();
    expect(parseEstimateHours("0.001")).toBeNull();
    expect(parseEstimateHours("1,5")).toBeNull();
    expect(parseEstimateHours("1e3")).toBeNull();
    expect(parseEstimateHours("1.2.3")).toBeNull();
    expect(parseEstimateHours("35791394.13")).toBeNull();
  });
});

describe("estimateMinutesToHoursInput", () => {
  it("formats storable minutes into input hours without h suffix", () => {
    expect(estimateMinutesToHoursInput(90)).toBe("1.5");
    expect(estimateMinutesToHoursInput(120)).toBe("2");
    expect(estimateMinutesToHoursInput(100)).toBe("1.67");
    expect(estimateMinutesToHoursInput(null)).toBe("");
    expect(estimateMinutesToHoursInput(0)).toBe("");
  });
});

describe("round-trip property", () => {
  it("preserves exact minute values through estimateMinutesToHoursInput and parseEstimateHours", () => {
    const testMinutes = [1, 30, 90, 100, 120, 4825, 6000, 2147483647];
    for (const m of testMinutes) {
      expect(parseEstimateHours(estimateMinutesToHoursInput(m))).toBe(m);
    }
  });
});

describe("sumEstimateMinutes", () => {
  it("sums raw integer minutes over lists with mixed nulls", () => {
    const tasks = [
      { estimatedMinutes: 100 },
      { estimatedMinutes: null },
      { estimatedMinutes: 100 },
      { estimatedMinutes: 100 },
    ];
    expect(sumEstimateMinutes(tasks)).toBe(300);
  });

  it("returns 0 for empty list and all-null lists", () => {
    expect(sumEstimateMinutes([])).toBe(0);
    expect(
      sumEstimateMinutes([
        { estimatedMinutes: null },
        { estimatedMinutes: null },
      ]),
    ).toBe(0);
  });

  it("guarantees integer total and never returns NaN", () => {
    const mixed = [{ estimatedMinutes: null }, { estimatedMinutes: 30 }];
    const sumMixed = sumEstimateMinutes(mixed);
    expect(sumMixed).toBe(30);
    expect(Number.isNaN(sumMixed)).toBe(false);

    const intCheck = sumEstimateMinutes([
      { estimatedMinutes: 10 },
      { estimatedMinutes: 20 },
    ]);
    expect(Number.isInteger(intCheck)).toBe(true);
  });

  it("satisfies the header-agrees-with-cards rollup invariant", () => {
    const tasks = [
      { estimatedMinutes: 100 },
      { estimatedMinutes: 100 },
      { estimatedMinutes: 100 },
    ];
    // Each card renders formatEstimateMinutes(100) = "1.67h"
    for (const task of tasks) {
      expect(formatEstimateMinutes(task.estimatedMinutes)).toBe("1.67h");
    }
    // Header formats the sum of minutes once: formatEstimateMinutes(300) = "5h"
    const totalMinutes = sumEstimateMinutes(tasks);
    const headerDisplay = formatEstimateMinutes(totalMinutes);
    expect(headerDisplay).toBe("5h");
    expect(headerDisplay).not.toBe("5.01h");
  });
});

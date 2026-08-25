import { describe, expect, it } from "vitest";
import { coerceEstimatedMinutes } from "../../../apps/api/src/task/estimated-minutes";

// Shaped like the export payload rather than the full task row: the coercion
// step is the only place an estimate can be silently dropped between export
// and import.
const exportedTasks = [
  { title: "Ship the API", status: "in-progress", estimatedMinutes: 150 },
  { title: "Write the docs", status: "to-do", estimatedMinutes: null },
  { title: "Review the PR", status: "done", estimatedMinutes: 90 },
];

const invalidValues = [0, -5, 90.5, "abc", 525601];

describe("coerceEstimatedMinutes", () => {
  it("never throws, whatever the imported value is", () => {
    const values = [
      150,
      1,
      525600,
      null,
      undefined,
      ...invalidValues,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      999999999,
      "150",
      true,
      {},
      [],
    ];

    for (const value of values) {
      expect(() => coerceEstimatedMinutes(value)).not.toThrow();
    }
  });

  it("coerces every invalid value to null with a warning", () => {
    for (const value of invalidValues) {
      const { estimatedMinutes, warning } = coerceEstimatedMinutes(value);

      expect(estimatedMinutes).toBeNull();
      expect(typeof warning).toBe("string");
      expect(warning).toBe(
        `Invalid estimatedMinutes ${JSON.stringify(value)} imported as no estimate`,
      );
    }
  });

  it("clears the estimate for null and undefined without warning", () => {
    expect(coerceEstimatedMinutes(null)).toEqual({ estimatedMinutes: null });
    expect(coerceEstimatedMinutes(undefined)).toEqual({
      estimatedMinutes: null,
    });
    expect(coerceEstimatedMinutes(null).warning).toBeUndefined();
    expect(coerceEstimatedMinutes(undefined).warning).toBeUndefined();
  });
});

describe("export to import round trip", () => {
  it("carries [150, null, 90] through unchanged and warning-free", () => {
    const results = [150, null, 90].map((value) =>
      coerceEstimatedMinutes(value),
    );

    expect(results.map((result) => result.estimatedMinutes)).toEqual([
      150,
      null,
      90,
    ]);
    expect(results.map((result) => result.warning)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("preserves the estimates on a full exported task payload", () => {
    const imported = exportedTasks.map((task) => {
      const { estimatedMinutes, warning } = coerceEstimatedMinutes(
        task.estimatedMinutes,
      );

      return { ...task, estimatedMinutes, warning };
    });

    expect(imported.map((task) => task.estimatedMinutes)).toEqual([
      150,
      null,
      90,
    ]);
    expect(imported.every((task) => task.warning === undefined)).toBe(true);
    expect(imported[0]).toEqual({
      title: "Ship the API",
      status: "in-progress",
      estimatedMinutes: 150,
      warning: undefined,
    });
  });
});

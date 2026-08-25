import { describe, expect, it } from "vitest";
import {
  formatEstimateHours,
  MAX_ESTIMATED_MINUTES,
  parseEstimateHours,
  sumEstimatedMinutes,
  toEstimateHoursInput,
} from "./estimate";

type Minutes = number | null | undefined;

type FormatCase = [label: string, minutes: Minutes, expected: string | null];

type InputCase = [label: string, minutes: Minutes, expected: string];

type ParseCase = [input: string, expected: number | null | "invalid"];

type EstimateTask = { estimatedMinutes?: number | null };

type SumCase = [label: string, tasks: EstimateTask[], expected: number | null];

const formatCases: FormatCase[] = [
  ["null", null, null],
  ["undefined", undefined, null],
  ["0", 0, null],
  ["-30", -30, null],
  ["NaN", Number.NaN, null],
  ["Infinity", Number.POSITIVE_INFINITY, null],
  ["20", 20, "0.33h"],
  ["90", 90, "1.5h"],
  ["120", 120, "2h"],
  ["150", 150, "2.5h"],
  ["525600", 525600, "8760h"],
  ["1", 1, "0.02h"],
];

const inputCases: InputCase[] = [
  ["null", null, ""],
  ["undefined", undefined, ""],
  ["0", 0, ""],
  ["150", 150, "2.5"],
  ["120", 120, "2"],
  ["20", 20, "0.33"],
  ["525600", 525600, "8760"],
  ["1", 1, "0.02"],
];

const parseCases: ParseCase[] = [
  ["", null],
  [" ", null],
  ["2", 120],
  ["2.5", 150],
  ["  2.5  ", 150],
  ["0.25", 15],
  ["0.1", 6],
  ["8760", 525600],
  ["0", "invalid"],
  ["-1", "invalid"],
  ["abc", "invalid"],
  ["2abc", "invalid"],
  ["1e9", "invalid"],
  ["Infinity", "invalid"],
  ["0.001", "invalid"],
  ["8760.5", "invalid"],
  // Numeric-literal forms Number() accepts. Unreachable from the decimal-mode
  // popover, pinned so the behaviour is deliberate rather than incidental.
  ["0x10", 960],
  ["1e2", 6000],
  ["+2", 120],
  // Comma decimal separators, used by 9 of the 17 shipped locales.
  ["2,5", 150],
  ["1,2,3", "invalid"],
];

const sumCases: SumCase[] = [
  ["empty lane", [], null],
  [
    "all-null lane",
    [{ estimatedMinutes: null }, { estimatedMinutes: null }],
    null,
  ],
  ["field-absent lane", [{}, {}], null],
  ["single estimate", [{ estimatedMinutes: 150 }], 150],
  [
    "mixed lane",
    [
      { estimatedMinutes: 150 },
      { estimatedMinutes: null },
      { estimatedMinutes: 90 },
    ],
    240,
  ],
  [
    "three 20-minute tasks",
    [
      { estimatedMinutes: 20 },
      { estimatedMinutes: 20 },
      { estimatedMinutes: 20 },
    ],
    60,
  ],
];

// Every integer here must survive display rounding to 2 decimal places.
const roundTripSample = [1, 4, 7, 13, 20, 53, 59, 90, 120, 150, 525600];

describe("MAX_ESTIMATED_MINUTES", () => {
  it("is pinned to the API bound of 8760h", () => {
    expect(MAX_ESTIMATED_MINUTES).toBe(525600);
  });
});

describe("formatEstimateHours", () => {
  it.each(formatCases)("formats %s as %j", (_label, minutes, expected) => {
    expect(formatEstimateHours(minutes)).toBe(expected);
  });
});

describe("toEstimateHoursInput", () => {
  it.each(inputCases)("renders %s as %j", (_label, minutes, expected) => {
    expect(toEstimateHoursInput(minutes)).toBe(expected);
  });
});

describe("parseEstimateHours", () => {
  it.each(parseCases)("parses %j as %j", (input, expected) => {
    expect(parseEstimateHours(input)).toBe(expected);
  });
});

describe("estimate round trip", () => {
  it.each(roundTripSample)("round-trips %i minutes", (minutes) => {
    expect(parseEstimateHours(toEstimateHoursInput(minutes))).toBe(minutes);
  });
});

describe("sumEstimatedMinutes", () => {
  it.each(sumCases)("sums the %s to %j", (_label, tasks, expected) => {
    expect(sumEstimatedMinutes(tasks)).toBe(expected);
  });

  it("formats the mixed lane total as 4h", () => {
    const total = sumEstimatedMinutes([
      { estimatedMinutes: 150 },
      { estimatedMinutes: null },
      { estimatedMinutes: 90 },
    ]);

    expect(formatEstimateHours(total)).toBe("4h");
  });

  // Summing minutes before formatting: three 0.33h tasks total 1h, not 0.99h.
  it("formats three 20-minute tasks as 1h, not 0.99h", () => {
    const total = sumEstimatedMinutes([
      { estimatedMinutes: 20 },
      { estimatedMinutes: 20 },
      { estimatedMinutes: 20 },
    ]);

    expect(formatEstimateHours(total)).toBe("1h");
  });
});

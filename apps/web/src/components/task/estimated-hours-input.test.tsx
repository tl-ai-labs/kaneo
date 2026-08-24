import { describe, expect, it } from "vitest";
import { parseEstimatedHours } from "./estimated-hours-input";

describe("parseEstimatedHours", () => {
  const cases: Array<[string, number | null | undefined]> = [
    ["", null],
    ["  ", null],
    ["0", 0],
    ["8", 8],
    ["1000", 1000],
    ["8.5", undefined],
    ["-1", undefined],
    ["1001", undefined],
    ["abc", undefined],
  ];

  it.each(cases)("parses %j -> %j", (input, expected) => {
    expect(parseEstimatedHours(input)).toBe(expected);
  });
});

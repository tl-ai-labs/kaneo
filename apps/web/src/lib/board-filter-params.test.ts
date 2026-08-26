import { describe, expect, it } from "vitest";
import {
  filtersToSearchParams,
  hasActiveFilterParams,
  searchParamsToFilters,
  validateBoardSearch,
} from "./board-filter-params";

describe("board-filter-params", () => {
  describe("round-trip", () => {
    it("preserves all five dimensions populated including comma-containing values", () => {
      const originalFilters = {
        status: ["todo", "in,progress", "done"],
        priority: ["high", "low"],
        assignee: ["u,1", "user-2"],
        dueDate: ["dueThisWeek"],
        labels: ["bug,fix", "feature"],
      };

      const searchParams = filtersToSearchParams(originalFilters);
      const restoredFilters = searchParamsToFilters(searchParams);

      expect(restoredFilters).toEqual(originalFilters);
      expect(restoredFilters.assignee).toEqual(["u,1", "user-2"]);
      expect(restoredFilters.status).toEqual(["todo", "in,progress", "done"]);
      expect(restoredFilters.priority).toEqual(["high", "low"]);
      expect(restoredFilters.dueDate).toEqual(["dueThisWeek"]);
      expect(restoredFilters.labels).toEqual(["bug,fix", "feature"]);
    });
  });

  describe("validateBoardSearch", () => {
    it("normalizes bare string input to a one-element array", () => {
      expect(validateBoardSearch({ status: "todo" })).toEqual({
        status: ["todo"],
      });
      expect(validateBoardSearch({ priority: "high" })).toEqual({
        priority: ["high"],
      });
    });

    it("handles repeated keys / JSON array inputs", () => {
      expect(validateBoardSearch({ status: ["todo", "review"] })).toEqual({
        status: ["todo", "review"],
      });
    });

    it("does not split comma-separated strings into multiple elements", () => {
      const result = validateBoardSearch({ status: "todo,review" });
      expect(result).toEqual({ status: ["todo,review"] });
      expect(result.status).toHaveLength(1);
    });

    it.each([
      [null],
      [undefined],
      [0],
      [42],
      [""],
      ["junk"],
      [true],
      [[]],
      [[1, 2]],
      [{ status: 123 }],
      [{ status: {} }],
      [{ status: [1, null, {}] }],
      [{ status: null }],
      [{ toString: null }],
    ])("never throws for hostile input: %j", (input) => {
      expect(() => validateBoardSearch(input as never)).not.toThrow();
    });

    it("does not throw on deeply nested objects", () => {
      const deeplyNested = {
        status: { a: { b: { c: { d: [1, 2, 3] } } } },
        nested: { level1: { level2: { level3: "value" } } },
      };
      expect(() => validateBoardSearch(deeplyNested as never)).not.toThrow();
    });

    it("caps array input at 50 elements", () => {
      const longArray = Array.from({ length: 120 }, (_, i) => `val-${i}`);
      const result = validateBoardSearch({ status: longArray });
      expect(result.status).toHaveLength(50);
      expect(result.status).toEqual(longArray.slice(0, 50));
    });
  });

  describe("hasActiveFilterParams", () => {
    it("returns false for empty, null, undefined, or blank filter params", () => {
      expect(hasActiveFilterParams(undefined)).toBe(false);
      expect(hasActiveFilterParams(null)).toBe(false);
      expect(hasActiveFilterParams({})).toBe(false);
      expect(hasActiveFilterParams({ status: [] })).toBe(false);
      expect(hasActiveFilterParams({ status: "" as never })).toBe(false);
      expect(hasActiveFilterParams({ status: [""] })).toBe(false);
      expect(hasActiveFilterParams({ status: ["   "] })).toBe(false);
    });

    it("returns true for active filter params", () => {
      expect(hasActiveFilterParams({ status: ["todo"] })).toBe(true);
      expect(hasActiveFilterParams({ labels: ["l1"] })).toBe(true);
    });

    it("returns false for normalized forms of empty string and whitespace params (?status= and ?status=%20)", () => {
      expect(hasActiveFilterParams(validateBoardSearch({ status: "" }))).toBe(
        false,
      );
      expect(hasActiveFilterParams(validateBoardSearch({ status: " " }))).toBe(
        false,
      );
    });
  });

  describe("clean url behavior", () => {
    it("sets every filter key to undefined (not []) for all-null BoardFilters", () => {
      const allNullFilters = {
        status: null,
        priority: null,
        assignee: null,
        dueDate: null,
        labels: null,
      };

      const params = filtersToSearchParams(allNullFilters);

      expect(params.status).toBeUndefined();
      expect(params.priority).toBeUndefined();
      expect(params.assignee).toBeUndefined();
      expect(params.dueDate).toBeUndefined();
      expect(params.labels).toBeUndefined();

      expect(params.status).not.toEqual([]);
      expect(params.priority).not.toEqual([]);
      expect(params.assignee).not.toEqual([]);
      expect(params.dueDate).not.toEqual([]);
      expect(params.labels).not.toEqual([]);
    });
  });
});

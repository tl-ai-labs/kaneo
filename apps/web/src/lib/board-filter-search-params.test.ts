import { describe, expect, it } from "vitest";
import type { BoardFilters } from "@/hooks/use-task-filters";
import {
  BOARD_FILTER_SEARCH_KEYS,
  decodeBoardFilters,
  decodeFilterValue,
  EMPTY_BOARD_FILTERS,
  encodeBoardFilters,
  encodeFilterValue,
  readRawFilterParam,
} from "./board-filter-search-params";

describe("board-filter-search-params", () => {
  describe("readRawFilterParam", () => {
    it("returns the raw, un-normalised string verbatim", () => {
      const search = { status: " a , b " };
      expect(readRawFilterParam(search, "status")).toBe(" a , b ");
    });

    it("returns undefined for non-string or absent keys", () => {
      expect(readRawFilterParam({}, "status")).toBeUndefined();
      expect(readRawFilterParam({ status: 123 }, "status")).toBeUndefined();
      expect(readRawFilterParam({ status: null }, "status")).toBeUndefined();
    });
  });

  describe("decodeFilterValue - tolerance rules", () => {
    it("rule 1: non-string input yields null", () => {
      expect(decodeFilterValue(undefined)).toBeNull();
      expect(decodeFilterValue(null)).toBeNull();
      expect(decodeFilterValue(42)).toBeNull();
      expect(decodeFilterValue(["a"])).toBeNull();
      expect(decodeFilterValue({})).toBeNull();
      expect(decodeFilterValue(true)).toBeNull();
    });

    it("rule 2: empty string yields null", () => {
      expect(decodeFilterValue("")).toBeNull();
    });

    it("rule 3: trims each segment", () => {
      expect(decodeFilterValue(" a , b ")).toEqual(["a", "b"]);
    });

    it("rule 4: drops empty segments", () => {
      expect(decodeFilterValue("a,,b")).toEqual(["a", "b"]);
      expect(decodeFilterValue(",,,")).toBeNull();
    });

    it("rule 5: drops duplicates, keeping first-occurrence order", () => {
      expect(decodeFilterValue("a,b,a")).toEqual(["a", "b"]);
    });

    it("rule 6: drops segments that are empty after trim", () => {
      expect(decodeFilterValue("a, ,b")).toEqual(["a", "b"]);
      expect(decodeFilterValue("   ")).toBeNull();
    });

    it("rule 7: returns null instead of an empty array", () => {
      expect(decodeFilterValue(" , , ")).toBeNull();
      expect(decodeFilterValue("")).toBeNull();
    });

    it("rule 8: never throws on absurdly long or hostile values", () => {
      const longString = "x".repeat(50000);
      expect(() => decodeFilterValue(longString)).not.toThrow();
      expect(decodeFilterValue(longString)).toEqual([longString]);
    });
  });

  describe("decodeFilterValue - comma invariant", () => {
    it("a value containing a comma splits into segments that match nothing rather than inventing a filter", () => {
      const raw = "uuid-with,comma";
      const result = decodeFilterValue(raw);

      expect(result).toEqual(["uuid-with", "comma"]);
      expect(result?.[0]).not.toBe(raw);
      expect(result?.[1]).not.toBe(raw);
      // Documented behaviour: in filterTasks, tasks are matched by checking if their
      // attribute (such as status/label UUID or priority slug) is included in the filter array.
      // Since neither split segment matches the original un-split value or any legal attribute,
      // the filter fails every task attribute check and matches nothing instead of inventing a filter.
    });
  });

  describe("encodeFilterValue", () => {
    it("encodes valid arrays to comma-joined strings", () => {
      expect(encodeFilterValue(["a"])).toBe("a");
      expect(encodeFilterValue(["a", "b"])).toBe("a,b");
    });

    it("returns undefined for empty, null, or undefined values", () => {
      expect(encodeFilterValue(null)).toBeUndefined();
      expect(encodeFilterValue(undefined)).toBeUndefined();
      expect(encodeFilterValue([])).toBeUndefined();
      expect(encodeFilterValue(["", "  "])).toBeUndefined();
    });

    it("deduplicates after trimming", () => {
      expect(encodeFilterValue(["a", "a", " a "])).toBe("a");
    });

    it("encodeFilterValue drops a value containing a comma rather than emitting an ambiguous parameter", () => {
      expect(encodeFilterValue(["ok", "bad,value"])).toBe("ok");
      expect(encodeFilterValue(["bad,value"])).toBeUndefined();
    });
  });

  describe("decodeBoardFilters", () => {
    it("decodes absent params to all-null with no injected keys", () => {
      expect(decodeBoardFilters({})).toEqual(EMPTY_BOARD_FILTERS);
      expect(decodeBoardFilters({ taskId: "t1" })).toEqual(EMPTY_BOARD_FILTERS);
    });

    it("ignores array form parameters deliberately", () => {
      expect(
        decodeBoardFilters({ status: ["a", "b"] as unknown as string }),
      ).toEqual(EMPTY_BOARD_FILTERS);
    });

    it("decodes all five filter keys", () => {
      const search = {
        status: "to-do,in-progress",
        priority: "high,urgent",
        assignee: "user-1,user-2",
        dueDate: "dueThisWeek,dueNextWeek",
        labels: "label-1,label-2",
      };

      expect(decodeBoardFilters(search)).toEqual({
        status: ["to-do", "in-progress"],
        priority: ["high", "urgent"],
        assignee: ["user-1", "user-2"],
        dueDate: ["dueThisWeek", "dueNextWeek"],
        labels: ["label-1", "label-2"],
      });
    });
  });

  describe("encodeBoardFilters", () => {
    it("encodes EMPTY_BOARD_FILTERS to an object with all five keys as undefined", () => {
      const encoded = encodeBoardFilters(EMPTY_BOARD_FILTERS);
      expect(encoded).toEqual({
        status: undefined,
        priority: undefined,
        assignee: undefined,
        dueDate: undefined,
        labels: undefined,
      });
      for (const key of BOARD_FILTER_SEARCH_KEYS) {
        expect(key in encoded).toBe(true);
        expect(encoded[key]).toBeUndefined();
      }
    });

    it("round-trips encode->decode for all five keys", () => {
      const filters: BoardFilters = {
        status: ["to-do", "in-progress"],
        priority: ["urgent", "low"],
        assignee: ["user-1", "user-2"],
        dueDate: ["dueThisWeek"],
        labels: ["label-a", "label-b"],
      };

      const encoded = encodeBoardFilters(filters);
      const decoded = decodeBoardFilters(encoded as Record<string, unknown>);
      expect(decoded).toEqual(filters);
    });
  });

  describe("hostile input resilience", () => {
    it("never throws when given arrays, plain objects, numbers, booleans, null, undefined, or 10000-char strings", () => {
      const hostileInputs = [
        [],
        ["a", "b"],
        {},
        { a: 1 },
        42,
        -1,
        0,
        true,
        false,
        null,
        undefined,
        "x".repeat(10000),
      ];

      for (const input of hostileInputs) {
        expect(() => decodeFilterValue(input)).not.toThrow();
        expect(() =>
          encodeFilterValue(input as unknown as string[]),
        ).not.toThrow();
        expect(() =>
          readRawFilterParam(
            { status: input } as unknown as Record<string, unknown>,
            "status",
          ),
        ).not.toThrow();
      }

      const hostileSearchObject = {
        status: ["a", "b"],
        priority: { nested: true },
        assignee: 999,
        dueDate: false,
        labels: "x".repeat(10000),
        extra: () => {},
      };

      expect(() =>
        decodeBoardFilters(
          hostileSearchObject as unknown as Record<string, unknown>,
        ),
      ).not.toThrow();
    });
  });
});

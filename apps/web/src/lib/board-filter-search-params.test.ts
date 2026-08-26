import { describe, expect, it } from "vitest";
import type { BoardFilters } from "@/hooks/use-task-filters";
import {
  BOARD_FILTER_SEARCH_KEYS,
  boardFilterSearchMatches,
  hasAnyBoardFilterParam,
  MAX_BOARD_FILTER_VALUE_LENGTH,
  MAX_BOARD_FILTER_VALUES,
  parseBoardFilterSearch,
  serializeBoardFilters,
  validateBoardSearch,
} from "./board-filter-search-params";

const allNull = (): BoardFilters => ({
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
});

describe("board-filter-search-params", () => {
  it("defines BOARD_FILTER_SEARCH_KEYS in expected order", () => {
    expect(BOARD_FILTER_SEARCH_KEYS).toEqual([
      "status",
      "priority",
      "assignee",
      "dueDate",
      "labels",
    ]);
  });

  it("parses search params provided in array form", () => {
    const parsed = parseBoardFilterSearch({
      status: ["todo", "done"],
      labels: ["l1"],
    });

    expect(parsed).toEqual({
      status: ["todo", "done"],
      priority: null,
      assignee: null,
      dueDate: null,
      labels: ["l1"],
    });
  });

  it("parses a single-value repeated param, which arrives as a bare string", () => {
    const parsed = parseBoardFilterSearch({ status: "todo" });

    expect(parsed).toEqual({
      ...allNull(),
      status: ["todo"],
    });
  });

  it("drops non-string array members", () => {
    const parsed = parseBoardFilterSearch({
      status: ["todo", 1, null, {}],
    });

    expect(parsed.status).toEqual(["todo"]);
  });

  it("collapses empty arrays and arrays without valid strings to null", () => {
    expect(parseBoardFilterSearch({ status: [] }).status).toBeNull();
    expect(parseBoardFilterSearch({ status: [1] }).status).toBeNull();
  });

  it("treats an empty param as no filter at all", () => {
    // An empty param must not count as "URL has filters", or it would suppress
    // the localStorage restore on mount.
    expect(hasAnyBoardFilterParam({ status: "" })).toBe(false);
    expect(parseBoardFilterSearch({ status: "" }).status).toBeNull();
  });

  it("identifies whether valid board filter params are present", () => {
    expect(hasAnyBoardFilterParam({})).toBe(false);
    expect(hasAnyBoardFilterParam({ taskId: "t1" })).toBe(false);
    expect(hasAnyBoardFilterParam({ status: "todo" })).toBe(true);
  });

  it("enforces value length and max value count caps", () => {
    const overlongValue = "a".repeat(MAX_BOARD_FILTER_VALUE_LENGTH + 1);
    expect(parseBoardFilterSearch({ status: overlongValue }).status).toBeNull();

    const manyValues = Array.from({ length: 200 }, (_, i) => `val-${i}`);
    const parsedMany = parseBoardFilterSearch({ status: manyValues });
    expect(parsedMany.status?.length).toBe(MAX_BOARD_FILTER_VALUES);
  });

  it("handles hostile input without throwing or polluting the prototype", () => {
    const hostileInputs = [
      { "status[]": "x" },
      { labels: {} },
      JSON.parse('{"__proto__":["x"]}'),
      null,
      undefined,
      "string",
      42,
    ];

    for (const input of hostileInputs) {
      expect(
        parseBoardFilterSearch(input as unknown as Record<string, unknown>),
      ).toEqual(allNull());
    }

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("serializes a cleared filter as a present key holding undefined", () => {
    const result = serializeBoardFilters({
      status: ["todo"],
      priority: null,
      assignee: null,
      dueDate: null,
      labels: null,
    });

    expect(result.status).toEqual(["todo"]);
    expect(Object.hasOwn(result, "priority")).toBe(true);
    expect(result.priority).toBeUndefined();
  });

  it("serializes all-null filters to five present keys, all undefined", () => {
    const result = serializeBoardFilters(allNull());

    for (const key of BOARD_FILTER_SEARCH_KEYS) {
      expect(Object.hasOwn(result, key)).toBe(true);
      expect(result[key]).toBeUndefined();
    }
  });

  it("preserves filter structure across a serialize and parse round trip", () => {
    const filter: BoardFilters = {
      status: ["todo", "done"],
      priority: ["high"],
      assignee: ["u1"],
      dueDate: ["dueThisWeek"],
      labels: ["l1", "l2"],
    };

    const serialized = serializeBoardFilters(filter) as Record<string, unknown>;
    expect(parseBoardFilterSearch(serialized)).toEqual(filter);
  });

  it("matches search params accurately against board filters", () => {
    expect(
      boardFilterSearchMatches(
        { status: "todo" },
        { ...allNull(), status: ["todo"] },
      ),
    ).toBe(true);

    expect(
      boardFilterSearchMatches(
        { status: "todo" },
        { ...allNull(), status: ["done"] },
      ),
    ).toBe(false);

    expect(boardFilterSearchMatches({}, allNull())).toBe(true);
  });
});

describe("validateBoardSearch (the board route's validateSearch)", () => {
  it("round trips all five filters plus taskId", () => {
    const filters: BoardFilters = {
      status: ["todo", "done"],
      priority: ["high"],
      assignee: ["u1"],
      dueDate: ["dueThisWeek"],
      labels: ["l1", "l2"],
    };

    const validated = validateBoardSearch({
      ...serializeBoardFilters(filters),
      taskId: "task-1",
    } as Record<string, unknown>);

    expect(validated.taskId).toBe("task-1");
    expect(
      parseBoardFilterSearch(validated as Record<string, unknown>),
    ).toEqual(filters);
  });

  it("narrows taskId to a string or undefined", () => {
    expect(validateBoardSearch({ taskId: "t1" }).taskId).toBe("t1");
    expect(validateBoardSearch({ taskId: 42 }).taskId).toBeUndefined();
    expect(validateBoardSearch({ taskId: ["t1"] }).taskId).toBeUndefined();
    expect(validateBoardSearch({}).taskId).toBeUndefined();
  });

  it("yields no filter params at all when nothing is active (AC-6)", () => {
    const validated = validateBoardSearch({ taskId: "t1" });

    for (const key of BOARD_FILTER_SEARCH_KEYS) {
      expect(validated[key]).toBeUndefined();
    }
  });

  it("degrades hostile input to defaults instead of throwing (AC-5)", () => {
    const hostile = [
      { status: "" },
      { "status[]": "x" },
      { labels: {} },
      JSON.parse('{"__proto__":["x"]}'),
      { priority: "p".repeat(10_000) },
      null,
      undefined,
      "string",
      42,
    ];

    for (const input of hostile) {
      const run = () =>
        validateBoardSearch(input as unknown as Record<string, unknown>);
      expect(run).not.toThrow();
      const validated = run();
      for (const key of BOARD_FILTER_SEARCH_KEYS) {
        expect(validated[key]).toBeUndefined();
      }
    }
  });
});

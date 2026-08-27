import { describe, expect, it } from "vitest";
import type { BoardFilters } from "@/hooks/use-task-filters";
import {
  applyBoardFiltersToSearch,
  areBoardFiltersEqual,
  MAX_FILTER_VALUE_LENGTH,
  MAX_FILTER_VALUES,
  parseBoardFilterSearch,
  readBoardSearchParams,
  searchCarriesBoardFilters,
  toBoardFilterSearchParams,
} from "./board-filter-search-params";

const DEFAULT_FILTERS: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
};

const HOSTILE_INPUTS: Array<{ label: string; value: unknown }> = [
  { label: "null", value: null },
  { label: "undefined", value: undefined },
  { label: "number", value: 42 },
  { label: "string", value: "string" },
  { label: "array", value: [] },
  { label: "empty object", value: {} },
  {
    label: "nested object status",
    value: { status: { nested: true } },
  },
  { label: "numeric status", value: { status: 42 } },
  {
    label: "proto payload",
    value: JSON.parse('{"__proto__":{"polluted":true}}'),
  },
];

describe("parseBoardFilterSearch / toBoardFilterSearchParams", () => {
  it("AC-1: round-trips every facet, including a 3-value facet", () => {
    const filters: BoardFilters = {
      status: ["todo", "in-progress", "done"],
      priority: ["high"],
      assignee: ["user-1"],
      dueDate: ["2026-08-26"],
      labels: ["bug"],
    };

    const params = toBoardFilterSearchParams(filters);
    const result = parseBoardFilterSearch(params);

    expect(result).toEqual(filters);
  });

  it("FR-5: a single string value matches a one-element array", () => {
    const fromString = parseBoardFilterSearch({ status: "todo" });
    const fromArray = parseBoardFilterSearch({ status: ["todo"] });

    expect(fromString).toEqual(fromArray);
  });

  it("FR-7: caps a facet with 60 values to MAX_FILTER_VALUES", () => {
    const values = Array.from({ length: 60 }, (_, i) => `v${i}`);
    const result = parseBoardFilterSearch({ status: values });

    expect(result.status).toHaveLength(MAX_FILTER_VALUES);
    expect(result.status).toEqual(values.slice(0, MAX_FILTER_VALUES));
  });

  it("FR-7: drops values longer than MAX_FILTER_VALUE_LENGTH", () => {
    const okValue = "a".repeat(MAX_FILTER_VALUE_LENGTH);
    const tooLong = "a".repeat(MAX_FILTER_VALUE_LENGTH + 1);
    const result = parseBoardFilterSearch({
      status: [okValue, tooLong],
    });

    expect(result.status).toEqual([okValue]);
  });

  it("FR-7: dedupes values preserving first-seen order", () => {
    const result = parseBoardFilterSearch({
      status: ["b", "a", "b", "c", "a"],
    });

    expect(result.status).toEqual(["b", "a", "c"]);
  });

  it("FR-6: drops empty-string values", () => {
    const result = parseBoardFilterSearch({
      status: ["", "todo", ""],
    });

    expect(result.status).toEqual(["todo"]);
  });

  it("FR-6: treats an all-empty-string facet as absent", () => {
    const result = parseBoardFilterSearch({ status: ["", ""] });

    expect(result.status).toBeNull();
  });

  it.each(HOSTILE_INPUTS)(
    "AC-6: parseBoardFilterSearch does not throw for $label",
    ({ value }) => {
      expect(() => parseBoardFilterSearch(value)).not.toThrow();
      expect(parseBoardFilterSearch(value)).toEqual(DEFAULT_FILTERS);
    },
  );

  it.each(HOSTILE_INPUTS)(
    "AC-6: readBoardSearchParams does not throw for $label",
    ({ value }) => {
      expect(() => readBoardSearchParams(value)).not.toThrow();
    },
  );

  it("AC-6: a __proto__ payload does not pollute Object.prototype", () => {
    const input = JSON.parse('{"__proto__":{"polluted":true}}');
    const result = parseBoardFilterSearch(input);

    expect(Object.prototype).not.toHaveProperty("polluted");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(result)).toEqual([
      "status",
      "priority",
      "assignee",
      "dueDate",
      "labels",
    ]);
  });

  it("AC-7: returns zero keys for all-null filters", () => {
    const params = toBoardFilterSearchParams(DEFAULT_FILTERS);

    expect(Object.keys(params).length).toBe(0);
  });
});

describe("searchCarriesBoardFilters", () => {
  it("AC-4: is false for an empty-string status", () => {
    expect(searchCarriesBoardFilters({ status: "" })).toBe(false);
  });

  it("AC-4: is false for all-empty-string status values", () => {
    expect(searchCarriesBoardFilters({ status: ["", ""] })).toBe(false);
  });

  it("AC-4: is true for a non-empty status", () => {
    expect(searchCarriesBoardFilters({ status: "todo" })).toBe(true);
  });
});

describe("applyBoardFiltersToSearch", () => {
  it("AC-7: removes inactive facet keys and keeps unrelated keys", () => {
    const prev = {
      taskId: "task-1",
      status: ["todo"],
      priority: ["high"],
      view: "board",
    };
    const filters: BoardFilters = {
      ...DEFAULT_FILTERS,
      status: ["in-progress"],
    };

    const next = applyBoardFiltersToSearch(prev, filters);

    expect(next).toEqual({
      taskId: "task-1",
      view: "board",
      status: ["in-progress"],
    });
    expect(next).not.toHaveProperty("priority");
  });
});

describe("areBoardFiltersEqual", () => {
  it("distinguishes null from an empty array", () => {
    const withNull: BoardFilters = { ...DEFAULT_FILTERS };
    const withEmpty: BoardFilters = { ...DEFAULT_FILTERS, status: [] };

    expect(areBoardFiltersEqual(withNull, withEmpty)).toBe(false);
  });

  it("returns false for reordered values", () => {
    const a: BoardFilters = { ...DEFAULT_FILTERS, status: ["a", "b"] };
    const b: BoardFilters = { ...DEFAULT_FILTERS, status: ["b", "a"] };

    expect(areBoardFiltersEqual(a, b)).toBe(false);
  });

  it("returns true for identical filters", () => {
    const a: BoardFilters = { ...DEFAULT_FILTERS, status: ["a", "b"] };
    const b: BoardFilters = { ...DEFAULT_FILTERS, status: ["a", "b"] };

    expect(areBoardFiltersEqual(a, b)).toBe(true);
  });
});

describe("readBoardSearchParams", () => {
  it("preserves a string taskId", () => {
    const result = readBoardSearchParams({ taskId: "task-42" });

    expect(result.taskId).toBe("task-42");
  });

  it("drops a non-string taskId", () => {
    const result = readBoardSearchParams({ taskId: 42 });

    expect(result.taskId).toBeUndefined();
  });

  it("includes active facet keys", () => {
    const result = readBoardSearchParams({
      taskId: "task-1",
      status: ["todo"],
    });

    expect(result.status).toEqual(["todo"]);
  });
});

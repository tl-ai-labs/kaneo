import { describe, expect, it } from "vitest";
import {
  applyFilterSearch,
  type BoardSearchParams,
  buildStorageSeedSearch,
  clearTaskId,
  MAX_FILTER_VALUE_LENGTH,
  MAX_FILTER_VALUES,
  parseFilterList,
  serializeFilterList,
  validateBoardSearch,
} from "./board-search-params";

describe("parseFilterList", () => {
  it.each([
    ["dot-joined string", "u1.u2", ["u1", "u2"]],
    ["comma-joined string (legacy)", "u1,u2", ["u1", "u2"]],
    ["mixed separators", "u1.u2,u3", ["u1", "u2", "u3"]],
    ["bare string", "u1", ["u1"]],
    ["number", 123, ["123"]],
    ["array of strings", ["u1", "u2"], ["u1", "u2"]],
    ["array with a joined entry", ["u1.u2", "u3"], ["u1", "u2", "u3"]],
    ["surrounding whitespace", "u1. u2 .u3", ["u1", "u2", "u3"]],
    ["duplicates", "u1.u1.u1", ["u1"]],
  ])("reads %s", (_label, input, expected) => {
    expect(parseFilterList(input)).toEqual(expected);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
    ["only separators", ".."],
    ["only legacy separators", ",,"],
    ["only whitespace", "  .  "],
    ["boolean", true],
    ["object", { a: 1 }],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["empty array", []],
    ["array of non-values", [null, true, {}]],
  ])("yields null for %s", (_label, input) => {
    expect(parseFilterList(input)).toBeNull();
  });

  it("never throws for any of the malformed shapes", () => {
    const inputs: unknown[] = [
      undefined,
      null,
      "",
      ",,",
      true,
      { a: 1 },
      [null],
      Symbol.iterator.toString(),
      -0,
    ];
    for (const input of inputs) {
      expect(() => parseFilterList(input)).not.toThrow();
    }
  });

  it("drops an oversized raw value without splitting it", () => {
    const huge = "a,".repeat(200_000);
    expect(parseFilterList(huge)).toBeNull();
  });

  it("drops individual values longer than the per-value cap but keeps their neighbours", () => {
    const long = "x".repeat(MAX_FILTER_VALUE_LENGTH + 1);
    expect(parseFilterList(`u1.${long}.u2`)).toEqual(["u1", "u2"]);
  });

  it("keeps a value exactly at the per-value cap", () => {
    const atCap = "x".repeat(MAX_FILTER_VALUE_LENGTH);
    expect(parseFilterList(atCap)).toEqual([atCap]);
  });

  it("caps the number of values", () => {
    const many = Array.from({ length: 60 }, (_, i) => `u${i}`).join(".");
    expect(parseFilterList(many)).toHaveLength(MAX_FILTER_VALUES);
  });
});

describe("serializeFilterList", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty array", []],
    ["array of empty strings", ["", ""]],
  ])("yields undefined for %s, never an empty string", (_label, input) => {
    expect(serializeFilterList(input as string[] | null)).toBeUndefined();
  });

  it("is order-independent", () => {
    expect(serializeFilterList(["u2", "u1"])).toBe("u1.u2");
    expect(serializeFilterList(["u1", "u2"])).toBe("u1.u2");
  });

  it("dedupes", () => {
    expect(serializeFilterList(["u1", "u1", "u2"])).toBe("u1.u2");
  });

  it("round-trips exactly, so toggling a value on and off restores the original string", () => {
    const original = serializeFilterList(["u1", "u2"]);
    const withExtra = serializeFilterList(["u1", "u2", "u3"]);
    const parsed = parseFilterList(withExtra);
    expect(parsed).not.toBeNull();
    const removed = serializeFilterList(
      (parsed as string[]).filter((id) => id !== "u3"),
    );
    expect(removed).toBe(original);
    expect(removed).toBe("u1.u2");
  });

  it("clearing the last value produces an absent param, not an empty one", () => {
    expect(serializeFilterList([])).toBeUndefined();
    expect(serializeFilterList(null)).toBeUndefined();
  });
});

describe("validateBoardSearch", () => {
  it.each<[string, Record<string, unknown>, BoardSearchParams]>([
    [
      "?assignee= (empty)",
      { assignee: "" },
      { taskId: undefined, assignee: undefined, labels: undefined },
    ],
    [
      "?assignee=..",
      { assignee: ".." },
      { taskId: undefined, assignee: undefined, labels: undefined },
    ],
    [
      "?assignee[]=x (unknown key)",
      { "assignee[]": "x" },
      { taskId: undefined, assignee: undefined, labels: undefined },
    ],
    [
      "?assignee=true",
      { assignee: true },
      { taskId: undefined, assignee: undefined, labels: undefined },
    ],
    [
      "?assignee=null",
      { assignee: null },
      { taskId: undefined, assignee: undefined, labels: undefined },
    ],
    [
      "?assignee={a:1}",
      { assignee: { a: 1 } },
      { taskId: undefined, assignee: undefined, labels: undefined },
    ],
    [
      "?assignee=123 (numeric)",
      { assignee: 123 },
      { taskId: undefined, assignee: "123", labels: undefined },
    ],
    [
      "JSON-array link",
      { assignee: ["u1", "u2"] },
      { taskId: undefined, assignee: "u1.u2", labels: undefined },
    ],
    [
      "duplicate ids",
      { assignee: "u1.u1.u1" },
      { taskId: undefined, assignee: "u1", labels: undefined },
    ],
    [
      "unknown but structurally valid id survives",
      { assignee: "ghost-user" },
      { taskId: undefined, assignee: "ghost-user", labels: undefined },
    ],
    [
      "both params together, canonicalized",
      { assignee: "u2.u1", labels: "l9.l7" },
      { taskId: undefined, assignee: "u1.u2", labels: "l7.l9" },
    ],
    [
      "taskId alongside filters",
      { taskId: "t1", assignee: "u1" },
      { taskId: "t1", assignee: "u1", labels: undefined },
    ],
  ])("validates %s without throwing", (_label, search, expected) => {
    let result: BoardSearchParams | undefined;
    expect(() => {
      result = validateBoardSearch(search);
    }).not.toThrow();
    expect(result).toEqual(expected);
  });

  it("canonicalizes a legacy comma-joined link to the dot form", () => {
    expect(validateBoardSearch({ assignee: "u2,u1" }).assignee).toBe("u1.u2");
    expect(validateBoardSearch({ assignee: "u1,u2.u3" }).assignee).toBe(
      "u1.u2.u3",
    );
  });

  it("drops unknown keys entirely by returning a fresh object", () => {
    const result = validateBoardSearch({
      "assignee[]": "x",
      somethingElse: "y",
    });
    expect(Object.keys(result).sort()).toEqual([
      "assignee",
      "labels",
      "taskId",
    ]);
  });

  it("keeps taskId's existing predicate unchanged", () => {
    expect(validateBoardSearch({ taskId: "t1" }).taskId).toBe("t1");
    expect(validateBoardSearch({ taskId: 42 }).taskId).toBeUndefined();
    expect(validateBoardSearch({ taskId: "" }).taskId).toBe("");
  });

  it("degrades a 200 KB param to undefined and still returns", () => {
    const huge = "a,".repeat(100_000);
    expect(validateBoardSearch({ assignee: huge }).assignee).toBeUndefined();
  });

  it("caps a 60-id param at the maximum, sorted", () => {
    const many = Array.from(
      { length: 60 },
      (_, i) => `u${String(i).padStart(2, "0")}`,
    ).join(".");
    const assignee = validateBoardSearch({ assignee: many }).assignee;
    const values = (assignee as string).split(".");
    expect(values).toHaveLength(MAX_FILTER_VALUES);
    expect(values).toEqual([...values].sort());
  });
});

describe("applyFilterSearch", () => {
  it("preserves taskId while replacing the filters", () => {
    expect(
      applyFilterSearch(
        { taskId: "t1", assignee: "u9" },
        { assignee: ["u1"], labels: null },
      ),
    ).toEqual({ taskId: "t1", assignee: "u1", labels: undefined });
  });

  it("writes canonical sorted values", () => {
    expect(
      applyFilterSearch({}, { assignee: ["u2", "u1"], labels: ["l2", "l1"] }),
    ).toEqual({ taskId: undefined, assignee: "u1.u2", labels: "l1.l2" });
  });

  it("removes a param entirely when its subject is cleared", () => {
    expect(
      applyFilterSearch(
        { assignee: "u1.u2", labels: "l1" },
        { assignee: null, labels: null },
      ),
    ).toEqual({ assignee: undefined, labels: undefined });
  });
});

describe("clearTaskId", () => {
  it("drops only taskId and preserves the filter params", () => {
    expect(
      clearTaskId({ taskId: "t1", assignee: "u1.u2", labels: "l1" }),
    ).toEqual({ taskId: undefined, assignee: "u1.u2", labels: "l1" });
  });

  it("is a no-op for a search that carries no taskId", () => {
    expect(clearTaskId({ assignee: "u1" })).toEqual({
      taskId: undefined,
      assignee: "u1",
    });
  });
});

describe("buildStorageSeedSearch", () => {
  const stored = { assignee: ["u2", "u1"], labels: ["l1"] };

  it("seeds a bare URL from stored filters, canonicalized", () => {
    expect(buildStorageSeedSearch({}, stored)).toEqual({
      assignee: "u1.u2",
      labels: "l1",
    });
  });

  it("preserves taskId while seeding", () => {
    expect(buildStorageSeedSearch({ taskId: "t1" }, stored)).toEqual({
      taskId: "t1",
      assignee: "u1.u2",
      labels: "l1",
    });
  });

  it.each([
    ["assignee only", { assignee: "u9" }],
    ["labels only", { labels: "l9" }],
    ["both", { assignee: "u9", labels: "l9" }],
  ])(
    "refuses to seed when the URL already carries %s",
    (_label, current: BoardSearchParams) => {
      expect(buildStorageSeedSearch(current, stored)).toBeNull();
    },
  );

  it("does nothing when storage holds no filters, so cleared stays cleared", () => {
    expect(
      buildStorageSeedSearch({}, { assignee: null, labels: null }),
    ).toBeNull();
  });
});

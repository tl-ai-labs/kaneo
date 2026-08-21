import * as v from "valibot";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insertedRows: [] as Record<string, unknown>[],
  setPayloads: [] as Record<string, unknown>[],
  findFirstResult: {
    id: "column-1",
    name: "Old Name",
    wipLimit: null,
  } as Record<string, unknown> | undefined,
}));

// The controllers are exercised directly against a stubbed drizzle client. The
// chain mirrors the real calls exactly: select -> from -> where resolves to an
// array (there is no .limit()), and update -> set -> where -> returning records
// the patch object so the conditional-set spread can be asserted.
vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        returning: () => {
          const created = { id: "generated-id", ...row };
          mocks.insertedRows.push(created);
          return Promise.resolve([created]);
        },
      }),
    }),
    update: () => ({
      set: (payload: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            mocks.setPayloads.push(payload);
            return Promise.resolve([{ ...mocks.findFirstResult, ...payload }]);
          },
        }),
      }),
    }),
    query: {
      columnTable: {
        findFirst: () => Promise.resolve(mocks.findFirstResult),
      },
    },
  },
}));

import createColumn, {
  wipLimitSchema,
} from "../../../apps/api/src/column/controllers/create-column";
import updateColumn from "../../../apps/api/src/column/controllers/update-column";

beforeEach(() => {
  mocks.insertedRows.length = 0;
  mocks.setPayloads.length = 0;
  mocks.findFirstResult = {
    id: "column-1",
    name: "Old Name",
    wipLimit: null,
  };
});

describe("wipLimitSchema", () => {
  it.each([1, 2147483647])("accepts %p", (value) => {
    expect(v.safeParse(wipLimitSchema, value).success).toBe(true);
  });

  // 1.5 is why v.integer() is required (v.number() alone accepts floats);
  // 2147483648 is why v.maxValue is required (PostgreSQL would otherwise raise
  // "integer out of range" and the caller would see a 500 instead of a 400).
  it.each([0, -1, 1.5, 2147483648, "5", null, undefined])(
    "rejects %p",
    (value) => {
      expect(v.safeParse(wipLimitSchema, value).success).toBe(false);
    },
  );
});

describe("route wrapper v.optional(v.nullable(wipLimitSchema))", () => {
  const routeSchema = v.object({
    wipLimit: v.optional(v.nullable(wipLimitSchema)),
  });

  it("accepts an omitted wipLimit", () => {
    expect(v.safeParse(routeSchema, {}).success).toBe(true);
  });

  it("accepts an explicit null wipLimit", () => {
    expect(v.safeParse(routeSchema, { wipLimit: null }).success).toBe(true);
  });

  it("accepts a valid wipLimit", () => {
    expect(v.safeParse(routeSchema, { wipLimit: 1 }).success).toBe(true);
  });

  it("rejects a wipLimit of 0 through the wrapper", () => {
    expect(v.safeParse(routeSchema, { wipLimit: 0 }).success).toBe(false);
  });
});

describe("createColumn wipLimit persistence", () => {
  it("inserts null when wipLimit is omitted", async () => {
    await createColumn({ projectId: "project-1", name: "Todo" });

    expect(mocks.insertedRows.at(-1)?.wipLimit).toBeNull();
  });

  it("inserts null when wipLimit is explicitly null", async () => {
    await createColumn({
      projectId: "project-1",
      name: "In Progress",
      wipLimit: null,
    });

    expect(mocks.insertedRows.at(-1)?.wipLimit).toBeNull();
  });

  it("inserts the supplied wipLimit", async () => {
    await createColumn({
      projectId: "project-1",
      name: "In Review",
      wipLimit: 5,
    });

    expect(mocks.insertedRows.at(-1)?.wipLimit).toBe(5);
  });

  // Regression guard for `wipLimit ?? null` vs `wipLimit || null`. The HTTP
  // validator rejects 0 (minValue is 1), so no route-level test can reach this
  // branch — calling the controller directly is the only way to tell the two
  // operators apart, because `0 ?? null` is 0 while `0 || null` is null.
  it("inserts a literal 0 rather than coercing it to null", async () => {
    await createColumn({
      projectId: "project-1",
      name: "Blocked",
      wipLimit: 0,
    });

    expect(mocks.insertedRows.at(-1)?.wipLimit).toBe(0);
  });
});

describe("updateColumn wipLimit persistence", () => {
  it("omits wipLimit from the patch when it is absent", async () => {
    await updateColumn("column-1", { name: "Renamed" });

    expect(mocks.setPayloads.at(-1)).not.toHaveProperty("wipLimit");
  });

  it("clears the limit when wipLimit is explicitly null", async () => {
    await updateColumn("column-1", { wipLimit: null });

    const payload = mocks.setPayloads.at(-1);
    expect(payload).toHaveProperty("wipLimit");
    expect(payload?.wipLimit).toBeNull();
  });

  it("sets the supplied wipLimit", async () => {
    await updateColumn("column-1", { wipLimit: 7 });

    expect(mocks.setPayloads.at(-1)?.wipLimit).toBe(7);
  });
});

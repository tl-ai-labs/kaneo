import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: { columnTable: { findFirst: mocks.findFirst } },
    // Both selects in createColumn (duplicate-slug probe, MAX(position) probe) resolve to []
    // which yields no duplicate and position 0.
    select: () => ({ from: () => ({ where: async () => [] }) }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mocks.insertValues(values);
        return { returning: async () => [{ id: "col-1", ...values }] };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        mocks.updateSet(values);
        return {
          where: () => ({
            returning: async () => [{ id: "col-1", ...values }],
          }),
        };
      },
    }),
  },
}));

import createColumn from "../../../apps/api/src/column/controllers/create-column";
import updateColumn from "../../../apps/api/src/column/controllers/update-column";
import { columnTable } from "../../../apps/api/src/database/schema";

describe("createColumn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      id: "col-1",
      name: "Doing",
      wipLimit: 4,
    });
  });

  it("persists wipLimit when specified", async () => {
    await createColumn({ projectId: "p1", name: "Doing", wipLimit: 3 });
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: 3 }),
    );
  });

  it("defaults wipLimit to null when omitted", async () => {
    await createColumn({ projectId: "p1", name: "Doing" });
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: null }),
    );
  });

  it("persists wipLimit as null when explicitly passed null", async () => {
    await createColumn({ projectId: "p1", name: "Doing", wipLimit: null });
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: null }),
    );
  });

  it("persists standard fields properly", async () => {
    await createColumn({ projectId: "p1", name: "Doing" });
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "doing",
        position: 0,
        isFinal: false,
      }),
    );
  });
});

describe("updateColumn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      id: "col-1",
      name: "Doing",
      wipLimit: 4,
    });
  });

  it("updates wipLimit when provided a number", async () => {
    await updateColumn("col-1", { wipLimit: 5 });
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: 5 }),
    );
  });

  it("clears wipLimit when explicitly set to null", async () => {
    await updateColumn("col-1", { wipLimit: null });
    const values = mocks.updateSet.mock.calls[0][0];
    expect("wipLimit" in values).toBe(true);
    expect(values.wipLimit).toBeNull();
  });

  it("does not include wipLimit when only name is updated", async () => {
    await updateColumn("col-1", { name: "Doing" });
    const values = mocks.updateSet.mock.calls[0][0];
    expect("wipLimit" in values).toBe(false);
  });

  it("does not include wipLimit when empty object is passed", async () => {
    await updateColumn("col-1", {});
    const values = mocks.updateSet.mock.calls[0][0];
    expect("wipLimit" in values).toBe(false);
  });
});

describe("columnTable.wipLimit", () => {
  // getColumns does db.select() with no projection, so every column present on the
  // table object is returned. These three assertions are therefore the proof that
  // GET /column/:projectId returns wipLimit — do NOT turn this into a DB test.
  it("maps to database column wip_limit", () => {
    expect(columnTable.wipLimit.name).toBe("wip_limit");
  });

  it("is nullable", () => {
    expect(columnTable.wipLimit.notNull).toBe(false);
  });

  it("has no default value", () => {
    expect(columnTable.wipLimit.hasDefault).toBe(false);
  });
});

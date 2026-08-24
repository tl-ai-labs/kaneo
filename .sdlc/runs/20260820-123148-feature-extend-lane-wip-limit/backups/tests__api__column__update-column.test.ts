import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      columnTable: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

import updateColumn from "../../../apps/api/src/column/controllers/update-column";

function makeUpdateMock(updatedRow: unknown) {
  const returning = vi.fn(() => Promise.resolve([updatedRow]));
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  return { set, where, returning };
}

describe("updateColumn", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("updates wipLimit when given a numeric value", async () => {
    mockFindFirst.mockResolvedValue({ id: "col-1", name: "Todo" });
    const { set } = makeUpdateMock({ id: "col-1", wipLimit: 5 });
    mockUpdate.mockReturnValue({ set });

    await updateColumn("col-1", { wipLimit: 5 });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: 5 }),
    );
  });

  it("updates wipLimit when explicitly set to null", async () => {
    mockFindFirst.mockResolvedValue({ id: "col-1", name: "Todo" });
    const { set } = makeUpdateMock({ id: "col-1", wipLimit: null });
    mockUpdate.mockReturnValue({ set });

    await updateColumn("col-1", { wipLimit: null });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: null }),
    );
  });

  it("does not include wipLimit when field is omitted", async () => {
    mockFindFirst.mockResolvedValue({ id: "col-1", name: "Todo" });
    const { set } = makeUpdateMock({ id: "col-1", name: "Renamed" });
    mockUpdate.mockReturnValue({ set });

    await updateColumn("col-1", { name: "Renamed" });

    const setArg = set.mock.calls[0][0];
    expect(setArg).not.toHaveProperty("wipLimit");
    expect(setArg).toEqual({ name: "Renamed" });
  });
});

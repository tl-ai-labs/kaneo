import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

import createColumn from "../../../apps/api/src/column/controllers/create-column";

function makeSelectMock(rows: unknown[]) {
  const chain: Record<string, Mock> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

function makeInsertMock(createdRow: unknown = { id: "col-1" }) {
  const returning = vi.fn(() => Promise.resolve([createdRow]));
  const values = vi.fn(() => ({ returning }));
  return { values, returning };
}

describe("createColumn", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("persists wipLimit when provided", async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectMock([]))
      .mockReturnValueOnce(makeSelectMock([{ maxPosition: -1 }]));
    const insertMock = makeInsertMock({ id: "col-1", wipLimit: 3 });
    mockInsert.mockReturnValue(insertMock);

    await createColumn({ projectId: "p1", name: "In Progress", wipLimit: 3 });

    expect(insertMock.values).toHaveBeenCalledWith(
      expect.objectContaining({
        wipLimit: 3,
      }),
    );
  });

  it("defaults wipLimit to null when omitted", async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectMock([]))
      .mockReturnValueOnce(makeSelectMock([{ maxPosition: -1 }]));
    const insertMock = makeInsertMock({ id: "col-1", wipLimit: null });
    mockInsert.mockReturnValue(insertMock);

    await createColumn({ projectId: "p1", name: "In Progress" });

    expect(insertMock.values).toHaveBeenCalledWith(
      expect.objectContaining({
        wipLimit: null,
      }),
    );
  });
});

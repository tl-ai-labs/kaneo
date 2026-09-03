import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

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

function makeInsertMock(row: unknown) {
  const chain: Record<string, Mock> = {
    values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve([row])),
  };
  return chain;
}

describe("createColumn — wipLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes wipLimit to the insert values when provided", async () => {
    const insertChain = makeInsertMock({
      id: "col-1",
      projectId: "proj-1",
      name: "Doing",
      wipLimit: 5,
    });
    mockSelect
      .mockReturnValueOnce(makeSelectMock([]))
      .mockReturnValueOnce(makeSelectMock([{ maxPosition: -1 }]));
    mockInsert.mockReturnValue(insertChain);

    await createColumn({
      projectId: "proj-1",
      name: "Doing",
      wipLimit: 5,
    });

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: 5 }),
    );
  });

  it("sets wipLimit to null when omitted", async () => {
    const insertChain = makeInsertMock({
      id: "col-1",
      projectId: "proj-1",
      name: "Doing",
      wipLimit: null,
    });
    mockSelect
      .mockReturnValueOnce(makeSelectMock([]))
      .mockReturnValueOnce(makeSelectMock([{ maxPosition: -1 }]));
    mockInsert.mockReturnValue(insertChain);

    await createColumn({
      projectId: "proj-1",
      name: "Doing",
    });

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: null }),
    );
  });

  // The route-level Valibot validator rejects 0, so this value cannot arrive through
  // the HTTP path today — the test locks the controller's absent-vs-set semantics
  // so that relaxing minValue(1) later cannot silently reintroduce the bug.
  it("sets wipLimit to 0 when wipLimit is 0 (regression guard for || vs ??)", async () => {
    const insertChain = makeInsertMock({
      id: "col-1",
      projectId: "proj-1",
      name: "Doing",
      wipLimit: 0,
    });
    mockSelect
      .mockReturnValueOnce(makeSelectMock([]))
      .mockReturnValueOnce(makeSelectMock([{ maxPosition: -1 }]));
    mockInsert.mockReturnValue(insertChain);

    await createColumn({
      projectId: "proj-1",
      name: "Doing",
      wipLimit: 0,
    });

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: 0 }),
    );
    const [callArg] = insertChain.values.mock.calls[0];
    expect(callArg.wipLimit).toBe(0);
  });
});

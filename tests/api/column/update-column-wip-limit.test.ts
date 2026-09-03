import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

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

function makeUpdateMock(row: unknown) {
  const chain: Record<string, Mock> = {
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve([row])),
  };
  return chain;
}

describe("updateColumn — wipLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({
      id: "col-1",
      name: "Doing",
      wipLimit: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes wipLimit to .set() when provided", async () => {
    const updateChain = makeUpdateMock({
      id: "col-1",
      wipLimit: 5,
    });
    mockUpdate.mockReturnValue(updateChain);

    await updateColumn("col-1", {
      wipLimit: 5,
    });

    expect(updateChain.set).toHaveBeenCalledWith({
      wipLimit: 5,
    });
  });

  it("passes wipLimit: null to .set() when explicitly clearing wipLimit", async () => {
    const updateChain = makeUpdateMock({
      id: "col-1",
      wipLimit: null,
    });
    mockUpdate.mockReturnValue(updateChain);

    await updateColumn("col-1", {
      wipLimit: null,
    });

    expect(updateChain.set).toHaveBeenCalledWith({
      wipLimit: null,
    });
  });

  it("does not include wipLimit in .set() when omitted", async () => {
    const updateChain = makeUpdateMock({
      id: "col-1",
      name: "Doing",
    });
    mockUpdate.mockReturnValue(updateChain);

    await updateColumn("col-1", {
      name: "Doing",
    });

    expect(updateChain.set).toHaveBeenCalledTimes(1);
    const [setArg] = updateChain.set.mock.calls[0];
    expect("wipLimit" in setArg).toBe(false);
  });
});

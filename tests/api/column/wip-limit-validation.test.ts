import type { Context, Next } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateColumn = vi.fn();
const mockUpdateColumn = vi.fn();

vi.mock("../../../apps/api/src/utils/workspace-access-middleware", () => ({
  workspaceAccess: {
    fromProject: () => async (_c: Context, next: Next) => next(),
    fromColumn: () => async (_c: Context, next: Next) => next(),
  },
}));
vi.mock("../../../apps/api/src/utils/require-workspace-permission", () => ({
  requireWorkspacePermission: () => async (_c: Context, next: Next) => next(),
}));
vi.mock("../../../apps/api/src/column/controllers/create-column", () => ({
  default: (...args: unknown[]) => mockCreateColumn(...args),
}));
vi.mock("../../../apps/api/src/column/controllers/update-column", () => ({
  default: (...args: unknown[]) => mockUpdateColumn(...args),
}));

import column from "../../../apps/api/src/column";

describe("wipLimit validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateColumn.mockResolvedValue({ id: "col-1" });
    mockUpdateColumn.mockResolvedValue({ id: "col-1" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /proj-1 accepts valid wipLimit integer and calls createColumn with wipLimit 5", async () => {
    const res = await column.request("/proj-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Doing", wipLimit: 5 }),
    });

    expect(res.status).toBe(200);
    expect(mockCreateColumn).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: 5 }),
    );
  });

  it("POST /proj-1 accepts omitted wipLimit and calls createColumn with wipLimit undefined", async () => {
    const res = await column.request("/proj-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Doing" }),
    });

    expect(res.status).toBe(200);
    expect(mockCreateColumn).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: undefined }),
    );
  });

  it("POST /proj-1 rejects wipLimit 0 with 400", async () => {
    const res = await column.request("/proj-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Doing", wipLimit: 0 }),
    });

    expect(res.status).toBe(400);
    expect(mockCreateColumn).not.toHaveBeenCalled();
  });

  it("POST /proj-1 rejects wipLimit -1 with 400", async () => {
    const res = await column.request("/proj-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Doing", wipLimit: -1 }),
    });

    expect(res.status).toBe(400);
    expect(mockCreateColumn).not.toHaveBeenCalled();
  });

  it("POST /proj-1 rejects wipLimit 2.5 with 400", async () => {
    const res = await column.request("/proj-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Doing", wipLimit: 2.5 }),
    });

    expect(res.status).toBe(400);
    expect(mockCreateColumn).not.toHaveBeenCalled();
  });

  it("POST /proj-1 rejects wipLimit '5' with 400", async () => {
    const res = await column.request("/proj-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Doing", wipLimit: "5" }),
    });

    expect(res.status).toBe(400);
    expect(mockCreateColumn).not.toHaveBeenCalled();
  });

  it("PUT /col-1 accepts wipLimit null and calls updateColumn with { wipLimit: null }", async () => {
    const res = await column.request("/col-1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wipLimit: null }),
    });

    expect(res.status).toBe(200);
    expect(mockUpdateColumn).toHaveBeenCalledWith("col-1", {
      wipLimit: null,
    });
  });

  it("PUT /col-1 rejects wipLimit 0 with 400", async () => {
    const res = await column.request("/col-1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wipLimit: 0 }),
    });

    expect(res.status).toBe(400);
    expect(mockUpdateColumn).not.toHaveBeenCalled();
  });

  // Upper bound (maxValue 2147483647 / PostgreSQL int4 max) regression tests.
  // These assert 400 rather than the 500 that the unbounded validator previously produced via app.onError.
  it("POST /proj-1 rejects wipLimit 2147483648 with 400", async () => {
    const res = await column.request("/proj-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Doing", wipLimit: 2147483648 }),
    });

    expect(res.status).toBe(400);
    expect(mockCreateColumn).not.toHaveBeenCalled();
  });

  it("POST /proj-1 rejects wipLimit 1e308 with 400", async () => {
    const res = await column.request("/proj-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Doing", wipLimit: 1e308 }),
    });

    expect(res.status).toBe(400);
    expect(mockCreateColumn).not.toHaveBeenCalled();
  });

  it("POST /proj-1 accepts wipLimit 2147483647 with 200", async () => {
    const res = await column.request("/proj-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Doing", wipLimit: 2147483647 }),
    });

    expect(res.status).toBe(200);
    expect(mockCreateColumn).toHaveBeenCalledWith(
      expect.objectContaining({ wipLimit: 2147483647 }),
    );
  });

  it("PUT /col-1 rejects wipLimit 2147483648 with 400", async () => {
    const res = await column.request("/col-1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wipLimit: 2147483648 }),
    });

    expect(res.status).toBe(400);
    expect(mockUpdateColumn).not.toHaveBeenCalled();
  });
});

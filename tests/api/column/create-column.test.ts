import { describe, expect, it, vi } from "vitest";

vi.mock("../../../apps/api/src/database", async () => {
  const schema = await import("../../../apps/api/src/database/schema");
  // biome-ignore lint/suspicious/noExplicitAny: minimal chainable stub for a DB-free validator test
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    insert: () => chain,
    values: () => chain,
    returning: async () => [],
    update: () => chain,
    set: () => chain,
    delete: () => chain,
    query: {
      columnTable: {
        findFirst: async () => undefined,
      },
    },
  };
  return { default: chain, schema };
});

vi.mock("../../../apps/api/src/utils/workspace-access-middleware", () => ({
  workspaceAccess: {
    // biome-ignore lint/suspicious/noExplicitAny: pass-through middleware stub
    fromProject: () => async (_c: any, next: any) => next(),
    // biome-ignore lint/suspicious/noExplicitAny: pass-through middleware stub
    fromColumn: () => async (_c: any, next: any) => next(),
  },
}));

vi.mock("../../../apps/api/src/utils/require-workspace-permission", () => ({
  // biome-ignore lint/suspicious/noExplicitAny: pass-through middleware stub
  requireWorkspacePermission: () => async (_c: any, next: any) => next(),
}));

import column from "../../../apps/api/src/column/index";

const post = (body: unknown) =>
  column.request("/project-1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /:projectId wipLimit validator", () => {
  const rejects: Array<[string, number]> = [
    ["zero", 0],
    ["negative", -3],
    ["fractional", 2.5],
    ["one above int32 max", 2147483648],
    ["far above int32 max", 99999999999],
    ["above MAX_SAFE_INTEGER", 9007199254740992],
    ["Number.MAX_VALUE", Number.MAX_VALUE],
  ];

  for (const [label, value] of rejects) {
    it(`rejects wipLimit ${label} (${value}) with 400`, async () => {
      const res = await post({ name: "Todo", wipLimit: value });
      expect(res.status, `wipLimit=${value} should be rejected`).toBe(400);
    });
  }

  it("accepts explicit null wipLimit", async () => {
    const res = await post({ name: "Todo", wipLimit: null });
    expect(res.status).not.toBe(400);
  });

  it("accepts body with wipLimit key absent", async () => {
    const res = await post({ name: "Todo" });
    expect(res.status).not.toBe(400);
  });

  it("accepts wipLimit 1 (lower bound)", async () => {
    const res = await post({ name: "Todo", wipLimit: 1 });
    expect(res.status).not.toBe(400);
  });

  it("accepts wipLimit 5", async () => {
    const res = await post({ name: "Todo", wipLimit: 5 });
    expect(res.status).not.toBe(400);
  });

  it("accepts wipLimit 2147483647 (int32 max)", async () => {
    const res = await post({ name: "Todo", wipLimit: 2147483647 });
    expect(res.status).not.toBe(400);
  });
});

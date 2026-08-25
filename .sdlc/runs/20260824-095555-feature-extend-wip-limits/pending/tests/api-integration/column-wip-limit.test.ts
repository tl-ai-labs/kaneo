import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Replaces tests/api/column/wip-limit-authz.test.ts, which asserted only that
// `column.routes` held >= 6 handlers. A handler COUNT cannot detect a deleted
// guard, a reordered chain, or a permission spec downgraded from
// project:update to project:read — it stays green through all three. These
// tests exercise the real middleware chain against a real database instead.
//
// Role facts this file relies on (packages/permissions/src/index.ts):
//   member -> project: ["create", "read"]                  => NO update
//   admin  -> project: ["create","read","update",...]      => update granted

async function putWipLimit(
  app: ReturnType<typeof createApp>["app"],
  columnId: string,
  wipLimit: number | null,
) {
  return app.request(`/api/column/${columnId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wipLimit }),
  });
}

describe("API integration: column WIP limit authorization", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("PUT /api/column/:id", () => {
    it("blocks a member from setting a WIP limit and leaves wip_limit unchanged", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await putWipLimit(app, columns.todo.id, 3);
      expect(response.status).toBe(403);

      // The status alone does not prove the write did not happen.
      const persisted = await db.query.columnTable.findFirst({
        where: eq(schema.columnTable.id, columns.todo.id),
      });
      expect(persisted?.wipLimit).toBeNull();
    });

    it("allows an admin to set a WIP limit and persists it", async () => {
      const admin = await createWorkspaceMember({ role: "admin" });
      const { columns } = await createProjectFixture({
        workspaceId: admin.workspace.id,
      });

      mockAuthenticatedSession(admin.user);
      const { app } = createApp();

      const response = await putWipLimit(app, columns.todo.id, 3);
      expect(response.status).toBe(200);

      const persisted = await db.query.columnTable.findFirst({
        where: eq(schema.columnTable.id, columns.todo.id),
      });
      expect(persisted?.wipLimit).toBe(3);
    });

    it("allows an admin to clear a WIP limit with an explicit null", async () => {
      const admin = await createWorkspaceMember({ role: "admin" });
      const { columns } = await createProjectFixture({
        workspaceId: admin.workspace.id,
      });

      mockAuthenticatedSession(admin.user);
      const { app } = createApp();

      expect((await putWipLimit(app, columns.todo.id, 4)).status).toBe(200);
      expect((await putWipLimit(app, columns.todo.id, null)).status).toBe(200);

      const persisted = await db.query.columnTable.findFirst({
        where: eq(schema.columnTable.id, columns.todo.id),
      });
      expect(persisted?.wipLimit).toBeNull();
    });

    it("leaves a stored WIP limit untouched when the field is omitted", async () => {
      const admin = await createWorkspaceMember({ role: "admin" });
      const { columns } = await createProjectFixture({
        workspaceId: admin.workspace.id,
      });

      mockAuthenticatedSession(admin.user);
      const { app } = createApp();

      expect((await putWipLimit(app, columns.todo.id, 7)).status).toBe(200);

      const response = await app.request(`/api/column/${columns.todo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      });
      expect(response.status).toBe(200);

      const persisted = await db.query.columnTable.findFirst({
        where: eq(schema.columnTable.id, columns.todo.id),
      });
      expect(persisted?.name).toBe("Renamed");
      expect(persisted?.wipLimit).toBe(7);
    });

    it("rejects an out-of-range WIP limit with a 400, not a 500", async () => {
      const admin = await createWorkspaceMember({ role: "admin" });
      const { columns } = await createProjectFixture({
        workspaceId: admin.workspace.id,
      });

      mockAuthenticatedSession(admin.user);
      const { app } = createApp();

      // 2147483648 is one above PostgreSQL's int4 max. Without v.maxValue on
      // wipLimitSchema this reaches the driver and raises 22003, which the API
      // sanitizes into a 500.
      const response = await putWipLimit(app, columns.todo.id, 2147483648);
      expect(response.status).toBe(400);

      const persisted = await db.query.columnTable.findFirst({
        where: eq(schema.columnTable.id, columns.todo.id),
      });
      expect(persisted?.wipLimit).toBeNull();
    });
  });

  describe("POST /api/column/:projectId", () => {
    it("blocks a member from creating a column with a WIP limit", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/column/${project.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Blocked", wipLimit: 2 }),
      });
      expect(response.status).toBe(403);

      const created = await db.query.columnTable.findFirst({
        where: eq(schema.columnTable.slug, "blocked"),
      });
      expect(created).toBeUndefined();
    });

    it("allows an admin to create a column with a WIP limit", async () => {
      const admin = await createWorkspaceMember({ role: "admin" });
      const { project } = await createProjectFixture({
        workspaceId: admin.workspace.id,
      });

      mockAuthenticatedSession(admin.user);
      const { app } = createApp();

      const response = await app.request(`/api/column/${project.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Capped", wipLimit: 2 }),
      });
      expect(response.status).toBe(200);

      const created = await db.query.columnTable.findFirst({
        where: eq(schema.columnTable.slug, "capped"),
      });
      expect(created?.wipLimit).toBe(2);
    });
  });

  describe("GET /api/column/:projectId", () => {
    it("returns the persisted wipLimit, which is what a page reload reads", async () => {
      const admin = await createWorkspaceMember({ role: "admin" });
      const { project, columns } = await createProjectFixture({
        workspaceId: admin.workspace.id,
      });

      mockAuthenticatedSession(admin.user);
      const { app } = createApp();

      expect((await putWipLimit(app, columns.todo.id, 5)).status).toBe(200);

      const response = await app.request(`/api/column/${project.id}`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as Array<{
        id: string;
        wipLimit: number | null;
      }>;
      const todo = body.find((column) => column.id === columns.todo.id);
      expect(todo?.wipLimit).toBe(5);
    });
  });
});

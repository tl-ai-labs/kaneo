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

describe("API integration: column wipLimit (advisory)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("persists wipLimit 5 on create", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/column/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Capped", wipLimit: 5 }),
    });
    expect(response.status).toBe(200);
    const payload =
      (await response.json()) as typeof schema.columnTable.$inferSelect;
    expect(payload.wipLimit).toBe(5);

    const persisted = await db.query.columnTable.findFirst({
      where: eq(schema.columnTable.id, payload.id),
    });
    expect(persisted?.wipLimit).toBe(5);
  });

  it("persists null when wipLimit is omitted on create", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/column/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Uncapped" }),
    });
    expect(response.status).toBe(200);
    const payload =
      (await response.json()) as typeof schema.columnTable.$inferSelect;
    expect(payload.wipLimit).toBeNull();

    const persisted = await db.query.columnTable.findFirst({
      where: eq(schema.columnTable.id, payload.id),
    });
    expect(persisted?.wipLimit).toBeNull();
  });

  it("clears an existing limit when updated with an explicit null", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    await db
      .update(schema.columnTable)
      .set({ wipLimit: 3 })
      .where(eq(schema.columnTable.id, columns.todo.id));
    const preset = await db.query.columnTable.findFirst({
      where: eq(schema.columnTable.id, columns.todo.id),
    });
    expect(preset?.wipLimit).toBe(3);

    const response = await app.request(`/api/column/${columns.todo.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wipLimit: null }),
    });
    expect(response.status).toBe(200);

    const persisted = await db.query.columnTable.findFirst({
      where: eq(schema.columnTable.id, columns.todo.id),
    });
    expect(persisted?.wipLimit).toBeNull();
  });

  it("rejects wipLimit 0 with 400 and leaves the stored value unchanged", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    await db
      .update(schema.columnTable)
      .set({ wipLimit: 7 })
      .where(eq(schema.columnTable.id, columns.todo.id));

    const response = await app.request(`/api/column/${columns.todo.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wipLimit: 0 }),
    });
    expect(response.status).toBe(400);

    const persisted = await db.query.columnTable.findFirst({
      where: eq(schema.columnTable.id, columns.todo.id),
    });
    expect(persisted?.wipLimit).toBe(7);
  });

  it("returns wipLimit on every column of the board projection", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    await db
      .update(schema.columnTable)
      .set({ wipLimit: 4 })
      .where(eq(schema.columnTable.id, columns.inProgress.id));

    const response = await app.request(`/api/task/tasks/${project.id}`, {
      method: "GET",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        columns: Array<{ id: string; slug: string; wipLimit: number | null }>;
      };
    };

    // The board projection sets id to the column slug, so match on slug.
    const configured = body.data.columns.find(
      (c) => c.slug === columns.inProgress.slug,
    );
    expect(configured).toBeDefined();
    expect(configured?.wipLimit).toBe(4);

    const others = body.data.columns.filter(
      (c) => c.slug !== columns.inProgress.slug,
    );
    expect(others.length).toBeGreaterThan(0);
    for (const col of others) {
      expect(
        col.wipLimit,
        `column slug=${col.slug} should have wipLimit null`,
      ).toBeNull();
    }
  });

  it("is advisory only: a column may hold more tasks than its limit", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    await db
      .update(schema.columnTable)
      .set({ wipLimit: 1 })
      .where(eq(schema.columnTable.id, columns.todo.id));

    await db.insert(schema.taskTable).values({
      projectId: project.id,
      userId: member.user.id,
      title: "First task",
      status: columns.todo.slug,
      columnId: columns.todo.id,
      priority: "medium",
      number: 1,
      position: 1,
    });

    await db.insert(schema.taskTable).values({
      projectId: project.id,
      userId: member.user.id,
      title: "Second task (over limit)",
      status: columns.todo.slug,
      columnId: columns.todo.id,
      priority: "medium",
      number: 2,
      position: 2,
    });

    const response = await app.request(`/api/task/tasks/${project.id}`, {
      method: "GET",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        columns: Array<{
          slug: string;
          wipLimit: number | null;
          tasks: unknown[];
        }>;
      };
    };

    const overLimit = body.data.columns.find(
      (c) => c.slug === columns.todo.slug,
    );
    expect(overLimit).toBeDefined();
    expect(overLimit?.wipLimit).toBe(1);
    expect(overLimit?.tasks.length).toBe(2);
  });
});

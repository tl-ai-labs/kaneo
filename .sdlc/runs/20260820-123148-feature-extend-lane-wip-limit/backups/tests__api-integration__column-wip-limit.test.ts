import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

type BoardColumn = {
  id: string;
  columnId: string;
  slug: string;
  name: string;
  icon: string | null;
  isFinal: boolean;
  wipLimit: number | null;
  tasks: unknown[];
};

type Board = { columns: BoardColumn[] };

describe("API integration: column WIP limit", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates a column with a WIP limit (AC-2)", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const projectResponse = await app.request("/api/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: member.workspace.id,
        name: "Roadmap",
        icon: "FolderKanban",
        slug: "roadmap",
      }),
    });
    expect(projectResponse.status).toBe(200);
    const project =
      (await projectResponse.json()) as typeof schema.projectTable.$inferSelect;

    const response = await app.request(`/api/column/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Staging",
        wipLimit: 4,
      }),
    });

    expect(response.status).toBe(200);
    const payload =
      (await response.json()) as typeof schema.columnTable.$inferSelect;
    expect(payload.wipLimit).toBe(4);

    const persistedColumn = await db.query.columnTable.findFirst({
      where: eq(schema.columnTable.id, payload.id),
    });
    expect(persistedColumn).toBeDefined();
    expect(persistedColumn?.wipLimit).toBe(4);
  });

  it("updates and clears WIP limit on an existing column (AC-3)", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const projectResponse = await app.request("/api/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: member.workspace.id,
        name: "Roadmap",
        icon: "FolderKanban",
        slug: "roadmap",
      }),
    });
    expect(projectResponse.status).toBe(200);
    const project =
      (await projectResponse.json()) as typeof schema.projectTable.$inferSelect;

    const createResponse = await app.request(`/api/column/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Staging",
        wipLimit: 4,
      }),
    });
    expect(createResponse.status).toBe(200);
    const column =
      (await createResponse.json()) as typeof schema.columnTable.$inferSelect;

    // 1. Set wipLimit to 7
    const update1Response = await app.request(`/api/column/${column.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wipLimit: 7,
      }),
    });
    expect(update1Response.status).toBe(200);
    const persisted1 = await db.query.columnTable.findFirst({
      where: eq(schema.columnTable.id, column.id),
    });
    expect(persisted1?.wipLimit).toBe(7);

    // 2. Clear wipLimit with null
    const update2Response = await app.request(`/api/column/${column.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wipLimit: null,
      }),
    });
    expect(update2Response.status).toBe(200);
    const persisted2 = await db.query.columnTable.findFirst({
      where: eq(schema.columnTable.id, column.id),
    });
    expect(persisted2?.wipLimit).toBeNull();

    // 3. Update name with wipLimit omitted (stored wipLimit remains untouched)
    const update3Response = await app.request(`/api/column/${column.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Renamed",
      }),
    });
    expect(update3Response.status).toBe(200);
    const persisted3 = await db.query.columnTable.findFirst({
      where: eq(schema.columnTable.id, column.id),
    });
    expect(persisted3?.name).toBe("Renamed");
    expect(persisted3?.wipLimit).toBeNull();
  });

  it("rejects unauthenticated column updates and leaves stored WIP limit unchanged (AC-4)", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const projectResponse = await app.request("/api/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: member.workspace.id,
        name: "Roadmap",
        icon: "FolderKanban",
        slug: "roadmap",
      }),
    });
    expect(projectResponse.status).toBe(200);
    const project =
      (await projectResponse.json()) as typeof schema.projectTable.$inferSelect;

    const createResponse = await app.request(`/api/column/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Staging",
        wipLimit: 5,
      }),
    });
    expect(createResponse.status).toBe(200);
    const column =
      (await createResponse.json()) as typeof schema.columnTable.$inferSelect;

    mockAnonymousSession();

    const response = await app.request(`/api/column/${column.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wipLimit: 10,
      }),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);

    const persistedColumn = await db.query.columnTable.findFirst({
      where: eq(schema.columnTable.id, column.id),
    });
    expect(persistedColumn?.wipLimit).toBe(5);
  });

  it("projects column slug as id, uuid as columnId, and wipLimit on tasks endpoint (AC-12)", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const projectResponse = await app.request("/api/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: member.workspace.id,
        name: "Roadmap",
        icon: "FolderKanban",
        slug: "roadmap",
      }),
    });
    expect(projectResponse.status).toBe(200);
    const project =
      (await projectResponse.json()) as typeof schema.projectTable.$inferSelect;

    const createResponse = await app.request(`/api/column/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Staging",
        wipLimit: 4,
      }),
    });
    expect(createResponse.status).toBe(200);
    const createdColumn =
      (await createResponse.json()) as typeof schema.columnTable.$inferSelect;

    const tasksResponse = await app.request(`/api/task/tasks/${project.id}`, {
      method: "GET",
    });
    expect(tasksResponse.status).toBe(200);
    const board = (await tasksResponse.json()) as Board;
    const columns = board.columns;

    expect(columns.length).toBeGreaterThan(0);

    for (const col of columns) {
      expect(col.id).toBe(col.slug);
      expect(col.id).not.toBe(col.columnId);
    }

    const matchedColumn = columns.find(
      (c: BoardColumn) => c.columnId === createdColumn.id,
    );
    expect(matchedColumn).toBeDefined();
    if (!matchedColumn) throw new Error("matchedColumn not found");
    expect(matchedColumn.id).toBe(matchedColumn.slug);
    expect(matchedColumn.id !== matchedColumn.columnId).toBe(true);
    expect(matchedColumn.wipLimit).toBe(4);

    const defaultColumn = columns.find(
      (c: BoardColumn) => c.columnId !== createdColumn.id,
    );
    expect(defaultColumn).toBeDefined();
    if (!defaultColumn) throw new Error("defaultColumn not found");
    expect(defaultColumn.id).toBe(defaultColumn.slug);
    expect(defaultColumn.id !== defaultColumn.columnId).toBe(true);
    expect(defaultColumn.wipLimit).toBeNull();
  });
});

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

type ColumnResponse = {
  id: string;
  wipLimit: number | null;
};

type BoardColumn = {
  id: string;
  wipLimit: number | null;
  tasks: unknown[];
};

// GET /api/task/tasks/:projectId wraps the board in { data, pagination }.
type BoardResponse = {
  data: {
    columns: BoardColumn[];
  };
};

function readColumn(id: string) {
  return db.query.columnTable.findFirst({
    where: eq(schema.columnTable.id, id),
  });
}

function putColumn(id: string, body: Record<string, unknown>) {
  const { app } = createApp();
  return app.request(`/api/column/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function postColumn(projectId: string, body: Record<string, unknown>) {
  const { app } = createApp();
  return app.request(`/api/column/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API integration: column WIP limit", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  // The fixture seeds its columns without a wipLimit, so this is the
  // pre-existing-row case: the migration adds a nullable column with no
  // backfill and existing rows must read back as "no limit".
  it("reads back null for columns that predate the feature", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    expect((await readColumn(columns.todo.id))?.wipLimit).toBeNull();
    expect((await readColumn(columns.done.id))?.wipLimit).toBeNull();
  });

  it("persists a wipLimit supplied at create time", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);

    const response = await postColumn(project.id, {
      name: "Blocked",
      wipLimit: 3,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as ColumnResponse;
    expect(body.wipLimit).toBe(3);
    expect((await readColumn(body.id))?.wipLimit).toBe(3);
  });

  it("stores null when wipLimit is omitted at create time", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);

    const response = await postColumn(project.id, { name: "Staging" });

    expect(response.status).toBe(200);
    expect(((await response.json()) as ColumnResponse).wipLimit).toBeNull();
  });

  it("stores null when wipLimit is explicitly null at create time", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);

    const response = await postColumn(project.id, {
      name: "Backlog",
      wipLimit: null,
    });

    expect(response.status).toBe(200);
    expect(((await response.json()) as ColumnResponse).wipLimit).toBeNull();
  });

  it("leaves an existing wipLimit untouched when a later update omits it", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);

    expect((await putColumn(columns.todo.id, { wipLimit: 2 })).status).toBe(
      200,
    );
    expect(
      (await putColumn(columns.todo.id, { name: "Todo Renamed" })).status,
    ).toBe(200);

    expect((await readColumn(columns.todo.id))?.wipLimit).toBe(2);
  });

  it("clears the limit when updated with null", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);

    await putColumn(columns.todo.id, { wipLimit: 4 });
    expect((await putColumn(columns.todo.id, { wipLimit: null })).status).toBe(
      200,
    );

    expect((await readColumn(columns.todo.id))?.wipLimit).toBeNull();
  });

  it.each([0, -1, 1.5, 2147483648, "5"])(
    "rejects %p with a 400 and leaves the stored value unchanged",
    async (invalid) => {
      const member = await createWorkspaceMember({ role: "admin" });
      const { columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      mockAuthenticatedSession(member.user);

      await putColumn(columns.todo.id, { wipLimit: 6 });
      const response = await putColumn(columns.todo.id, { wipLimit: invalid });

      expect(response.status).toBe(400);
      expect((await readColumn(columns.todo.id))?.wipLimit).toBe(6);
    },
  );

  it("accepts the int4 ceiling", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);

    const response = await putColumn(columns.todo.id, {
      wipLimit: 2147483647,
    });

    expect(response.status).toBe(200);
    expect((await readColumn(columns.todo.id))?.wipLimit).toBe(2147483647);
  });

  // The board projection re-maps columns field by field, so a new column is
  // invisible to the client unless it is listed there explicitly.
  it("carries wipLimit on the board projection", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);

    await putColumn(columns.todo.id, { wipLimit: 5 });

    const { app } = createApp();
    const response = await app.request(`/api/task/tasks/${project.id}`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as BoardResponse;
    const todo = body.data.columns.find((c) => c.id === columns.todo.slug);
    const inProgress = body.data.columns.find(
      (c) => c.id === columns.inProgress.slug,
    );

    expect(todo?.wipLimit).toBe(5);
    expect(inProgress?.wipLimit).toBeNull();
  });

  // Advisory only: the limit is a signal, never a gate.
  it("still accepts tasks created into a column that is over its limit", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);

    await putColumn(columns.todo.id, { wipLimit: 1 });

    const { app } = createApp();
    for (const title of ["Task A", "Task B", "Task C"]) {
      const response = await app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: "",
          priority: "low",
          status: columns.todo.slug,
        }),
      });
      expect(response.status).toBe(200);
    }

    const board = await app.request(`/api/task/tasks/${project.id}`);
    const body = (await board.json()) as BoardResponse;
    const todo = body.data.columns.find((c) => c.id === columns.todo.slug);

    expect(todo?.tasks).toHaveLength(3);
    expect(todo?.wipLimit).toBe(1);
  });

  // Authorization is inherited, not re-implemented: `member` lacks
  // project:update, so the same middleware that guards every other column
  // mutation refuses this one.
  it("refuses a member-role user with 403", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const { columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);

    const response = await putColumn(columns.todo.id, { wipLimit: 3 });

    expect(response.status).toBe(403);
    expect((await readColumn(columns.todo.id))?.wipLimit).toBeNull();
  });
});

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: task estimatedHours", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists estimatedHours on create and defaults to null when omitted", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const resWithHours = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Task with hours",
        description: "",
        priority: "low",
        status: "to-do",
        estimatedHours: 8,
      }),
    });
    expect(resWithHours.status).toBe(200);
    const createdWithHours = (await resWithHours.json()) as {
      id: string;
      estimatedHours: number | null;
    };
    expect(createdWithHours.estimatedHours).toBe(8);

    const [dbRow1] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, createdWithHours.id));
    expect(dbRow1.estimatedHours).toBe(8);

    const resWithoutHours = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Task without hours",
        description: "",
        priority: "low",
        status: "to-do",
      }),
    });
    expect(resWithoutHours.status).toBe(200);
    const createdWithoutHours = (await resWithoutHours.json()) as {
      id: string;
    };

    const [dbRow2] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, createdWithoutHours.id));
    expect(dbRow2.estimatedHours).toBeNull();
  });

  it("preserves estimatedHours when a full PUT omits it, and clears on explicit null", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        userId: member.user.id,
        title: "Preserve test task",
        status: "to-do",
        number: 1,
        position: 1,
        estimatedHours: 5,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const setRes = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Preserve test task",
        description: "",
        priority: "medium",
        status: "to-do",
        projectId: project.id,
        userId: member.user.id,
        position: 1,
        estimatedHours: 12,
      }),
    });
    expect(setRes.status).toBe(200);

    const [afterSetRow] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(afterSetRow.estimatedHours).toBe(12);

    // This body mirrors what the web updateTask fetcher sends on a
    // drag-and-drop or archive-all — including userId, which the fetcher always
    // sends as `task.userId || ""`. Only estimatedHours is omitted, and the
    // stored estimate must survive.
    //
    // userId is load-bearing here: requireTaskAssigneePermission compares
    // `existingTask.userId !== (userId || null)`, so a body that omits userId
    // reads as an UNASSIGN and escalates to the `task: ["assign"]` permission,
    // which the default `member` role does not hold — a 403, not a 200.
    const omitRes = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Preserve test task moved",
        description: "",
        priority: "medium",
        status: "to-do",
        projectId: project.id,
        userId: member.user.id,
        position: 2,
      }),
    });
    expect(omitRes.status).toBe(200);

    const [afterOmitRow] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(afterOmitRow.estimatedHours).toBe(12);

    const clearRes = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Preserve test task moved",
        description: "",
        priority: "medium",
        status: "to-do",
        projectId: project.id,
        userId: member.user.id,
        position: 2,
        estimatedHours: null,
      }),
    });
    expect(clearRes.status).toBe(200);

    const [afterClearRow] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(afterClearRow.estimatedHours).toBeNull();
  });

  it("rejects out-of-range and wrongly-typed estimates with 400 without touching the database", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        userId: member.user.id,
        title: "Validation test task",
        status: "to-do",
        number: 1,
        position: 1,
        estimatedHours: 10,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const invalidValues: unknown[] = [-1, 1001, 2.5, "8"];

    for (const val of invalidValues) {
      const postRes = await app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Invalid create task",
          description: "",
          priority: "low",
          status: "to-do",
          estimatedHours: val,
        }),
      });
      expect(postRes.status).toBe(400);

      const putRes = await app.request(`/api/task/${task.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Validation test task",
          description: "",
          priority: "medium",
          status: "to-do",
          projectId: project.id,
          position: 1,
          estimatedHours: val,
        }),
      });
      expect(putRes.status).toBe(400);

      const [currentDbRow] = await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.id, task.id));
      expect(currentDbRow.estimatedHours).toBe(10);
    }
  });

  it("returns estimatedHours on every board task and supports a correct client-side rollup", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const hoursList: Array<number | null> = [8, null, 0, 4];
    for (let i = 0; i < hoursList.length; i++) {
      await db.insert(schema.taskTable).values({
        projectId: project.id,
        userId: member.user.id,
        title: `Task ${i + 1}`,
        status: "to-do",
        number: i + 1,
        position: i + 1,
        estimatedHours: hoursList[i],
      });
    }

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const boardRes = await app.request(`/api/task/tasks/${project.id}`);
    expect(boardRes.status).toBe(200);

    const boardBody = (await boardRes.json()) as {
      data: {
        columns: Array<{
          slug: string;
          tasks: Array<
            Record<string, unknown> & { estimatedHours?: number | null }
          >;
        }>;
      };
    };

    const todoColumn = boardBody.data.columns.find(
      (col) => col.slug === "to-do",
    );
    expect(todoColumn).toBeDefined();
    if (!todoColumn) return;
    expect(todoColumn.tasks.length).toBe(4);

    // Asserts the KEY exists, not merely its value. This is what catches a
    // missing entry in the get-tasks taskSelection: ProjectWithTasks overrides
    // columns[].tasks with a hand-written type, so typecheck cannot see it.
    for (const taskItem of todoColumn.tasks) {
      expect(Object.keys(taskItem)).toContain("estimatedHours");
    }

    const estimated = todoColumn.tasks
      .map((t) => t.estimatedHours)
      .filter((h): h is number => typeof h === "number");
    const sumHours = estimated.reduce((acc, h) => acc + h, 0);

    expect(sumHours).toBe(12);
    // The 0 counts as estimated; the null does not.
    expect(estimated.length).toBe(3);
  });

  it("returns estimatedHours on the single-task read", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        userId: member.user.id,
        title: "Single read task",
        status: "to-do",
        number: 1,
        position: 1,
        estimatedHours: 6,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const res = await app.request(`/api/task/${task.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { estimatedHours: number | null };
    expect(body.estimatedHours).toBe(6);
  });

  // Without this, 0 only ever reaches the database via a direct db.insert, so
  // changing `estimatedHours ?? null` to `|| null` in create-task.ts would fail
  // no test at all.
  it("treats 0 as a real estimate across the create and update routes", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const createRes = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Zero estimate task",
        description: "",
        status: "to-do",
        priority: "medium",
        estimatedHours: 0,
      }),
    });
    expect(createRes.status).toBe(200);
    const createBody = (await createRes.json()) as {
      id: string;
      estimatedHours: number | null;
    };
    expect(createBody.estimatedHours).toBe(0);
    expect(createBody.estimatedHours).not.toBeNull();

    const [createdRow] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, createBody.id));
    expect(createdRow.estimatedHours).toBe(0);

    const [secondTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        userId: member.user.id,
        title: "Second task",
        status: "to-do",
        number: 2,
        position: 2,
        estimatedHours: 5,
      })
      .returning();

    const updateRes = await app.request(`/api/task/${secondTask.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        userId: member.user.id,
        title: "Second task",
        description: "",
        status: "to-do",
        priority: "medium",
        position: 2,
        estimatedHours: 0,
      }),
    });
    expect(updateRes.status).toBe(200);

    const [updatedRow] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, secondTask.id));
    expect(updatedRow.estimatedHours).toBe(0);
  });
});

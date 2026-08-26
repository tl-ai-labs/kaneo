import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: task creation", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated task creation requests", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Unauthorized task",
        description: "Should not be created",
        priority: "low",
        status: "to-do",
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Unauthorized");
  });

  it("creates a task with the matching column, assignee, and next number", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Delivery",
      slug: "delivery",
    });

    await db.insert(schema.taskTable).values({
      projectId: project.id,
      userId: member.user.id,
      title: "Existing task",
      description: "Already there",
      status: "to-do",
      columnId: columns.todo.id,
      priority: "medium",
      number: 1,
      position: 1,
    });
    await db
      .update(schema.projectTable)
      .set({ lastTaskNumber: 1 })
      .where(eq(schema.projectTable.id, project.id));

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Ship integration flow",
        description: "Cover the first create-task path",
        priority: "high",
        status: "to-do",
        userId: member.user.id,
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      projectId: string;
      title: string;
      description: string;
      priority: string;
      status: string;
      userId: string | null;
      number: number | null;
      position: number | null;
      assigneeName?: string;
    };

    expect(payload).toMatchObject({
      projectId: project.id,
      title: "Ship integration flow",
      description: "Cover the first create-task path",
      priority: "high",
      status: "to-do",
      userId: member.user.id,
      number: 2,
      position: 2,
      assigneeName: member.user.name,
    });

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, payload.id),
    });

    expect(persistedTask).toMatchObject({
      id: payload.id,
      projectId: project.id,
      columnId: columns.todo.id,
      userId: member.user.id,
      title: "Ship integration flow",
      priority: "high",
      status: "to-do",
      number: 2,
      position: 2,
    });
  });

  it("rejects task creation for users outside the project workspace", async () => {
    const member = await createWorkspaceMember();
    const outsiderId = `user-${randomUUID()}`;
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const [outsider] = await db
      .insert(schema.userTable)
      .values({
        id: outsiderId,
        email: `${outsiderId}@example.com`,
        emailVerified: true,
        name: "Task Outsider",
      })
      .returning();

    mockAuthenticatedSession(outsider);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Forbidden task",
        description: "Should not be created",
        priority: "low",
        status: "to-do",
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe(
      "You don't have access to this workspace",
    );

    const persistedTask = await db.query.taskTable.findFirst({
      where: and(
        eq(schema.taskTable.projectId, project.id),
        eq(schema.taskTable.title, "Forbidden task"),
      ),
    });

    expect(persistedTask).toBeUndefined();
  });

  it("creates an unassigned task with parsed dates when optional fields are provided", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Plan release cut",
        description: "Track optional fields too",
        priority: "medium",
        status: "in-progress",
        startDate: "2026-04-01T09:00:00.000Z",
        dueDate: "2026-04-05T17:00:00.000Z",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      userId: string | null;
      columnId: string | null;
      startDate: string | null;
      dueDate: string | null;
      assigneeName?: string;
    };

    expect(payload).toMatchObject({
      userId: null,
      columnId: columns.inProgress.id,
      startDate: "2026-04-01T09:00:00.000Z",
      dueDate: "2026-04-05T17:00:00.000Z",
    });
    expect(payload.assigneeName).toBeUndefined();

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, payload.id),
    });

    expect(persistedTask).toMatchObject({
      id: payload.id,
      userId: null,
      columnId: columns.inProgress.id,
      status: "in-progress",
    });
    expect(persistedTask?.startDate?.toISOString()).toBe(
      "2026-04-01T09:00:00.000Z",
    );
    expect(persistedTask?.dueDate?.toISOString()).toBe(
      "2026-04-05T17:00:00.000Z",
    );
  });

  it("creates tasks without a column when the status has no matching project column", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Future status task",
        description: "Status does not map to a seeded column",
        priority: "low",
        status: "planned",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      status: string;
      columnId: string | null;
      position: number | null;
    };

    expect(payload).toMatchObject({
      status: "planned",
      columnId: null,
      position: 1,
    });

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, payload.id),
    });

    expect(persistedTask).toMatchObject({
      id: payload.id,
      status: "planned",
      columnId: null,
      position: 1,
    });
  });

  it("rejects task creation when the assignee userId does not exist", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const missingAssigneeId = `user-${randomUUID()}`;

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Ghost assignee task",
        description: "Should fail because the assignee does not exist",
        priority: "low",
        status: "to-do",
        userId: missingAssigneeId,
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Assignee not found");

    const persistedTask = await db.query.taskTable.findFirst({
      where: and(
        eq(schema.taskTable.projectId, project.id),
        eq(schema.taskTable.title, "Ghost assignee task"),
      ),
    });

    expect(persistedTask).toBeUndefined();
  });

  it("creates a task when the assignee userId is surrounded by whitespace", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const paddedAssigneeId = `  ${member.user.id}  `;

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Padded assignee task",
        description: "Whitespace around userId should be trimmed",
        priority: "medium",
        status: "to-do",
        userId: paddedAssigneeId,
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      userId: string;
      assigneeName?: string;
    };

    expect(payload.userId).toBe(member.user.id);
    expect(payload.assigneeName).toBe(member.user.name);

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, payload.id),
    });

    expect(persistedTask).toMatchObject({
      id: payload.id,
      projectId: project.id,
      columnId: columns.todo.id,
      userId: member.user.id,
      title: "Padded assignee task",
    });
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
  ])(
    "creates an unassigned task when the assignee userId is %s",
    async (label, userId) => {
      const member = await createWorkspaceMember();
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const title = `Blank assignee task (${label})`;
      const response = await app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title,
          description: "Blank userId means unassigned",
          priority: "low",
          status: "to-do",
          userId,
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        userId: string | null;
        assigneeName?: string;
      };

      expect(payload.userId).toBeNull();
      expect(payload.assigneeName).toBeUndefined();

      const persistedTask = await db.query.taskTable.findFirst({
        where: and(
          eq(schema.taskTable.projectId, project.id),
          eq(schema.taskTable.title, title),
        ),
      });

      expect(persistedTask?.userId).toBeNull();
    },
  );
});

describe("API integration: task estimated hours", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function seedTask(estimatedHours?: number | null) {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const body: Record<string, unknown> = {
      title: "Some task",
      description: "desc",
      priority: "low",
      status: "to-do",
    };
    if (estimatedHours !== undefined) {
      body.estimatedHours = estimatedHours;
    }

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const task = (await response.json()) as {
      id: string;
      title: string;
      description: string;
      priority: string;
      status: string;
      projectId: string;
      position: number;
      estimatedHours: number | null;
    };

    return { member, project, columns, app, task };
  }

  it("creates a task with a null estimate when the field is omitted", async () => {
    const { task } = await seedTask();

    expect(task.estimatedHours).toBeNull();

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });

    expect(persistedTask?.estimatedHours).toBeNull();
  });

  it("persists a fractional estimate supplied at creation", async () => {
    const { task } = await seedTask(2.5);

    expect(task.estimatedHours).toBe(2.5);

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });

    expect(persistedTask?.estimatedHours).toBe(2.5);
    expect(typeof persistedTask?.estimatedHours).toBe("number");
  });

  it("sets, changes and clears the estimate through the single-field route", async () => {
    const { task, app } = await seedTask();

    const setResponse = await app.request(
      `/api/task/estimated-hours/${task.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estimatedHours: 0.5 }),
      },
    );

    expect(setResponse.status).toBe(200);
    const setPayload = (await setResponse.json()) as {
      estimatedHours: number | null;
    };
    expect(setPayload.estimatedHours).toBe(0.5);

    const changeResponse = await app.request(
      `/api/task/estimated-hours/${task.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estimatedHours: 3.25 }),
      },
    );

    expect(changeResponse.status).toBe(200);
    const changePayload = (await changeResponse.json()) as {
      estimatedHours: number | null;
    };
    expect(changePayload.estimatedHours).toBe(3.25);

    const clearResponse = await app.request(
      `/api/task/estimated-hours/${task.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estimatedHours: null }),
      },
    );

    expect(clearResponse.status).toBe(200);
    const clearPayload = (await clearResponse.json()) as {
      estimatedHours: number | null;
    };
    expect(clearPayload.estimatedHours).toBeNull();

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });

    expect(persistedTask?.estimatedHours).toBeNull();
  });

  it("rejects a negative estimate and leaves the stored value untouched", async () => {
    const { task, app } = await seedTask(2.5);

    const response = await app.request(`/api/task/estimated-hours/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ estimatedHours: -1 }),
    });

    expect(response.status).toBe(400);

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });

    expect(persistedTask?.estimatedHours).toBe(2.5);
  });

  it("stores an explicit zero as zero rather than null", async () => {
    const { task, app } = await seedTask();

    const response = await app.request(`/api/task/estimated-hours/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ estimatedHours: 0 }),
    });

    expect(response.status).toBe(200);

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });

    expect(persistedTask?.estimatedHours).toBe(0);
    expect(persistedTask?.estimatedHours).not.toBeNull();
  });

  it("rejects an estimate update from a user outside the workspace", async () => {
    const { task } = await seedTask(2.5);

    const outsiderId = `user-${randomUUID()}`;

    const [outsider] = await db
      .insert(schema.userTable)
      .values({
        id: outsiderId,
        email: `${outsiderId}@example.com`,
        emailVerified: true,
        name: "Task Outsider",
      })
      .returning();

    mockAuthenticatedSession(outsider);
    const { app } = createApp();

    const response = await app.request(`/api/task/estimated-hours/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ estimatedHours: 9.5 }),
    });

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe(
      "You don't have access to this workspace",
    );

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });

    expect(persistedTask?.estimatedHours).toBe(2.5);
  });

  it("returns the estimate through the board payload", async () => {
    const { task, project, app } = await seedTask();

    const setResponse = await app.request(
      `/api/task/estimated-hours/${task.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estimatedHours: 6.5 }),
      },
    );
    expect(setResponse.status).toBe(200);

    const boardResponse = await app.request(`/api/task/tasks/${project.id}`);
    expect(boardResponse.status).toBe(200);

    const boardPayload = (await boardResponse.json()) as {
      data: {
        columns: Array<{
          tasks: Array<{ id: string; estimatedHours: number | null }>;
        }>;
        archivedTasks: Array<{ id: string; estimatedHours: number | null }>;
        plannedTasks: Array<{ id: string; estimatedHours: number | null }>;
      };
    };

    const allTasks = [
      ...boardPayload.data.columns.flatMap((column) => column.tasks ?? []),
      ...(boardPayload.data.archivedTasks ?? []),
      ...(boardPayload.data.plannedTasks ?? []),
    ];

    const boardTask = allTasks.find((candidate) => candidate.id === task.id);

    expect(boardTask?.estimatedHours).toBe(6.5);
  });

  it("preserves the estimate when a whole-task update omits the field", async () => {
    const { task, app } = await seedTask();

    const setResponse = await app.request(
      `/api/task/estimated-hours/${task.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estimatedHours: 4.5 }),
      },
    );
    expect(setResponse.status).toBe(200);

    const updateResponse = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        projectId: task.projectId,
        position: task.position,
      }),
    });

    expect(updateResponse.status).toBe(200);

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });

    expect(persistedTask?.estimatedHours).toBe(4.5);
  });
});

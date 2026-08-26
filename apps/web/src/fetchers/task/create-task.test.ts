import { beforeEach, describe, expect, it, vi } from "vitest";
import createTask from "./create-task";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("@kaneo/libs", () => ({
  client: {
    task: {
      ":projectId": {
        $post: mocks.post,
      },
    },
  },
}));

describe("createTask", () => {
  beforeEach(() => {
    mocks.post.mockReset();
    mocks.post.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "task-1" }),
    });
  });

  it.each([undefined, ""])(
    "omits the assignee when userId is %s",
    async (userId) => {
      await createTask({
        title: "Unassigned task",
        description: "",
        projectId: "project-1",
        userId,
        status: "to-do",
        startDate: undefined,
        dueDate: undefined,
        priority: "no-priority",
      });

      expect(mocks.post).toHaveBeenCalledWith({
        json: {
          title: "Unassigned task",
          description: "",
          status: "to-do",
          startDate: undefined,
          dueDate: undefined,
          priority: "no-priority",
        },
        param: { projectId: "project-1" },
      });
    },
  );

  it("preserves an assigned userId", async () => {
    await createTask({
      title: "Assigned task",
      description: "",
      projectId: "project-1",
      userId: "user-1",
      status: "to-do",
      startDate: undefined,
      dueDate: undefined,
      priority: "no-priority",
    });

    expect(mocks.post).toHaveBeenCalledWith(
      expect.objectContaining({
        json: expect.objectContaining({ userId: "user-1" }),
      }),
    );
  });

  it("omits estimatedHours when it is not supplied", async () => {
    await createTask({
      title: "Unassigned task",
      description: "",
      projectId: "project-1",
      userId: undefined,
      status: "to-do",
      startDate: undefined,
      dueDate: undefined,
      priority: "no-priority",
    });

    expect(mocks.post.mock.calls[0][0].json).not.toHaveProperty(
      "estimatedHours",
    );
  });

  it("forwards an explicit estimatedHours of 0", async () => {
    await createTask({
      title: "Unassigned task",
      description: "",
      projectId: "project-1",
      userId: undefined,
      status: "to-do",
      startDate: undefined,
      dueDate: undefined,
      priority: "no-priority",
      estimatedHours: 0,
    });

    expect(mocks.post).toHaveBeenCalledWith(
      expect.objectContaining({
        json: expect.objectContaining({ estimatedHours: 0 }),
      }),
    );
  });
});

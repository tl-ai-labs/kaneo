import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { ColumnHeader } from "./column-header";

const useGetColumns = vi.fn();

afterEach(() => {
  cleanup();
});

vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: (projectId: string) => useGetColumns(projectId),
}));

vi.mock("@/store/project", () => ({
  default: () => ({ project: { id: "project-1" }, setProject: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: () => false,
    canCreateTasks: () => false,
  }),
}));

vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));

vi.mock("@/components/shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function makeColumn(taskCount: number): ProjectWithTasks["columns"][number] {
  return {
    id: "in-progress",
    slug: "in-progress",
    name: "In Progress",
    icon: null,
    isFinal: false,
    tasks: Array.from({ length: taskCount }, (_, i) => ({
      id: `t-${i}`,
      title: `Task ${i}`,
      number: i + 1,
      description: null,
      status: "in-progress",
      priority: null,
      startDate: null,
      dueDate: null,
      position: i,
      createdAt: "2026-07-17T00:00:00.000Z",
      userId: null,
      assigneeId: null,
      assigneeName: null,
      projectId: "project-1",
    })) as Task[],
  };
}

describe("ColumnHeader", () => {
  it("renders bare task count when wipLimit is null", () => {
    useGetColumns.mockReturnValue({
      data: [{ slug: "in-progress", wipLimit: null }],
    });

    render(<ColumnHeader column={makeColumn(3)} />);

    expect(screen.getByText("3")).toBeVisible();
    expect(screen.queryByText("3/")).toBeNull();
    expect(screen.queryByText("tasks:kanban.wipLimitOverCap")).toBeNull();
  });

  it("renders task count and limit when under cap", () => {
    useGetColumns.mockReturnValue({
      data: [{ slug: "in-progress", wipLimit: 5 }],
    });

    render(<ColumnHeader column={makeColumn(3)} />);

    expect(screen.getByText("3/5")).toBeVisible();
    expect(screen.queryByText("tasks:kanban.wipLimitOverCap")).toBeNull();
  });

  it("renders count and limit without over-cap indicator when exactly at limit", () => {
    useGetColumns.mockReturnValue({
      data: [{ slug: "in-progress", wipLimit: 5 }],
    });

    render(<ColumnHeader column={makeColumn(5)} />);

    expect(screen.getByText("5/5")).toBeVisible();
    expect(screen.queryByText("tasks:kanban.wipLimitOverCap")).toBeNull();
  });

  it("renders count, limit, and over-cap indicator when over limit", () => {
    useGetColumns.mockReturnValue({
      data: [{ slug: "in-progress", wipLimit: 5 }],
    });

    render(<ColumnHeader column={makeColumn(6)} />);

    expect(screen.getByText("6/5")).toBeVisible();
    expect(screen.getByText("tasks:kanban.wipLimitOverCap")).toBeVisible();
  });

  it("renders bare task count when columns data is loading/undefined", () => {
    useGetColumns.mockReturnValue({
      data: undefined,
    });

    render(<ColumnHeader column={makeColumn(3)} />);

    expect(screen.getByText("3")).toBeVisible();
    expect(screen.queryByText("3/")).toBeNull();
    expect(screen.queryByText("tasks:kanban.wipLimitOverCap")).toBeNull();
  });

  it("renders bare task count when column slug is not found in columns data", () => {
    useGetColumns.mockReturnValue({
      data: [{ slug: "done", wipLimit: 1 }],
    });

    render(<ColumnHeader column={makeColumn(3)} />);

    expect(screen.getByText("3")).toBeVisible();
    expect(screen.queryByText("3/")).toBeNull();
    expect(screen.queryByText("tasks:kanban.wipLimitOverCap")).toBeNull();
  });

  it("calls useGetColumns with the active project id", () => {
    useGetColumns.mockReturnValue({
      data: [],
    });

    render(<ColumnHeader column={makeColumn(3)} />);

    expect(useGetColumns).toHaveBeenCalledWith("project-1");
  });
});

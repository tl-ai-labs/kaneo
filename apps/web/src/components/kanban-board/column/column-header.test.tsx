import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { ColumnHeader } from "./column-header";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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

vi.mock("../../shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: () => null,
}));

vi.mock("@/components/shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: () => null,
}));

vi.mock("@/store/project", () => ({
  default: () => ({ project: null, setProject: vi.fn() }),
}));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Test Task",
  number: 1,
  description: null,
  status: "todo",
  priority: null,
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  position: 1,
  createdAt: "2026-07-17T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
  ...overrides,
});

const makeColumn = (
  tasks: Task[],
  overrides: Partial<ProjectWithTasks["columns"][number]> = {},
): ProjectWithTasks["columns"][number] => ({
  id: "todo",
  slug: "todo",
  name: "To Do",
  icon: "circle",
  isFinal: false,
  tasks,
  ...overrides,
});

describe("ColumnHeader", () => {
  it("renders the correct formatted total for mixed null and non-null estimates", () => {
    const tasks = [
      makeTask({ id: "task-1", estimatedMinutes: 100 }),
      makeTask({ id: "task-2", estimatedMinutes: null }),
      makeTask({ id: "task-3", estimatedMinutes: 100 }),
      makeTask({ id: "task-4", estimatedMinutes: 100 }),
    ];

    render(<ColumnHeader column={makeColumn(tasks)} />);

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5h")).toBeInTheDocument();
    expect(screen.getByTitle("tasks:kanban.estimateTotal")).toHaveTextContent(
      "5h",
    );
  });

  it("renders no rollup badge when every estimate is null", () => {
    const tasks = [
      makeTask({ id: "task-1", estimatedMinutes: null }),
      makeTask({ id: "task-2", estimatedMinutes: null }),
      makeTask({ id: "task-3", estimatedMinutes: null }),
      makeTask({ id: "task-4", estimatedMinutes: null }),
    ];

    render(<ColumnHeader column={makeColumn(tasks)} />);

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText(/h$/)).toBeNull();
    expect(screen.queryByTitle("tasks:kanban.estimateTotal")).toBeNull();
  });

  it("renders no rollup badge and count 0 for an empty column", () => {
    render(<ColumnHeader column={makeColumn([])} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByTitle("tasks:kanban.estimateTotal")).toBeNull();
  });

  it("ensures total sum is never NaN when null estimates are present", () => {
    const tasks = [
      makeTask({ id: "task-1", estimatedMinutes: null }),
      makeTask({ id: "task-2", estimatedMinutes: 30 }),
    ];

    render(<ColumnHeader column={makeColumn(tasks)} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("0.5h")).toBeInTheDocument();
    expect(screen.getByTitle("tasks:kanban.estimateTotal")).toHaveTextContent(
      "0.5h",
    );
  });

  it("shows 5h total for three 100-minute tasks (header agrees with cards)", () => {
    const tasks = [
      makeTask({ id: "task-1", estimatedMinutes: 100 }),
      makeTask({ id: "task-2", estimatedMinutes: 100 }),
      makeTask({ id: "task-3", estimatedMinutes: 100 }),
    ];

    render(<ColumnHeader column={makeColumn(tasks)} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5h")).toBeInTheDocument();
    expect(screen.queryByText("5.01h")).toBeNull();
  });
});

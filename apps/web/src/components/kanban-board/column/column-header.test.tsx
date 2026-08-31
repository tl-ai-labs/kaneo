import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import { ColumnHeader } from "./column-header";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));

vi.mock("../../shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: () => null,
}));

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: () => true,
    canCreateTasks: () => true,
  }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({
    project: { id: "project-1", slug: "kan", columns: [] },
    setProject: vi.fn(),
  }),
}));

vi.mock("@/lib/column", () => ({
  getColumnIcon: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

const createTask = (id: string, estimatedMinutes?: number | null): Task => ({
  id,
  title: `Task ${id}`,
  number: 1,
  description: null,
  status: "todo",
  priority: null,
  estimatedMinutes,
  startDate: null,
  dueDate: null,
  position: 1,
  createdAt: "2026-08-05T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
});

describe("ColumnHeader", () => {
  it("renders '6h' rollup badge and count '2' when tasks have several estimates (120 and 240)", () => {
    const column = {
      id: "col-1",
      slug: "todo",
      name: "To Do",
      icon: "circle",
      isFinal: false,
      tasks: [createTask("task-1", 120), createTask("task-2", 240)],
    };

    render(<ColumnHeader column={column} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("6h")).toBeInTheDocument();
  });

  it("renders '2.5h' rollup badge and count '3' when one task has estimate (150, null, null)", () => {
    const column = {
      id: "col-1",
      slug: "todo",
      name: "To Do",
      icon: "circle",
      isFinal: false,
      tasks: [
        createTask("task-1", 150),
        createTask("task-2", null),
        createTask("task-3", null),
      ],
    };

    render(<ColumnHeader column={column} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2.5h")).toBeInTheDocument();
  });

  it("renders NO rollup badge and count '2' when tasks have zero estimates (null, null)", () => {
    const column = {
      id: "col-1",
      slug: "todo",
      name: "To Do",
      icon: "circle",
      isFinal: false,
      tasks: [createTask("task-1", null), createTask("task-2", null)],
    };

    render(<ColumnHeader column={column} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.queryByTitle("tasks:kanban.estimatedHoursRollup"),
    ).not.toBeInTheDocument();
  });

  it("renders NO rollup badge and count '0' for an empty column", () => {
    const column = {
      id: "col-1",
      slug: "todo",
      name: "To Do",
      icon: "circle",
      isFinal: false,
      tasks: [],
    };

    render(<ColumnHeader column={column} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(
      screen.queryByTitle("tasks:kanban.estimatedHoursRollup"),
    ).not.toBeInTheDocument();
  });
});

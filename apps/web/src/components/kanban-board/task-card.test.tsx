import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import TaskCard from "./task-card";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => "",
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1" } }),
}));

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);

vi.mock("./task-card-context-menu/task-card-context-menu-content", () => ({
  default: () => null,
}));

vi.mock("./task-labels", () => ({
  TaskLabels: () => null,
}));

vi.mock("@/store/bulk-selection", () => ({
  default: () => ({
    toggleSelection: vi.fn(),
    isSelected: () => false,
    isFocused: () => false,
  }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({
    project: { id: "project-1", slug: "kan", columns: [] },
  }),
}));

vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => ({
    showAssignees: true,
    showPriority: true,
    showDueDates: true,
    showLabels: true,
    showTaskNumbers: true,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

const baseTask: Task = {
  id: "task-1",
  title: "Card for testing",
  number: 1,
  description: null,
  status: "to-do",
  priority: null,
  startDate: null,
  dueDate: null,
  position: 1,
  createdAt: "2026-08-05T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
};

describe("TaskCard", () => {
  it("renders 2.5h when task.estimatedMinutes is 150", () => {
    render(<TaskCard task={{ ...baseTask, estimatedMinutes: 150 }} />);

    expect(screen.getByText("2.5h")).toBeInTheDocument();
  });

  it("does not render estimate badge when task.estimatedMinutes is null", () => {
    render(<TaskCard task={{ ...baseTask, estimatedMinutes: null }} />);

    expect(screen.queryByText(/h$/)).not.toBeInTheDocument();
  });

  it("does not render estimate badge when task.estimatedMinutes is omitted", () => {
    render(<TaskCard task={baseTask} />);

    expect(screen.queryByText(/h$/)).not.toBeInTheDocument();
  });
});

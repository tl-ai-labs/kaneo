import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import TaskCard from "../kanban-board/task-card";

type NavigateCall = {
  to: string;
  search: (prev: Record<string, unknown>) => Record<string, unknown>;
};

const navigateSpy = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateSpy,
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

vi.mock("@/store/project", () => ({
  default: () => ({
    project: { id: "project-1", slug: "kan", columns: [] },
  }),
}));

vi.mock("@/store/bulk-selection", () => ({
  default: () => ({
    toggleSelection: vi.fn(),
    isSelected: () => false,
    isFocused: () => false,
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

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/query-client", () => ({
  default: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock(
  "../kanban-board/task-card-context-menu/task-card-context-menu-content",
  () => ({ default: () => null }),
);

vi.mock("../kanban-board/task-labels", () => ({
  TaskLabels: () => null,
}));

const task: Task = {
  id: "task-1",
  title: "Card from payload",
  number: 7,
  status: "to-do",
  priority: null,
  startDate: null,
  dueDate: null,
  position: 1,
  description: null,
  createdAt: "2026-08-05T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
  labels: [],
  externalLinks: [],
};

describe("TaskCard search param preservation", () => {
  it("opening a task from a card preserves filter params", () => {
    render(<TaskCard task={task} />);

    fireEvent.click(screen.getByText("Card from payload"));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const call = navigateSpy.mock.calls[0][0] as NavigateCall;
    expect(typeof call.search).toBe("function");
    expect(call.search({ status: ["todo"] })).toEqual({
      status: ["todo"],
      taskId: "task-1",
    });
  });

  it("closing an already-open task from its card preserves filter params", () => {
    window.history.replaceState({}, "", "?taskId=task-1");

    render(<TaskCard task={task} />);

    fireEvent.click(screen.getByText("Card from payload"));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const call = navigateSpy.mock.calls[0][0] as NavigateCall;
    expect(typeof call.search).toBe("function");
    const result = call.search({ status: ["todo"], taskId: "task-1" });
    expect(result.status).toEqual(["todo"]);
    expect(result.taskId).toBeUndefined();

    window.history.replaceState({}, "", "/");
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import TaskCard from "./task-card";

const { navigateSpy } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateSpy,
}));

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
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

vi.mock("@/store/bulk-selection", () => ({
  default: () => ({
    toggleSelection: vi.fn(),
    isSelected: () => false,
    isFocused: () => false,
  }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({ project: { id: "project-1", slug: "kan" } }),
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

const task: Task = {
  id: "task-1",
  title: "Card title",
  number: 7,
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
  labels: [{ id: "label-1", name: "Bug", color: "red" }],
  externalLinks: [],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("TaskCard", () => {
  it("opening a task sheet preserves filter params", () => {
    window.history.replaceState({}, "", "/board?status=to-do&labels=l1,l2");

    render(<TaskCard task={task} />);
    fireEvent.click(screen.getByText("Card title"));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const navArg = navigateSpy.mock.calls[0][0];
    expect(navArg.to).toBe(".");
    expect(typeof navArg.search).toBe("function");
    expect(navArg.replace).toBeUndefined();

    const resolved = navArg.search({ status: "to-do", labels: "l1,l2" });
    expect(resolved).toEqual({
      status: "to-do",
      labels: "l1,l2",
      taskId: "task-1",
    });
  });

  it("closing the task sheet clears only taskId and preserves filter params", () => {
    window.history.replaceState(
      {},
      "",
      "/board?taskId=task-1&status=to-do&labels=l1,l2",
    );

    render(<TaskCard task={task} />);
    fireEvent.click(screen.getByText("Card title"));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const navArg = navigateSpy.mock.calls[0][0];
    expect(navArg.to).toBe(".");
    expect(typeof navArg.search).toBe("function");
    expect(navArg.replace).toBeUndefined();

    const resolved = navArg.search({
      taskId: "task-1",
      status: "to-do",
      labels: "l1,l2",
    });
    expect(resolved).toEqual({
      taskId: undefined,
      status: "to-do",
      labels: "l1,l2",
    });
  });
});

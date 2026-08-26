import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import TaskRow from "./task-row";

const useExternalLinks = vi.fn((_taskId: string) => ({ data: [] }));
const useGetLabelsByTask = vi.fn((_taskId: string) => ({ data: [] }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// vi.hoisted is required: vi.mock factories are hoisted above module-scope
// consts, so a plain `const navigateMock` would not be initialised in time.
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/hooks/queries/external-link/use-external-links", () => ({
  default: (taskId: string) => useExternalLinks(taskId),
}));

vi.mock("@/hooks/queries/label/use-get-labels-by-task", () => ({
  default: (taskId: string) => useGetLabelsByTask(taskId),
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

vi.mock(
  "../kanban-board/task-card-context-menu/task-card-context-menu-content",
  () => ({ default: () => null }),
);

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
  title: "Row from payload",
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
  externalLinks: [
    {
      id: "link-1",
      taskId: "task-1",
      integrationId: "integration-1",
      resourceType: "pull_request",
      externalId: "42",
      url: "https://github.com/o/r/pull/42",
      title: "Fix it",
      metadata: { merged: false, draft: false },
    },
  ],
};

describe("TaskRow", () => {
  it("renders labels and pull requests from the task payload without per-row requests", () => {
    render(<TaskRow task={task} projectSlug="kan" />);

    expect(screen.getByText("Bug")).toBeVisible();
    expect(screen.getByText("#42")).toBeVisible();
    expect(useExternalLinks).not.toHaveBeenCalled();
    expect(useGetLabelsByTask).not.toHaveBeenCalled();
  });

  // These two fail against the pre-fix source by construction: a literal-object
  // `search` has typeof "object" and throws when invoked as a reducer. The
  // seeded status: ["todo"] proves preservation rather than merely shape.
  it("preserves existing search params when opening a task", () => {
    render(<TaskRow task={task} projectSlug="kan" />);

    fireEvent.click(screen.getByText("Row from payload"));

    const options = navigateMock.mock.calls[0][0];
    expect(typeof options.search).toBe("function");
    expect(options.search({ status: ["todo"], taskId: undefined })).toEqual({
      status: ["todo"],
      taskId: "task-1",
    });
  });

  it("preserves existing search params when closing an already-open task", () => {
    render(<TaskRow task={task} projectSlug="kan" />);

    window.history.replaceState({}, "", "/?taskId=task-1");
    fireEvent.click(screen.getByText("Row from payload"));
    window.history.replaceState({}, "", "/");

    const options = navigateMock.mock.calls[0][0];
    expect(typeof options.search).toBe("function");
    expect(options.search({ status: ["todo"], taskId: "task-1" })).toEqual({
      status: ["todo"],
      taskId: undefined,
    });
  });
});

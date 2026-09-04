import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import KanbanBoard from "./index";

const { navigateSpy, registeredShortcuts, bulkState } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  registeredShortcuts: {
    current: {} as Record<string, () => void>,
  },
  bulkState: {
    current: { focusedTaskId: null as string | null },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateSpy,
}));

vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useRegisterShortcuts: (config: {
    shortcuts?: Record<string, () => void>;
  }) => {
    registeredShortcuts.current = config.shortcuts ?? {};
  },
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  closestCorners: () => [],
  KeyboardSensor: class {},
  MouseSensor: class {},
  TouchSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
  defaultDropAnimationSideEffects: () => () => {},
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({ setProject: vi.fn() }),
}));

vi.mock("@/store/bulk-selection", () => {
  const store = () => ({
    setAvailableTasks: vi.fn(),
    focusNext: vi.fn(),
    focusPrevious: vi.fn(),
    focusedTaskId: bulkState.current.focusedTaskId,
    clearFocus: vi.fn(),
  });
  store.getState = () => bulkState.current;
  return { default: store };
});

vi.mock("./column", () => ({ default: () => null }));
vi.mock("./task-card", () => ({ default: () => null }));
vi.mock("../bulk-selection/bulk-toolbar", () => ({ default: () => null }));

const project = {
  id: "project-1",
  name: "Project",
  slug: "PROJ",
  icon: null,
  description: null,
  isPublic: false,
  createdAt: "2026-04-16T00:00:00.000Z",
  updatedAt: "2026-04-16T00:00:00.000Z",
  workspaceId: "workspace-1",
  columns: [
    {
      id: "todo",
      slug: "todo",
      name: "Todo",
      icon: null,
      isFinal: false,
      tasks: [],
    },
  ],
  plannedTasks: [],
  archivedTasks: [],
} as unknown as ProjectWithTasks;

// The active filters a user would have in the URL when pressing j / k.
const activeFilterSearch = {
  taskId: "task-1",
  status: "to-do",
  priority: "high",
  assignee: "user-1",
  labels: "l1,l2",
};

function resolveSearch() {
  const arg = navigateSpy.mock.calls.at(-1)?.[0] as {
    to: string;
    search: (prev: Record<string, unknown>) => Record<string, unknown>;
  };
  expect(typeof arg.search).toBe("function");
  return arg.search(activeFilterSearch);
}

describe("KanbanBoard keyboard navigation", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    registeredShortcuts.current = {};
    bulkState.current = { focusedTaskId: "task-2" };
  });

  afterEach(() => {
    cleanup();
  });

  it("j preserves every board filter while moving the focused task", () => {
    render(<KanbanBoard project={project} />);

    registeredShortcuts.current.j?.();

    expect(resolveSearch()).toEqual({
      taskId: "task-2",
      status: "to-do",
      priority: "high",
      assignee: "user-1",
      labels: "l1,l2",
    });
  });

  it("k preserves every board filter while moving the focused task", () => {
    render(<KanbanBoard project={project} />);

    registeredShortcuts.current.k?.();

    expect(resolveSearch()).toEqual({
      taskId: "task-2",
      status: "to-do",
      priority: "high",
      assignee: "user-1",
      labels: "l1,l2",
    });
  });

  it("does not navigate when nothing is focused", () => {
    bulkState.current = { focusedTaskId: null };
    render(<KanbanBoard project={project} />);

    registeredShortcuts.current.j?.();

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import KanbanBoard from "./index";

type ShortcutConfig = { shortcuts?: Record<string, () => void> };
type NavigateArg = {
  to: string;
  search: (prev: Record<string, unknown>) => Record<string, unknown>;
};

let captured: ShortcutConfig = {};
const navigateSpy = vi.fn();

const bulkSelectionState = {
  setAvailableTasks: vi.fn(),
  focusNext: vi.fn(),
  focusPrevious: vi.fn(),
  focusedTaskId: "task-2",
  clearFocus: vi.fn(),
};

function useBulkSelectionStoreMock() {
  return bulkSelectionState;
}
useBulkSelectionStoreMock.getState = () => ({ focusedTaskId: "task-2" });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  captured = {};
});

vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useRegisterShortcuts: (config: ShortcutConfig) => {
    captured = config;
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateSpy,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
}));

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({ setProject: vi.fn(), project: null }),
}));

vi.mock("@/store/bulk-selection", () => ({
  default: useBulkSelectionStoreMock,
}));

vi.mock("./column", () => ({ default: () => null }));

vi.mock("./task-card", () => ({ default: () => null }));

vi.mock("../bulk-selection/bulk-toolbar", () => ({
  default: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

const project = {
  id: "project-1",
  workspaceId: "workspace-1",
  slug: "kan",
  name: "P",
  columns: [
    { id: "todo", slug: "todo", name: "Todo", isFinal: false, tasks: [] },
  ],
} as unknown as ProjectWithTasks;

describe("KanbanBoard keyboard shortcuts", () => {
  it("j preserves unrelated search params while focusing the next task", () => {
    render(<KanbanBoard project={project} />);

    captured.shortcuts?.j();

    const call = navigateSpy.mock.calls[0][0] as NavigateArg;
    expect(typeof call.search).toBe("function");
    expect(call.search({ status: ["todo"] })).toEqual({
      status: ["todo"],
      taskId: "task-2",
    });
  });

  it("k preserves unrelated search params while focusing the previous task", () => {
    render(<KanbanBoard project={project} />);

    captured.shortcuts?.k();

    const call = navigateSpy.mock.calls[0][0] as NavigateArg;
    expect(typeof call.search).toBe("function");
    expect(call.search({ status: ["todo"] })).toEqual({
      status: ["todo"],
      taskId: "task-2",
    });
  });
});

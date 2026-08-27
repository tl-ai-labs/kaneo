import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route } from "../../routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board";

type NavigateCall = {
  to: string;
  replace: boolean;
  search: (prev: Record<string, unknown>) => Record<string, unknown>;
};

const navigateSpy = vi.fn();
const urlSyncSpy = vi.fn();
const filterHookSpy = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => ({ projectId: "project-1", workspaceId: "workspace-1" }),
    useSearch: () => ({ status: ["todo"], taskId: "task-1" }),
  }),
  useNavigate: () => navigateSpy,
}));

vi.mock("@/components/board/board-toolbar", () => ({
  default: () => null,
}));

vi.mock("@/components/board/use-board-filter-url-sync", () => ({
  useBoardFilterUrlSync: (...args: unknown[]) => {
    urlSyncSpy(...args);
  },
}));

vi.mock("@/components/common/project-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/kanban-board", () => ({
  default: () => null,
}));

vi.mock("@/components/list-view", () => ({
  default: () => null,
}));

vi.mock("@/components/page-title", () => ({
  default: () => null,
}));

vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));

vi.mock("@/components/task/task-details-sheet", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      close-sheet
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: () => null,
}));

vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({ data: [] }),
}));

vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: () => ({ data: null }),
}));

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);

vi.mock("@/hooks/use-board-sort", () => ({
  useBoardSort: () => ({
    sort: { field: "position", direction: "asc" },
    setSort: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useRegisterShortcuts: () => {},
  getModifierKeyText: () => "Ctrl",
}));

vi.mock("@/hooks/use-task-filters-with-labels-support", () => ({
  useTaskFiltersWithLabelsSupport: (...args: unknown[]) => {
    filterHookSpy(...args);
    return {
      filters: {
        status: ["todo"],
        priority: null,
        assignee: null,
        dueDate: null,
        labels: null,
      },
      updateFilter: vi.fn(),
      updateLabelFilter: vi.fn(),
      filteredProject: null,
      hasActiveFilters: true,
      clearFilters: vi.fn(),
    };
  },
}));

vi.mock("@/store/project", () => ({
  default: () => ({ project: null, setProject: vi.fn() }),
}));

vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => ({
    viewMode: "board",
    setViewMode: vi.fn(),
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

// vi.mock replaces the module at runtime, but TypeScript still resolves
// Route to the real TanStack Router type, which does not expose
// `component` publicly. Widen through unknown to bridge this
// deliberate test-only substitution.
const BoardRoute = (Route as unknown as { component: ComponentType }).component;

describe("board route close task sheet", () => {
  it("closing the task sheet preserves filter params", () => {
    render(<BoardRoute />);

    fireEvent.click(screen.getByText("close-sheet"));

    const call = navigateSpy.mock.calls[0][0] as NavigateCall;
    expect(call.replace).toBe(true);
    expect(typeof call.search).toBe("function");

    const next = call.search({ status: ["todo"], taskId: "task-1" });
    expect(next.status).toEqual(["todo"]);
    expect(next.taskId).toBeUndefined();
  });

  it("passes the URL-derived filter state into the filter hook", () => {
    render(<BoardRoute />);

    const call = filterHookSpy.mock.calls[0] as unknown as [
      unknown,
      unknown,
      unknown,
      { carriesFilters: boolean; filters: { status: string[] | null } },
    ];
    const urlState = call[3];

    expect(urlState.carriesFilters).toBe(true);
    expect(urlState.filters.status).toEqual(["todo"]);
  });

  it("wires the board filter URL sync to the resolved filters and the search", () => {
    render(<BoardRoute />);

    expect(urlSyncSpy).toHaveBeenCalled();

    const [filtersArg, searchArg] = urlSyncSpy.mock.calls[0] as unknown as [
      { status: string[] | null },
      { taskId?: string; status?: string[] | null },
    ];

    expect(filtersArg.status).toEqual(["todo"]);
    expect(searchArg).toMatchObject({
      taskId: "task-1",
      status: ["todo"],
    });
  });
});

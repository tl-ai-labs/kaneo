import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";
import { decodeFilterValue } from "@/lib/board-filter-search-params";
import type { ProjectWithTasks } from "@/types/project";
import BoardToolbar from "./board-toolbar";

const { navigateSpy, searchRef, committed } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  searchRef: { current: {} as Record<string, unknown> },
  committed: { current: {} as Record<string, unknown> },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateSpy,
  useSearch: () => searchRef.current,
}));

vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: (
    selector: (s: { weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) => unknown,
  ) => selector({ weekStartsOn: 1 }),
}));

vi.mock("@/components/common/sort-control", () => ({
  default: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("@/components/ui/menu", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    DropdownMenu: Passthrough,
    DropdownMenuContent: Passthrough,
    DropdownMenuGroup: Passthrough,
    DropdownMenuLabel: Passthrough,
    DropdownMenuSeparator: () => null,
    DropdownMenuSub: Passthrough,
    DropdownMenuSubContent: Passthrough,
    DropdownMenuSubTrigger: Passthrough,
    DropdownMenuTrigger: Passthrough,
    DropdownMenuItem: ({
      children,
      onClick,
      disabled,
    }: {
      children?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
  };
});

type WorkspaceLabel = {
  id: string;
  name: string;
  color: string;
};

const project: ProjectWithTasks = {
  id: "project-1",
  name: "Project",
  slug: "PROJ",
  icon: null,
  description: null,
  isPublic: false,
  workspaceId: "workspace-1",
  columns: [],
  plannedTasks: [],
  archivedTasks: [],
};

let bumpHarness = () => {};

function Harness({ workspaceLabels }: { workspaceLabels: WorkspaceLabel[] }) {
  committed.current = searchRef.current;
  const [, setTick] = useState(0);
  bumpHarness = () => setTick((n) => n + 1);
  const {
    filters,
    updateFilter,
    updateLabelFilter,
    hasActiveFilters,
    clearFilters,
  } = useTaskFiltersWithLabelsSupport(project, "project-1");

  return (
    <BoardToolbar
      project={project}
      filters={filters}
      updateFilter={updateFilter}
      updateLabelFilter={updateLabelFilter}
      clearFilters={clearFilters}
      hasActiveFilters={hasActiveFilters}
      workspaceLabels={workspaceLabels}
      viewMode="board"
      setViewMode={() => {}}
      sort={{ field: "position", direction: "asc" }}
      onSortChange={() => {}}
    />
  );
}

describe("BoardToolbar", () => {
  const sampleWorkspaceLabels: WorkspaceLabel[] = [
    { id: "l1", name: "Bug", color: "red" },
    { id: "l2", name: "Bug", color: "red" },
    { id: "l3", name: "Bug", color: "red" },
    { id: "other", name: "Feature", color: "blue" },
  ];

  beforeEach(() => {
    searchRef.current = {};
    committed.current = {};
    navigateSpy.mockReset();
    navigateSpy.mockImplementation((opts: { search: unknown }) => {
      if (typeof opts.search === "function") {
        searchRef.current = (
          opts.search as (p: Record<string, unknown>) => Record<string, unknown>
        )(committed.current);
      }
      bumpHarness();
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("toggling a colour group in one tick selects every label in the group", () => {
    render(<Harness workspaceLabels={sampleWorkspaceLabels} />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Bug/ }));
    });

    expect(searchRef.current.labels).toBe("l1,l2,l3");
    expect(decodeFilterValue(searchRef.current.labels)).toHaveLength(3);
    expect(navigateSpy).toHaveBeenCalledTimes(1);
  });

  it("toggling a selected colour group removes every label in the group", () => {
    searchRef.current = { labels: "l1,l2,l3,other" };
    render(<Harness workspaceLabels={sampleWorkspaceLabels} />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Bug/ }));
    });

    expect(searchRef.current.labels).toBe("other");
  });

  it("clearing labels removes the key entirely", () => {
    searchRef.current = { labels: "l1,l2" };
    render(<Harness workspaceLabels={sampleWorkspaceLabels} />);

    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: /tasks:boardFilters\.allLabels/ }),
      );
    });

    expect(searchRef.current.labels).toBeUndefined();
  });

  it("clearing labels when none are selected does not navigate", () => {
    render(<Harness workspaceLabels={sampleWorkspaceLabels} />);

    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: /tasks:boardFilters\.allLabels/ }),
      );
    });

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("a label toggle preserves taskId and other filters", () => {
    searchRef.current = { taskId: "task-9", status: "to-do" };
    render(<Harness workspaceLabels={sampleWorkspaceLabels} />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Bug/ }));
    });

    expect(searchRef.current.taskId).toBe("task-9");
    expect(searchRef.current.status).toBe("to-do");
    expect(searchRef.current.labels).toBe("l1,l2,l3");
  });

  it("clearing all filters resets all filter keys to undefined while preserving taskId", () => {
    searchRef.current = {
      status: "to-do",
      priority: "high",
      assignee: "u1",
      dueDate: "due-this-week",
      labels: "l1,l2",
      taskId: "task-9",
    };
    render(<Harness workspaceLabels={sampleWorkspaceLabels} />);

    act(() => {
      fireEvent.click(
        screen.getByRole("button", {
          name: /common:actions\.clearAllFilters/,
        }),
      );
    });

    expect(searchRef.current.status).toBeUndefined();
    expect(searchRef.current.priority).toBeUndefined();
    expect(searchRef.current.assignee).toBeUndefined();
    expect(searchRef.current.dueDate).toBeUndefined();
    expect(searchRef.current.labels).toBeUndefined();
    expect(searchRef.current.taskId).toBe("task-9");
    expect(navigateSpy).toHaveBeenCalledTimes(1);
  });
});

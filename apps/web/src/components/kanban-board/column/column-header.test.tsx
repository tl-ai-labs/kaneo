import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import { ColumnHeader } from "./column-header";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// `t` echoes the key and its interpolation options so both are assertable.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}::${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: () => true,
    canCreateTasks: () => true,
  }),
}));

vi.mock("@/lib/column", () => ({ getColumnIcon: () => null }));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/store/project", () => ({
  default: () => ({ project: { id: "project-1" }, setProject: vi.fn() }),
}));

vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));

vi.mock("../../shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: () => null,
}));

type BoardColumn = ProjectWithTasks["columns"][number];
type BoardTask = BoardColumn["tasks"][number];

function makeColumn(taskCount: number, wipLimit: number | null): BoardColumn {
  return {
    id: "todo",
    slug: "todo",
    name: "To Do",
    icon: "circle",
    isFinal: false,
    wipLimit,
    tasks: Array.from(
      { length: taskCount },
      (_, index) => ({ id: `task-${index}` }) as BoardTask,
    ),
  };
}

function badgeOf(container: HTMLElement) {
  return container.querySelector('[role="img"]');
}

describe("ColumnHeader WIP limit badge", () => {
  // Byte-identity guarantee: a column that never sets a limit must render
  // exactly as it did before the feature existed.
  it("renders a bare count with no role and no icon when there is no limit", () => {
    const { container } = render(<ColumnHeader column={makeColumn(3, null)} />);

    const badge = screen.getByText("3");
    expect(badge).toBeInTheDocument();
    expect(badgeOf(container)).toBeNull();
    // A bare aria-label with no role is the exact invalid-ARIA defect this
    // decision exists to prevent, so assert its absence directly rather than
    // only the absence of role="img".
    expect(badge.getAttribute("aria-label")).toBeNull();
    expect(badge.getAttribute("role")).toBeNull();
    // Pin the class string: "byte-identical" must survive a restyle too.
    expect(badge.className).toBe(
      "rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
    );
    expect(badge.querySelector("svg")).toBeNull();
  });

  it("renders count / limit in the neutral style when under the limit", () => {
    const { container } = render(<ColumnHeader column={makeColumn(2, 5)} />);

    const badge = badgeOf(container);
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("2 / 5");
    expect(badge?.className).not.toMatch(/destructive/);
    expect(badge?.querySelector("svg")).toBeNull();
  });

  // The indicator appears only when the count strictly exceeds the limit;
  // being exactly at the limit is not a violation.
  it("shows no over-cap indicator when the count is exactly at the limit", () => {
    const { container } = render(<ColumnHeader column={makeColumn(5, 5)} />);

    const badge = badgeOf(container);
    expect(badge).toHaveTextContent("5 / 5");
    expect(badge?.className).not.toMatch(/destructive/);
    expect(badge?.querySelector("svg")).toBeNull();
  });

  it("shows the destructive style and an icon when over the limit", () => {
    const { container } = render(<ColumnHeader column={makeColumn(6, 5)} />);

    const badge = badgeOf(container);
    expect(badge).toHaveTextContent("6 / 5");
    expect(badge?.className).toMatch(/destructive/);

    const icon = badge?.querySelector("svg");
    expect(icon).not.toBeNull();
    // Colour is never the only signal, and the icon is hidden from assistive
    // tech because the badge's own label already states the condition.
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("labels the over-cap badge with current and limit, never count", () => {
    const { container } = render(<ColumnHeader column={makeColumn(6, 5)} />);

    const [key, rawOpts] = (
      badgeOf(container)?.getAttribute("aria-label") ?? ""
    ).split("::");

    expect(key).toBe("tasks:kanban.wipLimitBadgeOverAria");
    // {{count}} would engage i18next's plural machinery, which this repo drives
    // off that exact option name elsewhere.
    expect(JSON.parse(rawOpts)).toEqual({ current: 6, limit: 5 });
  });

  it("labels the under-cap badge with current and limit, never count", () => {
    const { container } = render(<ColumnHeader column={makeColumn(2, 5)} />);

    const [key, rawOpts] = (
      badgeOf(container)?.getAttribute("aria-label") ?? ""
    ).split("::");

    expect(key).toBe("tasks:kanban.wipLimitBadgeAria");
    expect(JSON.parse(rawOpts)).toEqual({ current: 2, limit: 5 });
  });

  // Advisory only: nothing about being over the limit disables task creation.
  it("keeps the add-task control enabled when over the limit", () => {
    render(<ColumnHeader column={makeColumn(6, 5)} />);

    const addButton = screen.getByTitle("tasks:kanban.addTask");
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeEnabled();
  });
});

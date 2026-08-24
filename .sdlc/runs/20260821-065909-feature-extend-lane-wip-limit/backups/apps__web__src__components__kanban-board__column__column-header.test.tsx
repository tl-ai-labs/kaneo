import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColumnHeader } from "./column-header";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("@/store/project", () => ({
  default: () => ({ project: { id: "project-1" }, setProject: vi.fn() }),
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

vi.mock("@/lib/column", () => ({
  getColumnIcon: () => null,
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));

vi.mock("../../shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: () => null,
}));

const makeColumn = (count: number, wipLimit: number | null) => ({
  id: "to-do",
  slug: "to-do",
  name: "To do",
  icon: null,
  isFinal: false,
  wipLimit,
  tasks: Array.from({ length: count }, (_, i) => ({ id: `task-${i}` })),
});

type HeaderColumn = ComponentProps<typeof ColumnHeader>["column"];

describe("ColumnHeader task-count badge", () => {
  it("renders the raw count and count-only aria-label when no WIP limit is set", () => {
    render(
      <ColumnHeader column={makeColumn(4, null) as unknown as HeaderColumn} />,
    );

    const badge = screen.getByLabelText("tasks:kanban.taskCountAria");
    expect(badge.textContent).toBe("4");
    expect(badge.querySelector("svg")).toBeNull();
    expect(badge.className).not.toContain("text-destructive");
    expect(badge.getAttribute("title")).toBeNull();
  });

  it("renders count / limit with the within-limit title when under cap", () => {
    const { container } = render(
      <ColumnHeader column={makeColumn(3, 5) as unknown as HeaderColumn} />,
    );

    const badge = screen.getByLabelText("tasks:kanban.wipLimitAria");
    expect(badge.textContent).toBe("3 / 5");
    expect(badge.getAttribute("title")).toBe("tasks:kanban.wipLimitWithin");
    expect(badge.querySelector("svg")).toBeNull();
    expect(badge.className).not.toContain("text-destructive");
    expect(
      container.querySelector('[aria-label="tasks:kanban.wipLimitAria"]'),
    ).toBe(badge);
  });

  it("renders the over-limit title, destructive styling, and alert icon when over cap", () => {
    render(
      <ColumnHeader column={makeColumn(6, 5) as unknown as HeaderColumn} />,
    );

    const badge = screen.getByLabelText("tasks:kanban.wipLimitAria");
    expect(badge.textContent).toBe("6 / 5");
    expect(badge.getAttribute("title")).toBe("tasks:kanban.wipLimitOver");
    expect(badge.querySelector("svg")).not.toBeNull();
    expect(badge.className).toContain("text-destructive");
  });

  it("treats exactly-at-limit as within, not over", () => {
    render(
      <ColumnHeader column={makeColumn(5, 5) as unknown as HeaderColumn} />,
    );

    const badge = screen.getByLabelText("tasks:kanban.wipLimitAria");
    expect(badge.textContent).toBe("5 / 5");
    expect(badge.getAttribute("title")).toBe("tasks:kanban.wipLimitWithin");
    expect(badge.querySelector("svg")).toBeNull();
    expect(badge.className).not.toContain("text-destructive");
  });
});

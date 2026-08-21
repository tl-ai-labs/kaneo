import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import { ColumnHeader } from "./column-header";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock("@/hooks/mutations/column/use-update-column", () => ({
  useUpdateColumn: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: () => true,
    canCreateTasks: () => true,
    canUpdateProjects: () => true,
  }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({
    project: { id: "project-1" },
    setProject: vi.fn(),
  }),
}));

vi.mock("@/lib/column", () => ({
  getColumnIcon: () => null,
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));

vi.mock("../../shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: () => null,
}));

function createColumn(
  wipLimit: number | null,
  taskCount: number,
): ProjectWithTasks["columns"][number] {
  return {
    id: "in-progress",
    columnId: "col-uuid-1",
    slug: "in-progress",
    name: "In Progress",
    icon: null,
    isFinal: false,
    wipLimit,
    tasks: Array.from({ length: taskCount }, (_, i) => ({ id: `task-${i}` })),
  } as unknown as ProjectWithTasks["columns"][number];
}

describe("ColumnHeader", () => {
  it("AC-6: displays exact task count without '/' when wipLimit is null", () => {
    render(<ColumnHeader column={createColumn(null, 3)} />);
    const badge = screen.getByText("3");
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe("3");
    expect(badge.textContent).not.toContain("/");
  });

  it("AC-7: displays count/limit and does not include text-destructive when within wipLimit", () => {
    render(<ColumnHeader column={createColumn(5, 3)} />);
    const badge = screen.getByText("3/5");
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe("3/5");
    expect(badge.className).not.toContain("text-destructive");
  });

  it("AC-8: displays count/limit and includes text-destructive when exceeding wipLimit", () => {
    render(<ColumnHeader column={createColumn(5, 6)} />);
    const badge = screen.getByText("6/5");
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe("6/5");
    expect(badge.className).toContain("text-destructive");
  });
});

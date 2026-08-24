import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { ColumnHeader } from "./column-header";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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

vi.mock("@/store/project", () => ({
  default: () => ({ project: null, setProject: vi.fn() }),
}));

vi.mock("@/lib/column", () => ({
  getColumnIcon: () => null,
}));

vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));

vi.mock("../../shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: () => null,
}));

function makeColumn(
  hours: Array<number | null>,
): ProjectWithTasks["columns"][number] {
  const tasks: Task[] = hours.map((estimatedHours, index) => ({
    id: `task-${index + 1}`,
    title: `Task ${index + 1}`,
    number: index + 1,
    description: null,
    status: "to-do",
    priority: null,
    startDate: null,
    dueDate: null,
    position: index + 1,
    createdAt: "2026-07-17T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
    estimatedHours,
  }));

  return {
    id: "to-do",
    slug: "to-do",
    name: "To do",
    icon: null,
    isFinal: false,
    tasks,
  } as ProjectWithTasks["columns"][number];
}

describe("ColumnHeader rollup pill", () => {
  // react-i18next is mocked so `t` echoes the key: the visible text is just the
  // key string. State is therefore asserted via data-estimate-state, and the
  // accessible name only via aria-label presence. The formatted English strings
  // and plural selection are proved separately, against a real i18next
  // instance, in components/task/estimated-hours-i18n.test.ts.

  it("renders data-estimate-state='none' when no task has an estimate", () => {
    const { container } = render(
      <ColumnHeader column={makeColumn([null, null])} />,
    );

    const pill = container.querySelector("[data-estimate-state]");
    expect(pill).not.toBeNull();
    expect(pill?.getAttribute("data-estimate-state")).toBe("none");
    expect(pill?.getAttribute("aria-label")).toBeTruthy();
  });

  it("renders data-estimate-state='partial' when only some tasks have estimates", () => {
    const { container } = render(
      <ColumnHeader column={makeColumn([8, null, 0, 4])} />,
    );

    const pill = container.querySelector("[data-estimate-state]");
    expect(pill).not.toBeNull();
    expect(pill?.getAttribute("data-estimate-state")).toBe("partial");
    expect(pill?.getAttribute("aria-label")).toBeTruthy();
  });

  it("renders data-estimate-state='all' when every task has an estimate", () => {
    const { container } = render(<ColumnHeader column={makeColumn([3, 5])} />);

    const pill = container.querySelector("[data-estimate-state]");
    expect(pill).not.toBeNull();
    expect(pill?.getAttribute("data-estimate-state")).toBe("all");
    expect(pill?.getAttribute("aria-label")).toBeTruthy();
  });

  it("treats 0 as a real estimate: [0, null] is 'partial', not 'none'", () => {
    const { container } = render(
      <ColumnHeader column={makeColumn([0, null])} />,
    );

    const pill = container.querySelector("[data-estimate-state]");
    expect(pill?.getAttribute("data-estimate-state")).toBe("partial");
  });

  it("hides the rollup pill when the column has no tasks", () => {
    const { container } = render(<ColumnHeader column={makeColumn([])} />);

    expect(container.querySelector("[data-estimate-state]")).toBeNull();
  });

  it("leaves the existing count pill unchanged", () => {
    const { container } = render(
      <ColumnHeader column={makeColumn([4, null])} />,
    );

    const countPill = container.querySelector(
      "span.rounded-md.bg-muted:not([data-estimate-state])",
    );
    expect(countPill?.textContent).toBe("2");
  });
});

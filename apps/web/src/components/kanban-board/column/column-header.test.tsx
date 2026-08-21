import { resources } from "@i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
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

// The suite above mocks react-i18next so `t` echoes the key, which cannot catch
// a bad plural form. These cases drive a real i18next instance against the real
// en-US bundle instead. i18next treats `count` as a magic option and resolves
// `<key>_one` / `<key>_other`, so a base-only key would render "1 tasks".
describe("kanban WIP-limit i18n plural forms", () => {
  const t = (() => {
    const instance = createInstance();
    void instance.init({
      resources,
      lng: "en-US",
      fallbackLng: "en-US",
      ns: Object.keys(resources["en-US"]),
      defaultNS: "common",
      interpolation: { escapeValue: false },
    });
    return instance.t.bind(instance);
  })();

  it("renders the singular task count", () => {
    expect(t("tasks:kanban.taskCountAria", { count: 1 })).toBe("1 task");
  });

  it("renders the plural task count", () => {
    expect(t("tasks:kanban.taskCountAria", { count: 4 })).toBe("4 tasks");
  });

  it("renders zero as plural", () => {
    expect(t("tasks:kanban.taskCountAria", { count: 0 })).toBe("0 tasks");
  });

  it("keeps the limit strings stable for a count of one", () => {
    // The noun in these strings agrees with `limit`, not `count`, so the _one
    // and _other forms are intentionally identical — the same convention the
    // repo already uses for notifications.newCount.
    expect(t("tasks:kanban.wipLimitAria", { count: 1, limit: 5 })).toBe(
      "1 of 5 tasks (WIP limit)",
    );
    expect(t("tasks:kanban.wipLimitWithin", { count: 1, limit: 5 })).toBe(
      "1 of 5 - within WIP limit",
    );
    expect(t("tasks:kanban.wipLimitOver", { count: 6, limit: 5 })).toBe(
      "6 of 5 - over WIP limit",
    );
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import type { BoardFilters } from "@/hooks/use-task-filters";
import BoardFilterChips from "./board-filter-chips";

// Repo convention: stub react-i18next so t(key) === key. Interpolation values are appended
// so that each chip's remove button gets a distinguishable accessible name — with a bare
// t(key) every remove button would be called "tasks:boardFilters.removeFilter".
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? [key, ...Object.values(options)].join(" ") : key,
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

// @/lib/i18n/domain calls the GLOBAL i18next instance, not useTranslation, so the stub
// above does not cover it and the instance is uninitialised under Vitest.
vi.mock("@/lib/i18n/domain", () => ({
  getPriorityLabel: (priority: string) => priority,
}));

const DEFAULT_FILTERS: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
};

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
};

const users = {
  members: [
    { userId: "u1", user: { name: "Alice", image: null } },
    { userId: "u2", user: { name: "Bob", image: null } },
  ],
};

// "bug" exists as two rows (one visible label, two ids); "docs" as one.
const workspaceLabels = [
  { id: "l-bug-a", name: "bug", color: "red" },
  { id: "l-bug-b", name: "bug", color: "red" },
  { id: "l-docs", name: "docs", color: "green" },
];

type UpdateFilter = (
  key: keyof BoardFilters,
  value: BoardFilters[keyof BoardFilters],
) => void;

function renderChips(
  filters: Partial<BoardFilters>,
  overrides: Partial<{
    updateFilter: Mock<UpdateFilter>;
    clearFilters: Mock<() => void>;
    hasActiveFilters: boolean;
  }> = {},
) {
  const merged = { ...DEFAULT_FILTERS, ...filters };
  const updateFilter = overrides.updateFilter ?? vi.fn<UpdateFilter>();
  const clearFilters = overrides.clearFilters ?? vi.fn<() => void>();
  const hasActiveFilters =
    overrides.hasActiveFilters ??
    Object.values(merged).some((value) => value !== null);

  const result = render(
    <BoardFilterChips
      project={project}
      filters={merged}
      updateFilter={updateFilter}
      clearFilters={clearFilters}
      hasActiveFilters={hasActiveFilters}
      users={users}
      workspaceLabels={workspaceLabels}
    />,
  );

  return { ...result, updateFilter, clearFilters };
}

const removeButtons = () =>
  screen.getAllByRole("button", {
    name: /tasks:boardFilters\.removeFilter/,
  });

afterEach(() => {
  cleanup();
});

describe("BoardFilterChips", () => {
  it("renders one chip per assignee and one chip per label group", () => {
    renderChips({
      assignee: ["u1", "u2"],
      labels: ["l-bug-a", "l-docs"],
    });

    const names = removeButtons().map((button) =>
      button.getAttribute("aria-label"),
    );

    expect(names).toHaveLength(4);
    expect(names.join("|")).toContain("Alice");
    expect(names.join("|")).toContain("Bob");
    expect(names.join("|")).toContain("bug");
    expect(names.join("|")).toContain("docs");
  });

  it("renders status, priority and dueDate as single aggregate chips", () => {
    renderChips({
      status: ["todo"],
      priority: ["high", "low"],
      dueDate: ["dueThisWeek", "dueNextWeek"],
      assignee: ["u1"],
      labels: ["l-bug-a"],
    });

    const names = removeButtons().map(
      (button) => button.getAttribute("aria-label") ?? "",
    );

    // The three untouched subjects must NOT have been decomposed by the extraction.
    expect(
      names.filter((name) => name.includes("subjects.status")),
    ).toHaveLength(1);
    expect(
      names.filter((name) => name.includes("subjects.priority")),
    ).toHaveLength(1);
    expect(
      names.filter((name) => name.includes("subjects.dueDate")),
    ).toHaveLength(1);
  });

  it("renders a clear all control only when a filter is active", () => {
    const { unmount } = renderChips({ assignee: ["u1"] });
    expect(screen.getByText("common:actions.clearAllFilters")).toBeVisible();
    unmount();

    renderChips({}, { hasActiveFilters: false });
    expect(
      screen.queryByText("common:actions.clearAllFilters"),
    ).not.toBeInTheDocument();
  });

  it("calls clearFilters from the clear all control", () => {
    const { clearFilters } = renderChips({ assignee: ["u1"] });
    screen.getByText("common:actions.clearAllFilters").click();
    expect(clearFilters).toHaveBeenCalledTimes(1);
  });

  it("clears a subject to null, not an empty array, when its last value is removed", () => {
    const { updateFilter } = renderChips({ assignee: ["u1"] });

    removeButtons()[0].click();

    expect(updateFilter).toHaveBeenCalledTimes(1);
    expect(updateFilter).toHaveBeenCalledWith("assignee", null);
  });

  it("removes one of several assignees and keeps the others, in a single commit", () => {
    const { updateFilter } = renderChips({ assignee: ["u1", "u2"] });

    const alice = removeButtons().find((button) =>
      button.getAttribute("aria-label")?.includes("Alice"),
    );
    alice?.click();

    expect(updateFilter).toHaveBeenCalledTimes(1);
    expect(updateFilter).toHaveBeenCalledWith("assignee", ["u2"]);
  });

  it("removes every id in a label group in a single commit", () => {
    const { updateFilter } = renderChips({
      labels: ["l-bug-a", "l-bug-b", "l-docs"],
    });

    const bug = removeButtons().find((button) =>
      button.getAttribute("aria-label")?.includes("bug"),
    );
    bug?.click();

    expect(updateFilter).toHaveBeenCalledTimes(1);
    expect(updateFilter).toHaveBeenCalledWith("labels", ["l-docs"]);
  });

  it("ignores selected label ids that resolve to no workspace label", () => {
    render(
      <BoardFilterChips
        project={project}
        filters={{ ...DEFAULT_FILTERS, labels: ["ghost"] }}
        updateFilter={vi.fn()}
        clearFilters={vi.fn()}
        hasActiveFilters
        users={users}
        workspaceLabels={[]}
      />,
    );

    // No chip for an unresolvable label, but clear-all remains as an escape hatch.
    expect(
      screen.queryAllByRole("button", {
        name: /tasks:boardFilters\.removeFilter/,
      }),
    ).toHaveLength(0);
    expect(screen.getByText("common:actions.clearAllFilters")).toBeVisible();
  });

  it("falls back to the unknown-person copy for an unresolvable assignee", () => {
    render(
      <BoardFilterChips
        project={project}
        filters={{ ...DEFAULT_FILTERS, assignee: ["ghost"] }}
        updateFilter={vi.fn()}
        clearFilters={vi.fn()}
        hasActiveFilters
        users={{ members: [] }}
        workspaceLabels={workspaceLabels}
      />,
    );

    expect(screen.getByText("common:people.unknown")).toBeVisible();
  });

  it("renders nothing when no filter is active", () => {
    const { container } = renderChips({}, { hasActiveFilters: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes every control as a focusable button element", () => {
    renderChips({
      status: ["todo"],
      assignee: ["u1"],
      labels: ["l-bug-a"],
    });

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
    }
  });

  it("clears the label subject to null, not an empty array, when its last group goes", () => {
    const { updateFilter } = renderChips({ labels: ["l-bug-a", "l-bug-b"] });

    removeButtons()[0].click();

    expect(updateFilter).toHaveBeenCalledTimes(1);
    expect(updateFilter).toHaveBeenCalledWith("labels", null);
  });

  // Deliberately a source assertion, not a render assertion. With t() stubbed to the
  // identity the component CANNOT render English, so any DOM-level check of that would
  // pass no matter what the source said. Reading the source is what can actually fail.
  it("routes every user-facing string through a static i18n key", () => {
    // Vitest's import.meta.url is not a file: URL here; resolve from the Vite root
    // (apps/web), which is where the runner is rooted.
    const source = readFileSync(
      resolve("src/components/board/board-filter-chips.tsx"),
      "utf8",
    );

    // Bare string literals inside JSX text positions, e.g. >Clear all<
    expect(source).not.toMatch(/>\s*[A-Z][a-z]+ [a-z]/);
    // aria-label / title / placeholder assigned a literal instead of a t() call
    expect(source).not.toMatch(/(aria-label|title|placeholder)="[^"]+"/);

    for (const key of [
      "tasks:boardFilters.removeFilter",
      "common:actions.clearAllFilters",
      "common:people.unknown",
    ]) {
      expect(source).toContain(key);
    }
  });
});

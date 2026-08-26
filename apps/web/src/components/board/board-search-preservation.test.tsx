/**
 * AC-7 search-preservation regression guard.
 *
 * Tier 1 is a behavioural test of TaskCard's two navigate() sites: it captures
 * the options object handed to navigate() and invokes its `search` reducer
 * against a seeded previous search, so a site that replaced the whole search
 * object cannot satisfy it.
 *
 * Tier 2 is a SOURCE-TEXT (lint-shaped) compensating control, NOT a behavioural
 * test, and is deliberately not presented as one. It exists because this run's
 * write contract allowlists kanban-board/index.tsx, kanban-board/task-card.tsx
 * and list-view/index.tsx as individual files rather than directory globs, so
 * there is no legal path for a test colocated beside them. Asserting on their
 * source text is the strongest guard available under that constraint; it will
 * catch a reverted call site but tells you nothing about runtime behaviour.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import TaskCard from "../kanban-board/task-card";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => "",
    },
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("@/store/project", () => ({
  default: () => ({
    project: {
      id: "project-1",
      slug: "kan",
      columns: [],
    },
  }),
}));

vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => ({
    showAssignees: true,
    showPriority: true,
    showDueDates: true,
    showLabels: true,
    showTaskNumbers: true,
  }),
}));

vi.mock("@/store/bulk-selection", () => ({
  default: () => ({
    toggleSelection: vi.fn(),
    isSelected: () => false,
    isFocused: () => false,
  }),
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1" } }),
}));

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);

vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/query-client", () => ({
  default: { invalidateQueries: vi.fn() },
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock(
  "../kanban-board/task-card-context-menu/task-card-context-menu-content",
  () => ({ default: () => null }),
);

const task: Task = {
  id: "task-1",
  title: "Card from payload",
  number: 7,
  status: "to-do",
  priority: null,
  startDate: null,
  dueDate: null,
  position: 1,
  createdAt: "2026-08-05T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
  description: null,
  labels: [],
  externalLinks: [],
};

describe("tier 1 - behavioural (TaskCard)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("preserves existing search params when opening a task", () => {
    render(<TaskCard task={task} />);
    fireEvent.click(screen.getByText("Card from payload"));

    const options = navigateMock.mock.calls[0][0];
    expect(typeof options.search).toBe("function");
    expect(options.search({ status: ["todo"], taskId: undefined })).toEqual({
      status: ["todo"],
      taskId: "task-1",
    });
  });

  it("preserves existing search params when closing a task", () => {
    window.history.replaceState({}, "", "/?taskId=task-1");
    render(<TaskCard task={task} />);
    fireEvent.click(screen.getByText("Card from payload"));
    window.history.replaceState({}, "", "/");

    const options = navigateMock.mock.calls[0][0];
    expect(typeof options.search).toBe("function");
    expect(options.search({ status: ["todo"], taskId: "task-1" })).toEqual({
      status: ["todo"],
      taskId: undefined,
    });
  });
});

// Do not reintroduce `new URL(..., import.meta.url)` here: under Vitest's Vite
// transform import.meta.url is an http:// URL, not file://, so readFileSync
// throws "The URL must be of scheme file" before any test runs. Vitest's root
// is apps/web, so process.cwd() is the right anchor.
const readSource = (relativeToSrc: string) =>
  readFileSync(resolve(process.cwd(), "src", relativeToSrc), "utf8");

const sources = {
  "kanban-board/index.tsx": readSource("components/kanban-board/index.tsx"),
  "kanban-board/task-card.tsx": readSource(
    "components/kanban-board/task-card.tsx",
  ),
  "list-view/index.tsx": readSource("components/list-view/index.tsx"),
  "list-view/task-row.tsx": readSource("components/list-view/task-row.tsx"),
  "board.tsx": readSource(
    "routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx",
  ),
};

describe("tier 2 - source text (lint-shaped compensating control)", () => {
  it.each(Object.entries(sources))(
    "contains no whole-search-object literal in %s",
    (_filename, source) => {
      expect(source).not.toMatch(/search:\s*\{/);
    },
  );

  it("has exactly 10 reducer-form search navigations across the five files", () => {
    // The original brief undercounted the pre-existing sites as six. Nine were
    // converted; board.tsx carries a tenth for the new filter-publish
    // navigation added by this change.
    const total = Object.values(sources).reduce((acc, source) => {
      return acc + (source.match(/search:\s*\(prev/g)?.length ?? 0);
    }, 0);
    expect(total).toBe(10);
  });

  it.each(Object.entries(sources))(
    "has exactly 2 reducer-form search navigations in %s",
    (_filename, source) => {
      expect(source.match(/search:\s*\(prev/g)?.length ?? 0).toBe(2);
    },
  );

  it("keeps both board.tsx navigations on replace, not push", () => {
    const matches = sources["board.tsx"].match(/replace:\s*true/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

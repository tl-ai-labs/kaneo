import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardFilters } from "./use-task-filters";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

describe("useTaskFiltersWithLabelsSupport", () => {
  const storageKey = "kaneo:board-filters:project-1";

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("restores persisted label filters from storage and matches tasks from project data", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-bug"] }),
    );

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
          tasks: [
            {
              id: "task-1",
              title: "Bug task",
              number: 1,
              description: null,
              status: "todo",
              priority: null,
              startDate: null,
              dueDate: null,
              position: 0,
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
              userId: null,
              assigneeId: null,
              assigneeName: null,
              assigneeImage: null,
              projectId: "project-1",
              labels: [
                {
                  id: "label-bug",
                  name: "bug",
                  color: "red",
                },
              ],
              externalLinks: [],
            },
            {
              id: "task-2",
              title: "Other task",
              number: 2,
              description: null,
              status: "todo",
              priority: null,
              startDate: null,
              dueDate: null,
              position: 1,
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
              userId: null,
              assigneeId: null,
              assigneeName: null,
              assigneeImage: null,
              projectId: "project-1",
              labels: [],
              externalLinks: [],
            },
          ],
        },
      ],
      plannedTasks: [],
      archivedTasks: [],
    };

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1"),
    );

    await waitFor(() => {
      expect(result.current.filters.labels).toEqual(["label-bug"]);
    });

    expect(result.current.filteredProject?.columns[0]?.tasks).toHaveLength(1);
    expect(result.current.filteredProject?.columns[0]?.tasks[0]?.id).toBe(
      "task-1",
    );
  });

  it.each(["#123", "proj-123", "proj-"])(
    "matches a task by its issue identifier when searching for %s",
    (textQuery) => {
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
            tasks: [
              {
                id: "task-123",
                title: "Unrelated title",
                number: 123,
                description: null,
                status: "todo",
                priority: null,
                startDate: null,
                dueDate: null,
                position: 0,
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
                userId: null,
                assigneeId: null,
                assigneeName: null,
                assigneeImage: null,
                projectId: "project-1",
                labels: [],
                externalLinks: [],
              },
              {
                id: "task-without-number",
                title: "Another unrelated title",
                number: null,
                description: null,
                status: "todo",
                priority: null,
                startDate: null,
                dueDate: null,
                position: 1,
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
                userId: null,
                assigneeId: null,
                assigneeName: null,
                assigneeImage: null,
                projectId: "project-1",
                labels: [],
                externalLinks: [],
              },
            ],
          },
        ],
        plannedTasks: [],
        archivedTasks: [],
      };

      const { result } = renderHook(() =>
        useTaskFiltersWithLabelsSupport(project, "project-1", textQuery),
      );

      expect(result.current.filteredProject?.columns[0]?.tasks).toEqual([
        expect.objectContaining({ id: "task-123" }),
      ]);
    },
  );
});

describe("useTaskFiltersWithLabelsSupport url seeding", () => {
  const storageKey = "kaneo:board-filters:project-1";

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  const allNull = (): BoardFilters => ({
    status: null,
    priority: null,
    assignee: null,
    dueDate: null,
    labels: null,
  });

  const makeProject = () => ({
    id: "project-1",
    name: "Project",
    slug: "PROJ",
    icon: null,
    description: null,
    isPublic: false,
    createdAt: "2026-04-16T00:00:00.000Z",
    updatedAt: "2026-04-16T00:00:00.000Z",
    workspaceId: "workspace-1",
    columns: [],
    plannedTasks: [],
    archivedTasks: [],
  });

  it("lets URL-seeded filters win over stored filters", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-stored"] }),
    );

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(makeProject(), "project-1", undefined, {
        initialFilters: { ...allNull(), status: ["todo"] },
      }),
    );

    expect(result.current.filters.status).toEqual(["todo"]);
    expect(result.current.filters.labels).toBeNull();

    await waitFor(() => {
      expect(result.current.filters.status).toEqual(["todo"]);
    });
    // Still null after the restore effect would have run: a late restore that
    // clobbered the URL seed would surface here.
    expect(result.current.filters.labels).toBeNull();
  });

  it("writes URL-seeded filters back to localStorage", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-stored"] }),
    );

    renderHook(() =>
      useTaskFiltersWithLabelsSupport(makeProject(), "project-1", undefined, {
        initialFilters: { ...allNull(), status: ["todo"] },
      }),
    );

    await waitFor(() => {
      expect(
        JSON.parse(window.localStorage.getItem(storageKey) ?? "null"),
      ).toEqual({ ...allNull(), status: ["todo"] });
    });
  });

  it("restores stored filters when there is no URL seed", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-bug"] }),
    );

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(makeProject(), "project-1", undefined, {
        initialFilters: null,
      }),
    );

    await waitFor(() => {
      expect(result.current.filters.labels).toEqual(["label-bug"]);
    });
  });

  it("publishes filter changes to onFiltersChange", () => {
    const onFiltersChange = vi.fn();
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(makeProject(), "project-1", undefined, {
        onFiltersChange,
      }),
    );

    act(() => {
      result.current.updateFilter("status", ["todo"]);
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith({
      ...allNull(),
      status: ["todo"],
    });
  });

  it("publishes an all-null object when filters are cleared", () => {
    const onFiltersChange = vi.fn();
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(makeProject(), "project-1", undefined, {
        initialFilters: { ...allNull(), status: ["todo"] },
        onFiltersChange,
      }),
    );

    act(() => {
      result.current.clearFilters();
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(allNull());
  });

  it("does not republish when only the callback identity changes", () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) =>
        useTaskFiltersWithLabelsSupport(makeProject(), "project-1", undefined, {
          onFiltersChange: cb,
        }),
      { initialProps: { cb: first } },
    );

    rerender({ cb: second });

    expect(second).not.toHaveBeenCalled();
  });
});

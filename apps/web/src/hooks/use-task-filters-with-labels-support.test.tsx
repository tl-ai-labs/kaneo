import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseBoardFilterSearch,
  searchCarriesBoardFilters,
} from "@/lib/board-filter-search-params";
import type { BoardFilters } from "./use-task-filters";
import type { BoardFilterUrlState } from "./use-task-filters-with-labels-support";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

function createProjectFixture() {
  return {
    id: "project-1",
    name: "Project 1",
    slug: "project-1",
    icon: "folder",
    description: "",
    isPublic: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    workspaceId: "workspace-1",
    columns: [
      {
        id: "column-1",
        slug: "todo",
        name: "Todo",
        icon: "circle",
        isFinal: false,
        tasks: [
          {
            id: "task-1",
            title: "Task 1",
            number: 1,
            description: "",
            status: "todo",
            priority: "low",
            startDate: null,
            dueDate: null,
            position: 0,
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
            userId: "user-1",
            assigneeId: null,
            assigneeName: null,
            assigneeImage: null,
            projectId: "project-1",
            labels: [{ id: "label-bug", name: "Bug", color: "red" }],
            externalLinks: [],
          },
        ],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
  };
}

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

  it("applies URL filters over stored filters and writes them back to storage", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-bug"] }),
    );
    const urlState: BoardFilterUrlState = {
      filters: parseBoardFilterSearch({ status: "todo" }),
      carriesFilters: true,
    };
    const project = createProjectFixture();
    const renders: BoardFilters[] = [];
    renderHook(() => {
      const r = useTaskFiltersWithLabelsSupport(
        project,
        "project-1",
        undefined,
        urlState,
      );
      renders.push(r.filters);
      return r;
    });
    expect(renders[0]).toEqual({
      status: ["todo"],
      priority: null,
      assignee: null,
      dueDate: null,
      labels: null,
    });
    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(storageKey) ?? "{}",
      );
      expect(stored.status).toEqual(["todo"]);
      expect(stored.labels).toBeNull();
    });
  });

  it("never commits the default filter set before URL or storage is resolved", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-bug"] }),
    );
    const project = createProjectFixture();
    const renders: BoardFilters[] = [];
    renderHook(() => {
      const r = useTaskFiltersWithLabelsSupport(project, "project-1");
      renders.push(r.filters);
      return r;
    });
    expect(renders[0].labels).toEqual(["label-bug"]);
    expect(renders.every((f) => f.labels !== null)).toBe(true);
  });

  it("restores stored filters when the URL carries only an empty facet", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-bug"] }),
    );
    const rawSearch = { status: "" };
    const urlState: BoardFilterUrlState = {
      filters: parseBoardFilterSearch(rawSearch),
      carriesFilters: searchCarriesBoardFilters(rawSearch),
    };
    const project = createProjectFixture();
    const renders: BoardFilters[] = [];
    renderHook(() => {
      const r = useTaskFiltersWithLabelsSupport(
        project,
        "project-1",
        undefined,
        urlState,
      );
      renders.push(r.filters);
      return r;
    });
    expect(renders[0].labels).toEqual(["label-bug"]);
  });

  it("adopts new URL filters after mount when the search changes", () => {
    const project = createProjectFixture();
    const initialUrlState: BoardFilterUrlState = {
      filters: parseBoardFilterSearch({ status: "todo" }),
      carriesFilters: true,
    };
    const { result, rerender } = renderHook(
      ({ urlState }: { urlState: BoardFilterUrlState }) =>
        useTaskFiltersWithLabelsSupport(
          project,
          "project-1",
          undefined,
          urlState,
        ),
      { initialProps: { urlState: initialUrlState } },
    );
    expect(result.current.filters.status).toEqual(["todo"]);
    const nextUrlState: BoardFilterUrlState = {
      filters: parseBoardFilterSearch({ status: "done" }),
      carriesFilters: true,
    };
    rerender({ urlState: nextUrlState });
    expect(result.current.filters.status).toEqual(["done"]);
  });

  it("keeps filter state across a project data re-render", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-bug"] }),
    );
    const projectA = createProjectFixture();
    const { result, rerender } = renderHook(
      ({ project }: { project: ReturnType<typeof createProjectFixture> }) =>
        useTaskFiltersWithLabelsSupport(project, "project-1"),
      { initialProps: { project: projectA } },
    );
    const filtersBefore = result.current.filters;
    const projectB = createProjectFixture();
    rerender({ project: projectB });
    expect(result.current.filters).toEqual(filtersBefore);
  });
});

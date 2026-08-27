import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("useTaskFiltersWithLabelsSupport — controlled mode", () => {
  const storageKey = "kaneo:board-filters:project-1";

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  function makeProject(
    tasks: Array<{ id: string; userId: string | null; labelId?: string }>,
  ) {
    return {
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
          tasks: tasks.map((task, index) => ({
            id: task.id,
            title: task.id,
            number: index + 1,
            description: null,
            status: "todo",
            priority: null,
            startDate: null,
            dueDate: null,
            position: index,
            createdAt: "2026-04-16T00:00:00.000Z",
            updatedAt: "2026-04-16T00:00:00.000Z",
            userId: task.userId,
            assigneeId: null,
            assigneeName: null,
            assigneeImage: null,
            projectId: "project-1",
            labels: task.labelId
              ? [{ id: task.labelId, name: "bug", color: "red" }]
              : [],
            externalLinks: [],
          })),
        },
      ],
      plannedTasks: [],
      archivedTasks: [],
    };
  }

  it("applies controlled filters on the first committed render, with no unfiltered frame", async () => {
    // Storage holds a DIFFERENT assignee. If storage were allowed to win, or if the
    // controlled value were applied by an effect, one of these renders would show 2.
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ assignee: ["user-b"] }),
    );

    const project = makeProject([
      { id: "task-a", userId: "user-a" },
      { id: "task-b", userId: "user-b" },
    ]);
    const renders: number[] = [];
    const controlled = { assignee: ["user-a"], labels: null };

    function Probe() {
      const { filteredProject } = useTaskFiltersWithLabelsSupport(
        project,
        "project-1",
        undefined,
        { controlled },
      );
      renders.push(filteredProject?.columns[0]?.tasks.length ?? -1);
      return null;
    }

    render(<Probe />);

    await waitFor(() => expect(renders.length).toBeGreaterThan(0));

    expect(renders[0]).toBe(1);
    expect(renders.every((count) => count === 1)).toBe(true);
  });

  it("never lets stored values override controlled values", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ assignee: ["user-b"] }),
    );

    const project = makeProject([
      { id: "task-a", userId: "user-a" },
      { id: "task-b", userId: "user-b" },
    ]);
    const controlled = { assignee: ["user-a"], labels: null };

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1", undefined, {
        controlled,
      }),
    );

    await waitFor(() => {
      expect(
        JSON.parse(window.localStorage.getItem(storageKey) as string).assignee,
      ).toEqual(["user-a"]);
    });

    expect(result.current.filters.assignee).toEqual(["user-a"]);
    expect(result.current.filteredProject?.columns[0]?.tasks).toHaveLength(1);
  });

  it("routes assignee changes through onControlledChange instead of self-applying", async () => {
    const project = makeProject([{ id: "task-a", userId: "user-a" }]);
    const onControlledChange = vi.fn();
    const controlled = { assignee: null, labels: null };

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1", undefined, {
        controlled,
        onControlledChange,
      }),
    );

    act(() => {
      result.current.updateFilter("assignee", ["user-a"]);
    });

    expect(onControlledChange).toHaveBeenCalledTimes(1);
    expect(onControlledChange).toHaveBeenCalledWith({
      assignee: ["user-a"],
      labels: null,
    });
    // The hook did not self-apply: the owner is responsible for feeding the value back.
    expect(result.current.filters.assignee).toBeNull();
  });

  it("routes label changes through onControlledChange", async () => {
    const project = makeProject([{ id: "task-a", userId: null }]);
    const onControlledChange = vi.fn();
    const controlled = { assignee: null, labels: null };

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1", undefined, {
        controlled,
        onControlledChange,
      }),
    );

    act(() => {
      result.current.updateLabelFilter("label-bug");
    });

    expect(onControlledChange).toHaveBeenCalledTimes(1);
    expect(onControlledChange).toHaveBeenCalledWith({
      assignee: null,
      labels: ["label-bug"],
    });
  });

  it("keeps status, priority and dueDate in internal state while controlled", async () => {
    const project = makeProject([{ id: "task-a", userId: null }]);
    const onControlledChange = vi.fn();
    const controlled = { assignee: null, labels: null };

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1", undefined, {
        controlled,
        onControlledChange,
      }),
    );

    act(() => {
      result.current.updateFilter("status", ["todo"]);
    });

    await waitFor(() => {
      expect(result.current.filters.status).toEqual(["todo"]);
    });
    expect(onControlledChange).not.toHaveBeenCalled();
  });

  it("does not notify the owner when a commit leaves both controlled keys unchanged", async () => {
    const project = makeProject([{ id: "task-a", userId: "user-a" }]);
    const onControlledChange = vi.fn();
    const controlled = { assignee: ["user-a"], labels: null };

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1", undefined, {
        controlled,
        onControlledChange,
      }),
    );

    act(() => {
      result.current.updateFilter("assignee", ["user-a"]);
    });

    expect(onControlledChange).not.toHaveBeenCalled();
  });

  it("re-filters when the project prop changes while a controlled filter is active", async () => {
    const controlled = { assignee: ["user-a"], labels: null };

    function Probe({ project }: { project: ReturnType<typeof makeProject> }) {
      const { filteredProject } = useTaskFiltersWithLabelsSupport(
        project,
        "project-1",
        undefined,
        { controlled },
      );
      return (
        <output data-testid="count">
          {filteredProject?.columns[0]?.tasks.length ?? -1}
        </output>
      );
    }

    const { rerender } = render(
      <Probe project={makeProject([{ id: "task-a", userId: "user-a" }])} />,
    );
    expect(screen.getByTestId("count")).toHaveTextContent("1");

    // Simulates the realtime path: useGetTasks -> setProject -> new project prop.
    rerender(
      <Probe
        project={makeProject([
          { id: "task-a", userId: "user-a" },
          { id: "task-c", userId: "user-a" },
          { id: "task-b", userId: "user-b" },
        ])}
      />,
    );

    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });

  it("still behaves as an uncontrolled hook when no options are passed", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ assignee: ["user-b"] }),
    );
    const project = makeProject([
      { id: "task-a", userId: "user-a" },
      { id: "task-b", userId: "user-b" },
    ]);

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1"),
    );

    await waitFor(() => {
      expect(result.current.filters.assignee).toEqual(["user-b"]);
    });

    act(() => {
      result.current.updateFilter("assignee", ["user-a"]);
    });

    await waitFor(() => {
      expect(result.current.filters.assignee).toEqual(["user-a"]);
    });
  });
});

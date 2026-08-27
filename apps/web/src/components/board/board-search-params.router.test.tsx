import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyFilterSearch,
  type BoardSearchParams,
  clearTaskId,
  validateBoardSearch,
} from "./board-search-params";

/**
 * These tests mount a *synthetic* route that uses the production `validateBoardSearch`,
 * `applyFilterSearch` and `clearTaskId`. They deliberately do not mount the real board
 * route: it drags in ProjectLayout, KanbanBoard, dnd-kit, TanStack Query, three zustand
 * stores and i18n, and mocking that surface would produce a slow, brittle test that proves
 * less than this does.
 *
 * What this proves that a pure-function test cannot: that the router's *default*
 * stringifier emits our comma-joined value raw rather than JSON-encoding it, and that a
 * history pop re-derives the filters from the URL.
 */

const BOARD_PATH = "/board";

function Probe() {
  const search = useSearch({ strict: false }) as BoardSearchParams;
  const navigate = useNavigate();

  return (
    <div>
      <output data-testid="assignee">{search.assignee ?? "none"}</output>
      <output data-testid="labels">{search.labels ?? "none"}</output>
      <output data-testid="taskId">{search.taskId ?? "none"}</output>
      <button
        type="button"
        onClick={() =>
          navigate({
            to: ".",
            search: (previous: BoardSearchParams) =>
              applyFilterSearch(previous, {
                assignee: ["u2", "u1"],
                labels: null,
              }),
          })
        }
      >
        set-filters
      </button>
      <button
        type="button"
        onClick={() =>
          navigate({
            to: ".",
            search: (previous: BoardSearchParams) =>
              applyFilterSearch(previous, { assignee: ["u2"], labels: null }),
          })
        }
      >
        set-u2
      </button>
      <button
        type="button"
        onClick={() =>
          navigate({
            to: ".",
            search: (previous: BoardSearchParams) => clearTaskId(previous),
            replace: true,
          })
        }
      >
        close-sheet
      </button>
    </div>
  );
}

function mountAt(initialEntry: string) {
  const rootRoute = createRootRoute();
  const boardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: BOARD_PATH,
    component: Probe,
    validateSearch: validateBoardSearch,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([boardRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  // biome-ignore lint/suspicious/noExplicitAny: synthetic route tree, not the app's
  const result = render(<RouterProvider router={router as any} />);
  return { router, ...result };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("board search params through a real router", () => {
  it("writes dot-joined search params raw, with no JSON and no percent-encoding", async () => {
    const { router } = mountAt(BOARD_PATH);
    await waitFor(() => expect(screen.getByTestId("assignee")).toBeVisible());

    await act(async () => {
      screen.getByRole("button", { name: "set-filters" }).click();
    });

    await waitFor(() =>
      expect(router.state.location.searchStr).toContain("assignee=u1.u2"),
    );

    // The whole reason the search value is a string and not a string[]: the router's
    // default stringifier JSON-encodes object-typed values.
    expect(router.state.location.searchStr).not.toContain("%5B");
    expect(router.state.location.searchStr).not.toContain("[");
    // The whole point of option B: no percent-encoding of the separator.
    expect(router.state.location.searchStr).not.toContain("%2C");
    expect(router.state.location.searchStr).not.toContain("%2E");
    expect(screen.getByTestId("assignee")).toHaveTextContent("u1.u2");
  });

  it("applies filters from the URL on first render", async () => {
    mountAt(`${BOARD_PATH}?assignee=u1.u2&labels=l7`);

    await waitFor(() => {
      expect(screen.getByTestId("assignee")).toHaveTextContent("u1.u2");
      expect(screen.getByTestId("labels")).toHaveTextContent("l7");
    });
  });

  it("browser back restores the previous filter state", async () => {
    const { router } = mountAt(`${BOARD_PATH}?assignee=u1`);
    await waitFor(() =>
      expect(screen.getByTestId("assignee")).toHaveTextContent("u1"),
    );

    await act(async () => {
      screen.getByRole("button", { name: "set-u2" }).click();
    });
    await waitFor(() =>
      expect(screen.getByTestId("assignee")).toHaveTextContent("u2"),
    );

    await act(async () => {
      router.history.back();
    });

    await waitFor(() => {
      expect(screen.getByTestId("assignee")).toHaveTextContent("u1");
      expect(router.state.location.searchStr).toContain("assignee=u1");
    });
  });

  it("renders rather than throwing when the search params are garbage", async () => {
    const { router } = mountAt(`${BOARD_PATH}?assignee=&labels=..&taskId=`);

    await waitFor(() => {
      expect(screen.getByTestId("assignee")).toHaveTextContent("none");
      expect(screen.getByTestId("labels")).toHaveTextContent("none");
    });
    expect(router.state.location.pathname).toBe(BOARD_PATH);
  });

  it("closing the task sheet keeps assignee and labels in the URL", async () => {
    const { router } = mountAt(
      `${BOARD_PATH}?taskId=t1&assignee=u1.u2&labels=l1`,
    );
    await waitFor(() =>
      expect(screen.getByTestId("taskId")).toHaveTextContent("t1"),
    );

    await act(async () => {
      screen.getByRole("button", { name: "close-sheet" }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("taskId")).toHaveTextContent("none"),
    );
    expect(router.state.location.searchStr).toContain("assignee=u1.u2");
    expect(router.state.location.searchStr).toContain("labels=l1");
    expect(router.state.location.searchStr).not.toContain("taskId");
  });
});

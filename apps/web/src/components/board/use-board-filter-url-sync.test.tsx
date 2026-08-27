import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseBoardFilterSearch } from "@/lib/board-filter-search-params";

import { useBoardFilterUrlSync } from "./use-board-filter-url-sync";

type NavigateCall = {
  to: string;
  search: (prev: Record<string, unknown>) => Record<string, unknown>;
  replace: boolean;
};

const navigateSpy = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateSpy,
}));

describe("useBoardFilterUrlSync", () => {
  it("writes active filters to the URL with replace: true", () => {
    const filters = parseBoardFilterSearch({ status: "todo" });
    const search = {};

    renderHook(() => useBoardFilterUrlSync(filters, search));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const call = navigateSpy.mock.calls[0][0] as NavigateCall;
    expect(call.replace).toBe(true);
    expect(typeof call.search).toBe("function");
    expect(call.search({})).toEqual({ status: ["todo"] });
  });

  it("does not navigate when the URL already matches the filter state", () => {
    const filters = parseBoardFilterSearch({ status: "todo" });
    const search = { status: ["todo"] };

    renderHook(() => useBoardFilterUrlSync(filters, search));

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("removes facet params from the URL when the last filter is cleared", () => {
    const filters = parseBoardFilterSearch({});
    const search = { status: ["todo"] };

    renderHook(() => useBoardFilterUrlSync(filters, search));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const call = navigateSpy.mock.calls[0][0] as NavigateCall;
    const next = call.search({ status: ["todo"], taskId: "task-1" });
    expect(next).toEqual({ taskId: "task-1" });
    expect(Object.keys(next)).toEqual(["taskId"]);
  });

  it("preserves taskId when writing filters to the URL", () => {
    const filters = parseBoardFilterSearch({ labels: "l1" });
    const search = { taskId: "task-9" };

    renderHook(() => useBoardFilterUrlSync(filters, search));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const call = navigateSpy.mock.calls[0][0] as NavigateCall;
    const next = call.search({ taskId: "task-9" });
    expect(next).toEqual({ taskId: "task-9", labels: ["l1"] });
  });
});

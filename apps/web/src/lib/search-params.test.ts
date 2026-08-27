import { describe, expect, it } from "vitest";
import { withTaskId } from "./search-params";

describe("withTaskId", () => {
  const prev = { status: ["todo"], labels: ["l1"], taskId: "task-1" };

  it("preserves every unrelated search key while setting taskId", () => {
    const result = withTaskId("task-2")(prev);
    expect(result).toEqual({
      status: ["todo"],
      labels: ["l1"],
      taskId: "task-2",
    });
  });

  it("clears taskId while preserving unrelated search keys", () => {
    const result = withTaskId(undefined)(prev);
    expect(result.status).toEqual(["todo"]);
    expect(result.labels).toEqual(["l1"]);
    expect(result.taskId).toBeUndefined();
  });

  it("does not mutate the previous search object", () => {
    const snapshot = structuredClone(prev);
    withTaskId("task-2")(prev);
    withTaskId(undefined)(prev);
    expect(prev).toEqual(snapshot);
  });
});

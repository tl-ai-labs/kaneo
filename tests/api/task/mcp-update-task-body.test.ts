import { describe, expect, it } from "vitest";
import { buildFullTaskUpdateBody } from "../../../apps/api/src/mcp/tools";

describe("buildFullTaskUpdateBody", () => {
  const baseExistingTask = {
    id: "task-123",
    title: "Initial task title",
    description: "Initial description",
    status: "todo",
    priority: "medium",
    projectId: "project-456",
    position: 1000,
    startDate: "2026-09-01T00:00:00.000Z",
    dueDate: "2026-09-10T00:00:00.000Z",
    userId: "user-789",
  };

  it("preserves estimatedMinutes when patch does not mention it (regression guard)", () => {
    const existing = {
      ...baseExistingTask,
      estimatedMinutes: 90,
    };
    const patch = {
      title: "Updated task title",
    };

    const body = buildFullTaskUpdateBody(existing, patch);

    // Regression guard: if estimatedMinutes were absent/omitted from the returned body,
    // the API PUT handler would coerce the omission to NULL (`estimatedMinutes ?? null`) and destroy the stored estimate.
    expect(body.estimatedMinutes).toBe(90);
  });

  it("overrides existing estimatedMinutes when patch provides an explicit value", () => {
    const existing = {
      ...baseExistingTask,
      estimatedMinutes: 90,
    };
    const patch = {
      estimatedMinutes: 120,
    };

    const body = buildFullTaskUpdateBody(existing, patch);

    expect(body.estimatedMinutes).toBe(120);
  });

  it("keeps cleared estimate cleared when existing estimate is null and patch omits it", () => {
    const existing = {
      ...baseExistingTask,
      estimatedMinutes: null,
    };
    const patch = {};

    const body = buildFullTaskUpdateBody(existing, patch);

    expect(body.estimatedMinutes).toBe(null);
    expect(body.estimatedMinutes).not.toBeUndefined();
  });

  it("clears existing estimate when patch explicitly sets estimatedMinutes to null", () => {
    const existing = {
      ...baseExistingTask,
      estimatedMinutes: 90,
    };
    const patch = {
      estimatedMinutes: null,
    };

    const body = buildFullTaskUpdateBody(existing, patch);

    expect(body.estimatedMinutes).toBe(null);
  });

  it("round-trips preserved fields (spot-checking title and dueDate) to guard general contract", () => {
    const existing = {
      ...baseExistingTask,
      title: "Preserved Title",
      dueDate: "2026-09-15T12:00:00.000Z",
    };
    const patch = {};

    const body = buildFullTaskUpdateBody(existing, patch);

    expect(body.title).toBe("Preserved Title");
    expect(body.dueDate).toBe("2026-09-15T12:00:00.000Z");
  });
});

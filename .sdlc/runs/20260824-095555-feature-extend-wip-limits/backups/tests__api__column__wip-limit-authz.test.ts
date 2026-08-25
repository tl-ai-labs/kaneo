import { describe, expect, it } from "vitest";
import column from "../../../apps/api/src/column";

describe("column middleware authorization chain", () => {
  it("guards the middleware chain on POST /:projectId", () => {
    const postRoutes = column.routes.filter(
      (r) => r.method === "POST" && r.path === "/:projectId",
    );
    // Lower bound, not exact equality: this assertion exists to catch a DELETED
    // guard (workspaceAccess / requireWorkspacePermission / a validator), and an
    // exact count would break the next legitimate middleware addition.
    expect(postRoutes.length).toBeGreaterThanOrEqual(6);
  });

  it("guards the middleware chain on PUT /:id", () => {
    const putRoutes = column.routes.filter(
      (r) => r.method === "PUT" && r.path === "/:id",
    );
    // Lower bound, not exact equality: see the comment above.
    expect(putRoutes.length).toBeGreaterThanOrEqual(6);
  });
});

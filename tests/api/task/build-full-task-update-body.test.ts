import { describe, expect, it } from "vitest";
import { buildFullTaskUpdateBody } from "../../../apps/api/src/mcp/tools";

// The MCP update_task tool does a read-modify-write: it reconstructs a full PUT
// body from the existing task plus a patch. Omitting the estimatedHours key
// entirely is what lets the API's preserve-on-omit semantics work, so the last
// two cases assert ABSENCE of the key, not a null value.
//
// Signature is buildFullTaskUpdateBody(existing, patch) — argument order
// matters, and getting it backwards would silently test the patch path instead
// of the preserve path.
const baseExisting = {
  id: "t1",
  title: "T",
  description: "",
  status: "to-do",
  priority: "medium",
  projectId: "p1",
  position: 1,
};

describe("buildFullTaskUpdateBody estimatedHours", () => {
  it("preserves the existing value when the patch omits the key", () => {
    const body = buildFullTaskUpdateBody(
      { ...baseExisting, estimatedHours: 5 },
      {},
    );
    expect(body.estimatedHours).toBe(5);
  });

  it("clears the estimate when the patch sets null", () => {
    const body = buildFullTaskUpdateBody(
      { ...baseExisting, estimatedHours: 5 },
      { estimatedHours: null },
    );
    expect(body.estimatedHours).toBeNull();
  });

  it("sets 0, which is a real estimate (guards against an || regression)", () => {
    const body = buildFullTaskUpdateBody(
      { ...baseExisting, estimatedHours: 5 },
      { estimatedHours: 0 },
    );
    expect(body.estimatedHours).toBe(0);
  });

  it("carries an existing null through when the patch omits the key", () => {
    const body = buildFullTaskUpdateBody(
      { ...baseExisting, estimatedHours: null },
      {},
    );
    expect(body.estimatedHours).toBeNull();
  });

  it("omits the key entirely when neither existing nor patch has one", () => {
    const body = buildFullTaskUpdateBody(baseExisting, {});
    expect(body).not.toHaveProperty("estimatedHours");
  });

  it("degrades a malformed existing value to omission, never to an erase", () => {
    const body = buildFullTaskUpdateBody(
      { ...baseExisting, estimatedHours: "8" },
      {},
    );
    expect(body).not.toHaveProperty("estimatedHours");
  });
});

## Task tp_pkt_014 — tests / test_add
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository and do NOT read any file. Everything you need is in `inputs` below. Make exactly ONE file write, to the artifact path named below, and ZERO file reads. Do not create, modify or delete any other file.

Create tests/api-integration/column-wip-limit.test.ts — a PostgreSQL-backed integration test proving acceptance criteria AC-2, AC-3, AC-4 and AC-12. Follow the house integration pattern in the reference file in inputs EXACTLY (resetTestDatabase() in beforeEach, createWorkspaceMember() fixture, mockAuthenticatedSession(member.user) / mockAnonymousSession(), `const { app } = createApp()` then `app.request("/api/...")`, and db.query.<table>.findFirst for persistence re-reads).

ROUTES (all mounted under /api): POST /api/column/:projectId creates a column; PUT /api/column/:id updates one; GET /api/task/tasks/:projectId returns the project board.

Set up in each test: a workspace member, a project (POST /api/project as the reference does, which seeds default columns), then create the column under test via POST /api/column/:projectId so the route is exercised.

Four tests:
1. AC-2 — POST /api/column/:projectId with { name: "In Progress", wipLimit: 4 } returns 200 and the created column has wipLimit 4; re-read the row via db.query.columnTable.findFirst to confirm it persisted.
2. AC-3 — PUT /api/column/:id with { wipLimit: 7 } sets it; then { wipLimit: null } clears it to null; then { name: "Renamed" } with wipLimit OMITTED leaves the stored wipLimit untouched. Assert the persisted row after each step.
3. AC-4 — an unauthenticated request (mockAnonymousSession) to PUT /api/column/:id is rejected and does not mutate the row. Assert response.status is >= 400 and the stored wipLimit is unchanged.
4. AC-12 — GET /api/task/tasks/:projectId returns each column with `id` STILL equal to the column slug, plus a distinct `columnId` equal to the column's database UUID, plus `wipLimit`. Assert explicitly that column.id === the slug AND column.id !== column.columnId. Also assert a column with no limit set reports wipLimit: null.

Do NOT add enforcement assertions — this feature never blocks task creation or movement. Use `import { eq } from "drizzle-orm"` and `import db, { schema } from "../../apps/api/src/database"` as the reference does. Write only this one file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### tests/api-integration/project.test.ts
_Included because: undefined_

```
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

describe("API integration: project creation", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated project creation requests", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "workspace-missing",
        name: "Unauthorized Project",
        icon: "Folder",
        slug: "unauthorized-project",
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Unauthorized");
  });

  it("creates a project for a workspace member and seeds default columns", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: member.workspace.id,
        name: "Roadmap",
        icon: "FolderKanban",
        slug: "roadmap",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as typeof schema.projectTable.$inferSelect;

    expect(payload).toMatchObject({
      workspaceId: member.workspace.id,
      name: "Roadmap",
      icon: "FolderKanban",
      slug: "roadmap",
    });

    const persistedProject = await db.query.projectTable.findFirst({
      where: eq(schema.projectTable.id, payload.id),
    });

    expect(persistedProject).toMatchObject({ id: payload.id, workspaceId: member.workspace.id });
  });
});

```

#### apps/api/src/column/index.ts
_Included because: undefined_

```
// Relevant route shapes (Hono chain, mounted at /api/column via app.route("/api", api)).

.post(
  "/:projectId",
  describeRoute({ operationId: "createColumn", ... }),
  validator("param", v.object({ projectId: v.string() })),
  validator("json", v.object({
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    isFinal: v.optional(v.boolean()),
    wipLimit: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
  })),
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ project: ["update"] }),
  async (c) => {
    const { projectId } = c.req.valid("param");
    const { name, icon, color, isFinal, wipLimit } = c.req.valid("json");
    const result = await createColumn({ projectId, name, icon, color, isFinal, wipLimit });
    return c.json(result);
  },
)
.put(
  "/:id",
  describeRoute({ operationId: "updateColumn", ... }),
  validator("param", v.object({ id: v.string() })),
  validator("json", v.object({
    name: v.optional(v.string()),
    icon: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
    isFinal: v.optional(v.boolean()),
    wipLimit: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
  })),
  workspaceAccess.fromColumn("id"),
  requireWorkspacePermission({ project: ["update"] }),
  async (c) => {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    const result = await updateColumn(id, data);
    return c.json(result);
  },
)

// GET /api/task/tasks/:projectId returns the board. Its column projection is:
//   { id: column.slug, columnId: column.id, slug: column.slug, name, icon, isFinal, wipLimit, tasks: [...] }
// The db table is schema.columnTable with columns id (uuid pk), projectId, name, slug, position, icon, color, isFinal, wipLimit.

```
### Acceptance criteria
- File tests/api-integration/column-wip-limit.test.ts exists with four it() blocks covering AC-2, AC-3, AC-4, AC-12.
- resetTestDatabase() runs in beforeEach; fixtures come from ./helpers/fixtures and auth from ./helpers/auth.
- AC-3 asserts the persisted row after each of the three PUT steps, including that an omitted wipLimit leaves the stored value untouched.
- AC-4 asserts status >= 400 and an unchanged stored wipLimit.
- AC-12 asserts column.id === slug and column.id !== column.columnId.
- No enforcement/blocking assertions are present.
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "summary"
  ]
}
```
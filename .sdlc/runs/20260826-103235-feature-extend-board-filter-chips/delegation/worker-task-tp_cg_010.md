## Task tp_cg_010 — tests / test_backfill
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Add navigation tests to apps/web/src/components/list-view/task-row.test.tsx. READ that file and apps/web/src/components/list-view/task-row.tsx first.

KEEP every existing test in the file passing, unchanged.

task-row.tsx now calls `useNavigate()` from `@tanstack/react-router` and, on row click, navigates with a FUNCTIONAL search updater:
- selecting a task: `navigate({ to: ".", search: (prev) => ({ ...prev, taskId: task.id }) })`
- deselecting:      `navigate({ to: ".", search: (prev) => { const { taskId: _omit, ...rest } = prev; return rest; } })`
Neither passes `replace`, and that is correct — task open/close are PUSH navigations by design. Do NOT assert `replace: true` in this file.

Mock the router's `useNavigate` so you can capture the call, e.g.
```ts
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mockNavigate,
}));
```
Mock whatever else the component needs, following the mocking style already used in this test file.

ADD TWO TESTS:
1. SELECT PRESERVES FILTERS — render an unselected row, click it, then take the `search` argument from the captured navigate call, ASSERT IT IS A FUNCTION, CALL IT with `{ status: ["in_progress"], priority: ["high"] }`, and assert the returned object deep-equals `{ status: ["in_progress"], priority: ["high"], taskId: <the task id> }`.
2. DESELECT PRESERVES FILTERS — render a selected row, click it, capture the `search` argument, CALL IT with `{ status: ["in_progress"], taskId: <the task id> }`, and assert the result deep-equals `{ status: ["in_progress"] }` — taskId removed, filters intact.

CRITICAL: you must INVOKE the captured updater and assert on its RETURN VALUE. Asserting `search: expect.any(Function)` is FORBIDDEN — it passes for a wrong updater and proves nothing. Both tests must fail if the component reverts to a plain `{ taskId }` object literal.

AFTER WRITING, run `pnpm --filter @kaneo/web test src/components/list-view/task-row.test.tsx` and iterate until every test in this file passes. Report final counts.

SCOPE — you may modify EXACTLY ONE file: apps/web/src/components/list-view/task-row.test.tsx. Do NOT modify task-row.tsx — if you think it has a bug, leave it and describe it in `implementation_bugs_found`. Do not touch any other file. The only non-read-only command you may run is the scoped vitest command above. Do NOT run biome, prettier, eslint, `pnpm lint` or `pnpm i18n:check:fix`.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/list-view/task-row.tsx
_Included because: The click handler under test, post-change. Both branches now pass a functional updater._

```
  const navigate = useNavigate();
  // ... on row click:
    if (isSelected) {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => {
          const { taskId: _omit, ...rest } = prev;
          return rest;
        },
      });
    } else {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, taskId: task.id }),
      });
    }
```
### Acceptance criteria
- Every test in the file passes
- All pre-existing tests in the file are preserved and still pass
- The select test invokes the captured updater and asserts the returned object contains both the prior filters and taskId
- The deselect test invokes the captured updater and asserts taskId is removed while filters remain
- expect.any(Function) appears nowhere in the file
- No replace: true assertion was added
- task-row.tsx was NOT modified
- files_written contains exactly one path, the test file
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
    "tests_passing": {
      "type": "integer"
    },
    "tests_failing": {
      "type": "integer"
    },
    "existing_tests_preserved": {
      "type": "boolean"
    },
    "uses_expect_any_function": {
      "type": "boolean",
      "description": "must be false"
    },
    "implementation_bugs_found": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "artifact_path",
    "tests_passing",
    "tests_failing",
    "existing_tests_preserved",
    "uses_expect_any_function",
    "implementation_bugs_found",
    "files_written"
  ]
}
```
## Task tp_req_001 — requirements_analysis / delta_requirements
Module: column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Brownfield feature-extend run on the Kaneo monorepo (repo root is your work_dir). Read the intent brief below, then READ the real files it names (apps/api/src/database/schema.ts columnTable, apps/api/src/column/index.ts, apps/api/src/column/controllers/{create-column,update-column,get-columns}.ts, apps/web/src/fetchers/column/*, apps/web/src/hooks/mutations/column/*, apps/web/src/components/kanban-board/column/{index.tsx,column-header.tsx}, i18n/en-US.json, and AGENTS.md) to ground every statement in the code as it exists today. Produce a DELTA requirements document (what changes relative to current behavior — not a from-scratch spec). Sections, in order: 'In scope' (numbered, testable), 'Out of scope' (numbered), 'Current behavior (delta baseline)' (per-file: exact current shape of columnTable, the Valibot validators, the controller responses, the ColumnHeader props/render, quoting real identifiers), 'Functional requirements per module' (FR-1..n grouped by api-schema / api-contract / web-data / web-ui / i18n, each naming its target file), 'Non-functional requirements' (NFR-1..n: migration safety on non-empty DBs, no realtime regression, i18n static keys, no new permission, indicator-only), 'PII inventory' (table field|sensitivity|protection — state plainly if none), 'Role matrix' (role x resource x action, reusing existing column-edit permission), 'Acceptance criteria' (numbered, executable, mapped to a verification command where possible), 'Open questions for HITL'. Do not design the implementation (no code, no SQL) — that is the next phase. Write the finished markdown to the artifact_path and also return it in the structured output.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260820-123148-feature-extend-lane-wip-limit/intent_brief.md
_Included because: The confirmed intent brief: goal, scope, files in scope/off-limits, acceptance criteria, non-goals._

```
# Intent Brief — feature-extend — Per-lane WIP limit on Board

## Context
Kanban lanes are backed by a real `columnTable` in apps/api/src/database/schema.ts (id, projectId, name, slug, position, icon, color, isFinal, timestamps) — not a bare status enum. The board UI is apps/web/src/components/kanban-board/index.tsx (KanbanBoard), which maps project.columns to Column components (apps/web/src/components/kanban-board/column/index.tsx). Each column renders its header via ColumnHeader (apps/web/src/components/kanban-board/column/column-header.tsx) — this is the 'LaneHeader'. ColumnHeader currently shows icon, name, and a task-count badge (column.tasks.length); no WIP-limit or capacity field exists anywhere in schema or UI today. Columns already have a settings surface — apps/web/src/components/project/column-editor.tsx — used for create/update column properties via apps/api/src/column/controllers/{create-column,update-column}.ts and apps/web/src/fetchers/column/{create-column,update-column}.ts + apps/web/src/hooks/mutations/column/use-update-column.ts.

## Goal
Add an optional, per-lane WIP (work-in-progress) limit to columns, and show an over-cap indicator in the lane header when a column's current task count exceeds its configured limit.
- Where configured: inline in ColumnHeader (a small editable control, e.g. click the task-count badge to set/clear a numeric limit) — not a separate settings page.
- Persistence: a nullable wipLimit (integer) column added to columnTable via a generated migration, exposed through the existing create/update column API contract and typed client.
- Enforcement: indicator only. No limit set = unlimited, current behavior unchanged. When a limit is set and tasks.length > wipLimit, show a visual over-cap indicator (badge color change / warning icon) in ColumnHeader. Do not block drag-and-drop, task creation, or any other action — purely informational.

## Files in scope
- apps/api/src/database/schema.ts — add wipLimit to columnTable.
- Migration SQL under apps/api/drizzle/** produced ONLY via `pnpm --filter @kaneo/api db:generate` after the schema edit (never hand-written), safe for existing installations (nullable, no backfill).
- apps/api/src/column/controllers/create-column.ts and update-column.ts — accept/validate/persist wipLimit (Valibot).
- apps/api/src/column/controllers/get-columns.ts — ensure wipLimit is returned.
- Column route/OpenAPI schema wherever create/update column request/response shapes are declared (apps/api/src/column/index.ts).
- packages/libs typed client — only if column request/response types are hand-declared there rather than inferred; confirm during design.
- apps/web/src/fetchers/column/{create-column,update-column,get-columns}.ts — thread wipLimit through.
- apps/web/src/hooks/mutations/column/use-update-column.ts (and use-create-column.ts if creation also sets a limit) — cache invalidation.
- apps/web/src/components/kanban-board/column/column-header.tsx — inline WIP-limit editor control + over-cap visual indicator.
- apps/web/src/components/kanban-board/column/index.tsx — pass wipLimit through if needed.
- i18n/en-US.json — new static keys for the control and indicator copy (i18n/schema.json is generated and off-limits).

## Files off-limits
Everything outside the column/board vertical slice: auth, workspace permissions, other entity schemas, integrations (apps/api/src/plugins/**), MCP, webhooks, Helm/Docker, plus .env*, .mcp.json, node_modules/**, dist/**, build/**, .next/**, .sdlc/**, .git/**, .cursor/rules/**, .claude/settings.local.json, AGENTS.md, CLAUDE.md, i18n/schema.json, pnpm-lock.yaml, apps/web/src/routeTree.gen.ts, apps/api/src/database/relations.ts.

## Acceptance criteria
- columnTable has a nullable wipLimit integer column; migration applies cleanly to an existing non-empty database.
- Creating or updating a column can set, change, or clear wipLimit through the existing API contract, with Valibot validation (positive integer or null) and accurate OpenAPI description.
- ColumnHeader lets a user set/edit/clear the WIP limit for that lane inline.
- When wipLimit is null, ColumnHeader and all board behavior are identical to today.
- When wipLimit is set and the lane's task count exceeds it, ColumnHeader shows a clear over-cap indicator; no action is blocked anywhere as a result of being over cap.
- All new user-facing copy is static i18n keys, not hardcoded strings.
- Realtime: WIP-limit changes reach other connected clients through the existing column-update event/WebSocket path (no new event type).

## Non-goals
- No enforcement/blocking. No workspace/project-level default WIP limit. No new permission/role. No changes to taskTable.status or status/columnId sync.

```
### Acceptance criteria
- Document contains all nine required sections in order
- Every functional requirement names the concrete in-scope file it targets
- Current-behavior section quotes real identifiers read from the repo, not invented ones
- No implementation code or SQL is included
- Scope matches the intent brief allowlist; nothing off-limits is required
- Written to .sdlc/runs/20260820-123148-feature-extend-lane-wip-limit/requirements.md
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "requirements_markdown": {
      "type": "string"
    },
    "open_questions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "files_read": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "requirements_markdown",
    "open_questions"
  ]
}
```
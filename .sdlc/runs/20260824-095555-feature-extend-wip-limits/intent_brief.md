# Intent Brief — feature-extend — Per-lane WIP limit with over-cap indicator

## Context
Kaneo's kanban board renders one lane per project column. Columns are rows in `columnTable`
(`apps/api/src/database/schema.ts:342`) with `name`, `slug`, `position`, `icon`, `color`,
`isFinal`; they are managed by `apps/api/src/column/` controllers and edited in the web app
through `ColumnEditor` on Settings → Project → Workflow
(`apps/web/src/routes/_layout/_authenticated/dashboard/settings/projects/$projectId/workflow.tsx`).
The board itself lives in `apps/web/src/components/kanban-board/`, with the lane header in
`column/column-header.tsx`. There is today no notion of a work-in-progress cap for a lane.

User's request, verbatim:
> add per-lane WIP limit to Board with over-cap indicator in LaneHeader

## Goal
Let a project define an optional work-in-progress limit per column, persisted with the column,
and surface an over-cap indicator in the board's lane header when a lane holds more tasks than
its limit.

Decisions confirmed in the interview:
- **Storage** — persisted per column: a nullable `wipLimit` integer on `columnTable`, with a
  generated migration, exposed through the existing column API (create/update/get).
- **Enforcement** — soft. The lane header shows count vs limit and an over-cap visual state.
  Drag/drop and task creation are never blocked, and no API rejection is added.
- **Permissions** — reuse the existing `@kaneo/permissions` check that already gates column
  editing. No new permission vocabulary.
- **Edit surface** — the existing `ColumnEditor` in project workflow settings. No second edit
  surface on the board.
- **Compatibility** — `wipLimit` is nullable; NULL means no limit. Existing columns and existing
  installations behave exactly as they do today.

## Files in scope
Confirmed at Gate 0 and frozen into `.sdlc/local/write-contract.json`:
- `apps/api/src/database/schema.ts` — add nullable `wipLimit` to `columnTable`.
- `apps/api/src/database/relations.ts` — only if the change requires it.
- `apps/api/drizzle/*.sql` — generated migration for the new column.
- `apps/api/src/column/**` — validators, create/update/get controllers, OpenAPI metadata.
- `apps/web/src/components/kanban-board/**` — lane header over-cap indicator.
- `apps/web/src/components/project/**` — `ColumnEditor` WIP limit input.
- `apps/web/src/fetchers/**`, `apps/web/src/hooks/**`, `apps/web/src/types/**`,
  `apps/web/src/lib/column.ts` — column payload plumbing and cache updates.
- `apps/web/src/i18n/**` — static keys, `en-US.json` is the source of truth.
- `packages/libs/**` — typed Hono client types only if the column contract requires it.
- `tests/api/**` — focused API coverage. Web component tests live beside their components
  under the already-allowlisted web paths.
- `.gitignore` — append `.sdlc/` (confirmed at Gate 0).

## Files off-limits
Project defaults from `.sdlc/project.json.off_limits_default`:
`.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
`node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`

Plus AI configs detected by discovery (default OFF-LIMITS, not moved into scope):
`.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.agents/skills/**`, `skills/**`, `.cursor/rules/**`

Plus ticket-specific additions:
`pnpm-lock.yaml`, `.turbo/**`, `.husky/**`, `apps/web/src/routeTree.gen.ts`,
`apps/api/drizzle/meta/**`, `apps/site/**`, `apps/docs/**`, `charts/**`

## Run configuration (Gate 0)
- Intent: `feature-extend`
- Policy: `opus-plus-flash-v37` (premium `opus` / mechanical `flash-completion`), hard cap $50
- Auth mode: `estimated`
- Test command: `pnpm test`; scoped `pnpm --filter @kaneo/api test`,
  `pnpm --filter @kaneo/web test`. Green baseline before the run: API 374 tests,
  web 112 tests, all passing. Integration (`test:integration`) needs Postgres and was not run.
- Rollback anchor: `5d1fc9104337786c3ef295ec0dc31656df371d8d` on `feature-extend-1/opus-flash`
- Known constraints: commitlint requires conventional commits; `pnpm lint` runs Biome with
  `--write`, so prefer `biome check` on changed paths.

## Acceptance criteria
1. `columnTable` has a nullable `wipLimit` integer with a generated, inspected migration that is
   safe on an existing populated database.
2. The column API accepts and returns `wipLimit`, validated with Valibot (positive integer or
   null), with accurate OpenAPI metadata, and rejects invalid values.
3. Setting a limit requires the same workspace permission that already gates column editing,
   enforced in the API — not only hidden in the UI.
4. `ColumnEditor` in project workflow settings can set, change, and clear a column's limit, and
   the change persists across reload.
5. The board lane header shows the lane's task count against its limit when a limit is set, with
   a distinct over-cap state when count exceeds limit.
6. A column with no limit renders exactly as it does today.
7. All new user-facing copy uses static i18n keys, with `i18n/en-US.json` as the source of truth.
8. Drag/drop, task creation, and archiving behavior are unchanged; nothing is blocked by a limit.
9. Focused API tests cover validation and persistence; focused web tests cover the indicator's
   under/at/over-cap states. Affected packages typecheck.

## Non-goals
- No hard enforcement: no blocked drops, no API rejection of over-cap moves, no toast warnings.
- No inline WIP-limit editing from the board lane header.
- No workspace-level or project-level default limits.
- No WIP-limit analytics, history, or notifications.
- No changes to `workflowRuleTable`, gitea/github column resolvers, or MCP tools.
- No board performance refactor beyond what the indicator requires.

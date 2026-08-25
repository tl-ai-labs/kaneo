# Discovery — 20260821-094808-feature-extend-lane-wip-limit

Mode: `refresh` → decision **`cached`**.
`discovery-refresh.mjs` reported git HEAD unchanged (`5d1fc9104337786c3ef295ec0dc31656df371d8d`), 0 commits behind, no stack-manifest mtime change, no policy change. The living baseline built at `2026-08-20T12:20:44+00:00` (about 21 hours old) was copied verbatim to `baseline.json` for this run; no re-scan of read groups 2-9 was performed. The living baseline received a pointer-only refresh (`last_verified_at` / `last_verified_run_id` / `last_verified_decision`), no content change.

One field was corrected in the per-run copy: `git.branch` is now `feature-extend-1/opus-sonnet` (the baseline was authored on `feature-extend-1/opus-only`). Both branches sit on the same commit, so nothing else moved.

## Benchmark contamination guard

Arm 4 of a controlled benchmark; the same ticket was implemented three times before on branches off this base commit.

- Guard query: case-insensitive `wip_limit|wipLimit` across **tracked** files, excluding `dist/`, `build/`, `.next/`, `.sdlc/`.
- **Hits: 0.** A second pass over the whole working tree (including untracked files, same exclusions plus `node_modules`, `.git`, `.hook-logs`) also returned 0.
- The exclusions are load-bearing, not decorative: 73 files under `.sdlc/` and 7 files under build output (`apps/api/dist`, `apps/web/dist`, `apps/site/.next`) do match the pattern. None were opened.
- Build output is untracked (`git ls-files apps/api/dist apps/web/dist apps/site/.next` → 0 files), so it can never reach a tracked-file scan, but it remains explicitly off-limits.
- No `git show`, `git diff`, or `git log -p` was run against `a91f124c`, `a3552177`, or `b2d31805`. No prior run directory under `.sdlc/runs/` was read.

Conclusion: the working tree at `5d1fc910` is a clean pre-feature state and was the only source for the impact analysis below.

## Tier 1 snapshot (from cached baseline)

- **Git** — HEAD `5d1fc9104337786c3ef295ec0dc31656df371d8d`, branch `feature-extend-1/opus-sonnet`, remote `origin` → `https://github.com/tl-ai-labs/kaneo.git`. Working tree dirty by untracked paths only (`.claude/settings.local.json`, `.hook-logs/`, `.sdlc/`); zero tracked modifications. 1578 tracked files.
- **`.gitignore` does not cover `.sdlc/`** — run artifacts are visible to `git add -A`.
- **Stacks** — TypeScript monorepo. `apps/api` Hono + hono-openapi + Better Auth + Drizzle + Valibot + pg + ioredis; `apps/web` React + Vite + TanStack Router/Query + Radix + Tailwind + dnd-kit; `apps/site` Next.js; packages `libs` (typed Hono client), `permissions`, `mcp`, `email`, `planka-import`, `typescript-config`.
- **Monorepo** — pnpm workspace (`packages/**`, `apps/**`) + Turborepo. 9 packages.
- **Test command proposed** — `pnpm test` (root `scripts.test` → turbo). Runner is vitest. Narrower: `pnpm --filter @kaneo/api test`, `pnpm --filter @kaneo/api test:integration` (needs PostgreSQL), `pnpm --filter @kaneo/web test`, `pnpm typecheck`. Gate 0 still confirms.
- **Submodules** — none. **Git-LFS** — not in use.
- **Competing AI configs** — `.cursor/rules/` (7 `.mdc` files), `.claude/` incl. `settings.local.json` and `skills/`, `.agents/skills/`, `skills/` (symlinks into `.agents/skills`), `CLAUDE.md` → `AGENTS.md`. Absent: `.mcp.json`, `.cursorrules`, Aider, Continue, Roo, Copilot instructions, repo-local `routing-policy.yaml`.
- **Regulated signals** — only a standard open-source `SECURITY.md`; no warning required.
- **Infra** — 3 Dockerfiles, 13 GitHub workflows, Helm chart at `charts/kaneo`, husky hooks, devcontainer.

## Coexistence risks

- Cursor rules at `.cursor/rules` — never touched. If Cursor auto-lint-on-save is running, our edits may trigger it.
- Claude Code project config at `.claude/` — never touched.
- `AGENTS.md` carries binding conventions (Valibot validation, `requireWorkspacePermission`, migrations only via `db:generate`, i18n keys from `i18n/en-US.json`). Read-only input, never a write target.
- Repo `lint` scripts run Biome with `--write` and can modify unrelated files — prefer targeted checks.
- `.gitignore` does not cover `.sdlc/`. Gate 0 should offer to add `.gitignore` to this run's allowlist so the entry can be added as part of the run.

## Proposed off-limits

Unchanged from the living baseline, plus `.hook-logs/**`. Notable entries: `.sdlc/**`, `**/dist/**`, `**/.next/**`, `**/.turbo/**`, `.claude/**`, `.cursor/**`, `.agents/**`, `skills/**`, `CLAUDE.md`, `AGENTS.md`, `pnpm-lock.yaml`, `apps/web/src/routeTree.gen.ts`, `apps/api/drizzle/**` (generated SQL — regenerate via `pnpm --filter @kaneo/api db:generate`), `i18n/schema.json` (generated; `i18n/en-US.json` is editable and is the copy source of truth), `.env.sample`.

## Impact map — advisory per-column WIP limit

See the parent report. All paths below were read from the working tree at `5d1fc910` only.

### Data
- `apps/api/src/database/schema.ts:342-367` — `columnTable`. Sibling per-column settings: `position`, `icon`, `color`, `isFinal` (`:356-359`). A nullable `integer("wip_limit")` belongs here.
- `apps/api/drizzle/` — generated migration, latest `0042_previous_the_executioner.sql`. Generate, do not hand-write.
- `apps/api/src/database/relations.ts:114-127` — `columnTableRelations`; unchanged by a scalar column.

### API
- `apps/api/src/column/index.ts` — route/validator surface. `createColumn` json validator `:56-64`; `updateColumn` json validator `:132-140`; both guarded by `workspaceAccess` + `requireWorkspacePermission({ project: ["update"] })`.
- `apps/api/src/column/controllers/create-column.ts:18-78` — param destructure and `.values({...})` insert.
- `apps/api/src/column/controllers/update-column.ts:6-32` — the `data.X !== undefined &&` conditional-set block; clearing a limit needs `nullable`, matching how `icon`/`color` are handled.
- `apps/api/src/column/controllers/get-columns.ts:5-12` — `select()` star, so it carries a new field for free.

### Board projection (the one that actually feeds the kanban UI)
- `apps/api/src/task/controllers/get-tasks.ts:218-237` — the projection. It re-maps columns to `{ id: column.slug, slug, name, icon, isFinal, tasks }`, dropping `color`, `position`, and the real `column.id`. **A new field is silently invisible to the board unless added at `:224-229`.** This is the highest-risk spot.

### Web types and data layer
- `apps/web/src/types/project/index.ts:10-28` — `ProjectWithTasks` is inferred from the `get-tasks` response, so it updates automatically once the projection carries the field.
- `apps/web/src/fetchers/column/update-column.ts:3-11` and `apps/web/src/fetchers/column/create-column.ts` — hand-written `data` shapes duplicating the Valibot schema.
- `apps/web/src/hooks/mutations/column/use-update-column.ts:8-20` — the same shape again; `:21-31` already invalidates both `["columns", projectId]` and `["tasks", projectId]`, which is exactly what an over-cap badge needs.
- `apps/web/src/hooks/queries/column/use-get-columns.ts` — settings-side query.

### UI
- `apps/web/src/components/kanban-board/column/column-header.tsx:62-64` — the existing `{column.tasks.length}` count badge; the over-cap indicator goes here.
- `apps/web/src/components/kanban-board/column/index.tsx:14-24` — column shell, if the over-cap state should tint the border.
- `apps/web/src/components/kanban-board/column/column-dropzone.tsx` — dnd-kit droppable; advisory means it must NOT block the drop.
- `apps/web/src/components/project/column-editor.tsx` — the only place per-column settings are edited today. Rendered solely from `apps/web/src/routes/_layout/_authenticated/dashboard/settings/projects/$projectId/workflow.tsx:39`. Follow the `handleToggleFinal`/`handleUpdateIcon` pattern (`:86-116`) and the row layout at `:299-341`. Note it keys mutations on `col.id` (real id) while `getColumnIcon` uses `col.slug`.

### i18n
- `i18n/en-US.json` — source of truth. `settings:columnEditor.*` block starts at `:883`; `tasks:kanban.*` at `:1884`. Other locale files exist but `en-US.json` is the one to edit.

### Tests
- `tests/api/column/to-slug.test.ts` — only existing column unit test.
- `tests/api-integration/` has `project.test.ts`, `task.test.ts`, `project-reorder.test.ts` but no column/board integration test; a new one would be net-new.

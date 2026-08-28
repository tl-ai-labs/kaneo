# Intent Brief — refactor — Extract PublicColumnHeader from the public kanban column

## Context
The user's request was "extract LaneHeader component from Lane". This repo has no `Lane`
concept — the board's vertical containers are `Column` everywhere (`Column`, `ColumnHeader`,
`ColumnDropzone`, `getColumnIcon`, `ProjectWithTasks["columns"]`, and the API/DB `columns`
relation). `grep -ri lane` over `apps/web/src` and `apps/api/src` returns zero hits.

On the private board the extraction already exists:
`apps/web/src/components/kanban-board/column/index.tsx` is 36 lines of pure composition and
delegates to `column-header.tsx` (105 lines) and `column-dropzone.tsx`.

The public read-only board is the one that never got the treatment.
`apps/web/src/components/public-project/kanban-view.tsx` (70 lines) renders the whole column
inline inside a `.map()`, including an inline header block — the `getColumnIcon` /
`column.name` / `column.tasks.length` trio wrapped in two flex divs.

That inline header is the real, not-yet-done target matching the request.

## Goal
Extract the inline column-header markup in `public-project/kanban-view.tsx` into its own
component, `PublicColumnHeader`, in a new file
`apps/web/src/components/public-project/public-column-header.tsx`, and render it from
`kanban-view.tsx`. Pure structural extraction — identical DOM and classes.

## Files in scope
- `apps/web/src/components/public-project/public-column-header.tsx` (new)
- `apps/web/src/components/public-project/kanban-view.tsx` (edit — replace inline header
  with `<PublicColumnHeader column={column} />`)
- `apps/web/src/components/public-project/public-column-header.test.tsx` (new, optional —
  only if it adds real proof beyond typecheck)

## Files off-limits
Project defaults from `.sdlc/project.json.off_limits_default`, plus:
- `apps/web/src/routeTree.gen.ts`, `i18n/schema.json`, `pnpm-lock.yaml`, `apps/api/drizzle/**`
  (generated — never hand-edit)
- `.gitignore`, `.claude/**`, `.cursor/rules/**`, `AGENTS.md`, `CLAUDE.md`, `.coderabbit.yaml`,
  `skills/**`, `.agents/skills/**`, `skills-lock.json` (AI configs — off-limits by default)
- `apps/web/src/components/kanban-board/**` (the private board is already correct; do not
  touch it, and do not attempt to share a component between the two boards)

## Acceptance criteria
1. `kanban-view.tsx` no longer contains the inline header JSX; it renders `<PublicColumnHeader>`.
2. Rendered DOM and Tailwind classes are byte-identical to before the change.
3. `PublicColumnHeader` takes the column as its only required prop, typed from
   `ProjectWithTasks["columns"][number]` — no new ad-hoc type.
4. `pnpm --filter @kaneo/web typecheck` passes.
5. `pnpm --filter @kaneo/web test` passes with no new failures.
6. `pnpm exec biome ci` passes on the changed paths only.

## Non-goals
- Renaming `Column*` → `Lane*`. The API and DB call these columns; renaming only the web
  components would split the vocabulary for no gain.
- Sharing one header component between the private and public boards. The private
  `ColumnHeader` carries permission gating, create-task and archive modals, i18n and mutation
  hooks; the public board is read-only and unauthenticated. Merging them means a props-flag
  mess and drags auth-only imports into the public bundle.
- Extracting the public column *container* as well. The request is the header.
- Splitting `backlog-list-view/index.tsx` (485 lines) or `list-view/index.tsx` (466 lines).
  Genuinely oversized, but neither has a header to extract and neither was asked for.

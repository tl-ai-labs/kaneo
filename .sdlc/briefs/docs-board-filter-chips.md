# Intent Brief — docs — Enrich "Use filters to focus" with active-filter-chip behavior

## Context
Original request: add a README "Board features" section covering WIP limits, hours rollup, and
filter chips. Discovery found this cannot be done as literally asked on this branch:

- **WIP limits**: no code, no docs anywhere on `main` — implemented only on unmerged branch
  `feature-extend-1/*`.
- **Hours rollup**: partial code (per-task time tracking exists in `apps/api/src/time-entry/`,
  `timeEntryTable.duration`) but no estimate field and no column-level aggregation on `main` —
  the rollup itself lives only on unmerged branch `feature-extend-2/*`.
- **Filter chips**: already shipped and already documented. `apps/docs/core/functional/
  plan-and-execute-tasks.mdx` §5 "Use filters to focus" lists the five filterable fields
  (Status, Priority, Assignee, Due date, Labels) but does not describe the chip UI itself.
- The repo's documentation convention for user-facing features is `apps/docs` (Mintlify), not
  the root `README.md`. The root README is 179 lines of pure install/deploy content with no
  per-feature precedent.

Operator decision at Gate 0 (scope question, not mine to make unilaterally): **document filter
chips only, by enriching the existing §5 section — not adding a new one, and not touching the
root README.** WIP limits and hours rollup are out of scope until their branches merge.

## Goal
Extend `apps/docs/core/functional/plan-and-execute-tasks.mdx` §5 "Use filters to focus" to
describe the active-filter-chip UI that already exists in code but is undocumented: each active
filter renders as a removable chip (`ActiveFilterChip`, `board-toolbar.tsx:78-101`) with its own
clear control, and a "Clear all filters" action appears once any filter is active
(`board-toolbar.tsx:517-526`, i18n key `common:actions.clearAllFilters`).

## Task type
doc_update

## Files in scope
- `apps/docs/core/functional/plan-and-execute-tasks.mdx` (edit — extend §5 only)

## Files off-limits
Project defaults from `.sdlc/project.json.off_limits_default`, plus:
- `README.md` (out of scope per Gate 0 decision — not the target surface)
- `apps/docs/docs.json` (no new page is being created, so no nav registration is needed; if
  codegen decides a new page is warranted instead of enriching §5, that is a deviation to flag,
  not to make silently)
- Any file under `apps/web/src/**` (documentation-only change; no code edits)
- `.claude/**`, `.cursor/rules/**`, `.agents/skills/**`, `skills/**`, `skills-lock.json`,
  `AGENTS.md`, `CLAUDE.md`, `.coderabbit.yaml` (AI configs — off-limits by default)
- Anything referencing WIP limits or hours rollup (out of scope this run)

## Acceptance criteria
1. §5 "Use filters to focus" describes: each active filter appears as a removable chip near the
   toolbar; each chip has its own clear affordance; a "Clear all filters" action appears once
   any filter is active.
2. The existing five-filter list (Status, Priority, Assignee, Due date, Labels) is preserved,
   not replaced.
3. No new page created; no `docs.json` edit.
4. Follows the repo's existing `.mdx` house style (frontmatter unchanged, heading level and
   numbering scheme matched, no invented terminology not present in the UI).
5. No claim in the new text is falsifiable against `apps/web/src/components/board/
   board-toolbar.tsx` or `apps/web/src/hooks/use-task-filters.ts` as they exist on this branch.
6. No mention of WIP limits or hours rollup anywhere in the diff.

## Non-goals
- Documenting WIP limits or hours rollup (unmerged, out of scope this run).
- Adding a "Board features" section to the root README (repo convention is `apps/docs`).
- Creating a new `apps/docs` page (enrichment of an existing section, not a new one).
- Any code change. This is documentation-only.

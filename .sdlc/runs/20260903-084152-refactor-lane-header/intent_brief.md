# Intent Brief — refactor — Extract ColumnHeader from Column

## Context

The requested `Lane`/`LaneHeader` terminology maps to Kaneo's existing `Column`/`ColumnHeader` components under `apps/web/src/components/kanban-board/column/`. Initial discovery shows that `Column` already composes a separate `ColumnHeader`.

## Goal

Ensure all header-specific rendering and behavior is extracted from `Column` into `ColumnHeader`, while preserving behavior exactly. If inspection confirms the extraction is already complete, make no source changes.

## Files in scope

- `apps/web/src/components/kanban-board/column/index.tsx`
- `apps/web/src/components/kanban-board/column/column-header.tsx`
- `apps/web/src/components/kanban-board/column/column-header.test.tsx` only if focused coverage is needed
- `.gitignore` only if approved at Gate 0 for the missing `.sdlc/` entry

## Files off-limits

- All other application and package source files
- Existing AI configuration: `AGENTS.md`, `CLAUDE.md`, `.agents/**`, `.claude/**`, `.codex/**`, `.cursor/**`
- Environment files and secrets
- Generated/build/dependency directories
- `.git/**` and `.sdlc/local/**`

## Acceptance criteria

1. `Column` owns only its container layout, dropzone state, `ColumnHeader` composition, and `ColumnDropzone` composition.
2. `ColumnHeader` owns the icon, name, task count, permission-gated actions, modal state, archive behavior, store update, translations, and toast behavior.
3. Visual styling, accessibility, focus/event behavior, permissions, task creation, archiving, and drag-and-drop behavior remain identical.
4. Existing `Column` terminology is retained; no rename to `Lane` is introduced.
5. If criteria 1 and 2 already hold, the implementation is a no-op.
6. Any source change is verified with focused web tests and the affected package typecheck; the full web suite remains the refactor invariant when dependencies are available.

## Non-goals

- UI redesign or styling changes
- Translation or permission changes
- API, database, events, realtime, or store architecture changes
- Broader kanban-board cleanup
- Renaming `Column` to `Lane`

# Intent Brief — refactor — Extract lane header responsibility

## Context

The requested `Lane`/`LaneHeader` terminology does not exist in the current checkout. Kaneo models board lanes as columns. `Column` is implemented in `apps/web/src/components/kanban-board/column/index.tsx`, and its header behavior is already delegated to the separate `ColumnHeader` component in `column-header.tsx`.

## Goal

Confirm and, only if requirements analysis finds a remaining header responsibility inside `Column`, complete the behavior-preserving extraction into the existing `ColumnHeader`. Do not rename the established column vocabulary merely to introduce `LaneHeader`.

## Files in scope

- `apps/web/src/components/kanban-board/column/index.tsx`
- `apps/web/src/components/kanban-board/column/column-header.tsx`
- `apps/web/src/components/kanban-board/column/column-header.test.tsx` (new, only if a focused regression test is warranted)

## Files off-limits

- Project defaults from `.sdlc/project.json`
- Detected AI/agent configuration: `AGENTS.md`, `CLAUDE.md`, `.agents/**`, `.claude/**`, `.codex/**`, `.cursor/**`
- All unrelated application files

## Acceptance criteria

1. `Column` contains no header-specific state, actions, permissions, modal coordination, or presentation beyond rendering the extracted header boundary.
2. Existing header appearance and behavior remain identical, including icon/name/count, create-task permission handling, final-column archive handling, translations, toast, and modal behavior.
3. Drag/drop and dropzone state behavior remain unchanged.
4. The affected web package typecheck and focused tests pass.
5. If the extraction is already complete, make no source change and report that conclusion with verification evidence.

## Non-goals

- Rename `Column`/`ColumnHeader` to `Lane`/`LaneHeader` across the application.
- Change styling, copy, permissions, archive semantics, task creation, state management, or APIs.
- Refactor unrelated board components.

# Kanban Column Header Refactor — Requirements

## Terminology

The approved request’s **Lane/LaneHeader** terms map to this repository’s existing **Column/ColumnHeader** terminology. Source identifiers and user-visible terminology must not be renamed as part of this work.

## 1. In scope

1. Inspect `apps/web/src/components/kanban-board/column/index.tsx` and `column-header.tsx` to confirm header responsibilities.
2. Extract header behavior from `Column` into `ColumnHeader` only if such responsibility remains in `Column`.
3. Make no source change when inspection confirms the extraction is already complete.
4. Optionally add or update the focused `column-header.test.tsx` only when needed to prove preserved behavior.

## 2. Out of scope

1. Renaming Column/ColumnHeader to Lane/LaneHeader.
2. Visual redesign, translation changes, permission-policy changes, or drag-and-drop changes.
3. Changes outside the approved column files and optional focused test.
4. Changes to API contracts, database schema, events, project-store design, or unrelated board components.

## Functional requirements

- **FR-1:** `Column` must retain lane-container, dropzone-over state, layout wrapper, `ColumnHeader` composition, and `ColumnDropzone` responsibilities.
- **FR-2:** `ColumnHeader` must own header rendering: icon, column name, and task count.
- **FR-3:** `ColumnHeader` must retain existing permission-gated controls.
- **FR-4:** `ColumnHeader` must retain create-task and archive-dialog state and rendering.
- **FR-5:** Archiving must retain its existing mutation, project-store update, translation-backed labels, and toast behavior.
- **FR-6:** Drag-and-drop behavior must remain unchanged.
- **FR-7:** If `Column` contains no header action, modal, permission, or header-rendering responsibility beyond composing `ColumnHeader`, the required outcome is a no-op: do not modify source files.

## Non-functional requirements

- **NFR-1:** Preserve current UI structure, styling, accessibility behavior, and localized copy.
- **NFR-2:** Preserve existing authorization boundaries; UI visibility must continue to use existing permission checks.
- **NFR-3:** Do not introduce new personal data collection, logging, transmission, or storage.
- **NFR-4:** Keep the change minimal and limited to approved files.
- **NFR-5:** Verify with the smallest focused test or typecheck appropriate to any actual change.

## PII inventory

| Data element | Location/use | Classification | Requirement |
|---|---|---|---|
| Column name | Header display | Workspace content; may contain incidental personal data | Render as before; do not log or export it. |
| Task count | Header display | Non-PII aggregate workspace metadata | Preserve display behavior. |
| Current-user permissions | Control visibility | Authorization metadata, not direct PII | Preserve checks; do not expose new data. |
| Archive/create action state | Component-local UI state | Non-PII transient state | Keep local and unchanged. |

## Role matrix

| User capability | View header metadata | Create-task control/dialog | Archive control/dialog | Archive mutation/store update |
|---|---:|---:|---:|---:|
| User with existing create-task permission only | Yes | Yes | No | No |
| User with existing archive-column permission only | Yes | No | Yes | Yes |
| User with both existing permissions | Yes | Yes | Yes | Yes |
| User with neither permission | Yes | No | No | No |

## Acceptance criteria

1. Inspect `column/index.tsx`; verify it owns only the column container/dropzone state and composition, with no header action, modal, permission, or archive state.
2. Inspect `column-header.tsx`; verify it owns icon, name, task count, permission checks, create-task state, archive state, archive mutation, project-store update, translations, toast, and both dialogs.
3. When criteria 1 and 2 are true, produce no source changes.
4. If any header responsibility remains in `Column`, move only that responsibility to `ColumnHeader` without changing rendered UI, localized strings, permission outcomes, dialogs, toast behavior, project-store update, or drag-and-drop behavior.
5. Confirm changed files, if any, are limited to `column/index.tsx`, `column-header.tsx`, and optionally `column-header.test.tsx`.
6. Run an appropriate focused verification for any actual source or test change and confirm it passes.

## Open questions

1. None for the approved scope. The supplied discovery evidence indicates the required extraction is already complete, so the expected implementation outcome is no-op unless current-file inspection contradicts that evidence.

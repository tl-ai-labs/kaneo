# Requirements — Kanban Column Header Refactor

## 1. In scope

1. Verify that `Column` delegates all header rendering and header behavior to `ColumnHeader`.
2. Retain `Column` ownership of dropzone-over state, container classes, and `ColumnDropzone` composition.
3. Retain `ColumnHeader` ownership of header UI, controls, modal state, archive behavior, store updates, translated copy, toast feedback, and related modals.
4. Make changes only to `apps/web/src/components/kanban-board/column/index.tsx`, `column-header.tsx`, and, if needed, `column-header.test.tsx`.
5. Apply the approved no-op rule: if this separation already exists, make no implementation changes.

## 2. Out of scope

1. API, database, realtime, event, WebSocket, MCP, or integration changes.
2. Translation-key or user-facing copy changes.
3. Styling, layout, accessibility, permission-model, drag-and-drop, or broader cleanup changes.
4. Renaming Column concepts to Lane or changing unrelated Kanban components.

## Functional requirements

- **FR-1:** `Column` shall compose `ColumnHeader` using the current column input while preserving its existing wrapper and dropzone composition.
- **FR-2:** `ColumnHeader` shall render the current column icon, name, and task count exactly as before.
- **FR-3:** `ColumnHeader` shall preserve permission-gated visibility and availability of create-task and archive controls.
- **FR-4:** `ColumnHeader` shall preserve create-task and archive modal state and rendering, including `CreateTaskModal` and `ArchiveTasksModal`.
- **FR-5:** Archiving shall preserve its current mutation, project-store update, translated toast feedback, and resulting visible state.
- **FR-6:** The refactor shall preserve current drag/drop behavior and the column dropzone's visual state.
- **FR-7:** When the existing ownership split satisfies FR-1 through FR-6, the implementation shall be a no-op.

## Non-functional requirements

- **NFR-1:** Preserve existing DOM structure, layout, styling classes, accessible names, keyboard behavior, and focus behavior.
- **NFR-2:** Preserve existing permission enforcement and avoid introducing client-side authorization changes.
- **NFR-3:** Do not add network calls, state stores, dependencies, translation keys, or runtime work.
- **NFR-4:** Keep the change limited to the approved file allowlist; unrelated working-tree changes must remain untouched.

## PII inventory

| Data element | Source | Processing in this refactor | Storage/transmission change |
| --- | --- | --- | --- |
| Column name | Existing column data | Existing display only | None |
| Task count | Existing column/task data | Existing display only | None |
| User permission state | Existing client permission context | Existing control gating only | None |
| User-generated task/archive inputs | Existing modal flows | Existing handling only | None |

## Role matrix

| Actor | View header | Create task control | Archive control | Expected result |
| --- | --- | --- | --- | --- |
| User with the existing create-task permission | Yes | Available | Per existing archive permission | Existing behavior unchanged |
| User with the existing archive permission | Yes | Per existing create permission | Available | Existing behavior unchanged |
| User without a required permission | Yes, as currently allowed | Hidden or disabled as currently implemented | Hidden or disabled as currently implemented | No capability expansion |

## Acceptance criteria

1. Render an existing board and verify that each column still displays the same icon, name, task count, header controls, container layout, and dropzone.
2. Inspect `index.tsx` and verify that it owns only column container/dropzone concerns and composes `ColumnHeader` for the header.
3. Inspect `column-header.tsx` and verify that it owns all header rendering, permission-gated controls, modal state, archive mutation flow, store update, translated labels/toast, and the two existing modals.
4. With each relevant permission combination, verify that create-task and archive controls have the same visibility and behavior as before.
5. Open, cancel, and complete both create-task and archive flows; verify existing modal behavior, mutation outcome, store update, and toast feedback remain unchanged.
6. Keyboard-navigate the header controls and verify existing accessible names, focus behavior, and modal interaction are unchanged.
7. Drag over and out of a column, then drop a task; verify the current dropzone-over visual state and drop behavior are unchanged.
8. Verify no API, schema, migration, permission, translation, styling, realtime, or unrelated files changed.
9. If the supplied current-responsibility summaries are confirmed in source, verify the implementation diff contains no source changes.

## Open questions

1. None. The approved Gate 0 scope defines the extraction as already complete when the stated ownership split is present; that condition requires a no-op.

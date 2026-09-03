# Change Plan — Kanban Column Header Refactor

## Files added

None. The extraction reuses the existing `column-header.tsx` module when it already contains the header responsibility.

## Files edited

- `column/index.tsx` — `patch_apply`: inspect the existing composition; make no change when it already renders `ColumnHeader` and retains the column container and dropzone state. Otherwise, perform only the minimal header-composition extraction.
- `column-header.tsx` — `patch_apply`: make no change when the module already owns all current header responsibility. Otherwise, move only header-local rendering and callbacks from `column/index.tsx`, preserving props and behavior exactly.
- `column-header.test.tsx` — `patch_apply`, optional: add or adjust a focused component test only if an existing focused test location is already available within the allowlist.

## Files removed

None.

## Testing surface — preserved invariants

The focused test coverage and full existing suite must preserve these invariants:

- `Column` remains responsible for its container markup, sortable/dropzone wiring, and all drag-and-drop state.
- `ColumnHeader` receives and renders the same header data, controls, callbacks, and dialog triggers as before.
- Existing visual styling, terminology, translations, permissions and capability checks remain unchanged.
- Archive behavior and all header actions produce the same state transitions and side effects.
- No API, request shape, response shape, or server behavior changes.
- Extracting the header adds no new wrapper that alters layout, accessibility semantics, focus behavior, or event propagation.

## Cross-cutting sequencing

1. Inspect `column/index.tsx` and `column-header.tsx` together to confirm whether extraction is already complete.
2. If `Column` already composes `ColumnHeader` while retaining container and dropzone ownership, execute a no-op.
3. Only when header responsibility remains embedded in `column/index.tsx`, apply the smallest extraction into `column-header.tsx`.
4. Run the focused test when present or added, then the affected web-package validation appropriate to the changed files.

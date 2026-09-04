# Change plan

## Files added

- None by default. Add `column/column-header.test.tsx` only if focused coverage is needed and the existing test setup supports it.

## Files edited

- `column/index.tsx` — `patch_apply`: if `Column` already composes `ColumnHeader` and retains container/dropzone state, make no source change. Otherwise, extract only header presentation and callbacks.
- `column/column-header.tsx` — `patch_apply`: retain or receive header presentation and inputs without terminology, styling, permission, dialog, archive, state, API, or drag/drop changes.
- `column/column-header.test.tsx` — optional `patch_apply`: assert the header boundary only when needed.

## Files removed

- None.

## Data-layer changes

- None.

## API contract changes

- None.

## Framework-owned wiring

- None. `ColumnHeader` remains composed by `Column`.

## Config schema — environment variables added

- None.

## Testing surface

The full test suite must preserve these invariants:

- `Column` continues to own its container and dropzone state.
- Existing styling, terminology, permissions, dialogs, archive behavior, state transitions, API interactions, and drag/drop behavior remain unchanged.
- If the current source already satisfies the extraction boundary, verification confirms the no-op rather than manufacturing a change.

## Off-limits reminders

- Do not edit outside `column/index.tsx`, `column/column-header.tsx`, and optional `column/column-header.test.tsx`.
- This refactor does not require `.gitignore` or any AI/configuration file changes.

## Cross-cutting sequencing

1. Inspect `column/index.tsx` and `column/column-header.tsx`.
2. If the extraction exists, stop with a no-op and verify invariants.
3. Otherwise perform the smallest paired surgical extraction.
4. Add focused coverage only if needed, then run the relevant verification.

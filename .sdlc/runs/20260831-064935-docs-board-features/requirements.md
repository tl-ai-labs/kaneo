<!--
run_id: 20260831-064935-docs-board-features
phase: requirements_analysis (intent-specific: scoped "what docs?")
model: gemini-3.7-flash via antigravity-worker (policy flash-agsdk-only, rule 0)
packet: tp_requirements_001 | cost_usd: 0.195071 | latency_ms: 118660
Body below is the phase output verbatim. Orchestrator verified every cited
file:line against the working tree before accepting; see VERIFICATION at end.
-->

# Requirements Specification — Enrich "Use filters to focus" Documentation

## 1. In Scope
- Update section `## 5. Use filters to focus` in `apps/docs/core/functional/plan-and-execute-tasks.mdx`.
- Document the active filter chip UI behavior rendered in the board toolbar:
  - Filter chips appear adjacent to the Filter dropdown and Sort control when filters are active.
  - Chip layout structure: Subject, Operator (`is any of` or `include any of`), Value (specific label/name or count with optional stacked icons/avatars), and an individual clear button (`X`).
  - Specific chip behaviors for all five supported filter types (Status, Priority, Assignee, Due date, Labels).
  - Per-chip clearing via the remove button on each chip.
  - Global clearing via the "Clear all filters" action inside the Filter dropdown menu when any filter is active.
- Preserve the existing five-filter list and closing guidance sentence in section 5.

## 2. Out of Scope
- Any edits outside section 5 of `apps/docs/core/functional/plan-and-execute-tasks.mdx`.
- Creating new documentation files or modifying `apps/docs/docs.json`.
- Editing `README.md` or any source code files under `apps/web/src/**`.
- Documenting or referencing WIP limits or hours rollup.

## 3. Functional Requirements

### FR-1: Active Filter Chip Placement and Structure
- **FR-1.1**: When any filter criterion has active selections, a corresponding removable filter chip (`ActiveFilterChip`) MUST be displayed in the board toolbar alongside the Filter dropdown menu (`board-toolbar.tsx:534-643`).
- **FR-1.2**: Each chip MUST be documented as having distinct sections separated by dividers: Subject, Operator, Value, and a Clear button (`board-toolbar.tsx:91-106`).

### FR-2: Filter Chip Value and Operator Display
- **FR-2.1 (Status Chip)**: When status filters are active, the chip MUST display subject `Status`, operator `is any of`, stacked status icons (up to 3), and either the column status name (if 1 status selected) or `{count} selected` (if multiple statuses selected) (`board-toolbar.tsx:534-557`, `i18n/en-US.json:1842,1849`).
- **FR-2.2 (Priority Chip)**: When priority filters are active, the chip MUST display subject `Priority`, operator `is any of`, stacked priority icons (up to 3), and either the priority label (if 1 priority selected) or `{count} selected` (if multiple priorities selected) (`board-toolbar.tsx:560-583`, `i18n/en-US.json:1843,1849`).
- **FR-2.3 (Assignee Chip)**: When assignee filters are active, the chip MUST display subject `Assignee`, operator `is any of`, stacked user avatars (up to 3), and either the assignee user name (if 1 assignee selected) or `{count} selected` (if multiple assignees selected) (`board-toolbar.tsx:585-607`, `i18n/en-US.json:1844,1849`).
- **FR-2.4 (Due Date Chip)**: When due date filters are active, the chip MUST display subject `Due date`, operator `is any of`, and either the timeframe label (`Due this week`, `Due next week`, `No due date` if 1 selected) or `{count} selected` (if multiple selected) without stacked icons (`board-toolbar.tsx:609-632`, `i18n/en-US.json:1845,1849`).
- **FR-2.5 (Labels Chip)**: When label filters are active, the chip MUST display subject `Labels`, operator `include any of` (distinct from `is any of`), and the value format `{count} selected` (`board-toolbar.tsx:634-643`, `i18n/en-US.json:1846,1850`).

### FR-3: Filter Dismissal and Clearing Controls
- **FR-3.1 (Per-chip Clear)**: Clicking the clear affordance (`X` button) on an individual chip MUST reset only that specific filter criterion to null/empty (`board-toolbar.tsx:101-105,555,581,605,630,641`).
- **FR-3.2 (Global Clear)**: The "Clear all filters" action MUST be documented as physically residing inside the Filter dropdown menu, appearing at the bottom of the menu only when `hasActiveFilters` is true (`board-toolbar.tsx:518-527`, `i18n/en-US.json:14`).

## 4. Non-Functional Requirements
- **NFR-1 (House Style Alignment)**: Content must conform to the repository's `.mdx` style (concise descriptive prose, standard markdown lists, exact terminology matching UI strings in `i18n/en-US.json`).
- **NFR-2 (Accuracy & Falsifiability)**: No statement in the documentation shall contradict the implementation in `board-toolbar.tsx` or `use-task-filters-with-labels-support.ts`.
- **NFR-3 (Scope Constraint)**: Target file frontmatter, title, description, and other numbered sections (1, 2, 3, 4, 6, Next) must remain unmodified.

## 5. Acceptance Criteria
- [ ] Section `## 5. Use filters to focus` describes that active filters appear as chips in the toolbar.
- [ ] Each chip is documented with its clear button for individual removal.
- [ ] The global "Clear all filters" action inside the Filter dropdown menu is documented.
- [ ] The five filter types and their specific chip behaviors (including operator differences and single vs multiple count display) are accurately represented.
- [ ] The original list of 5 filters and the closing guidance sentence are preserved.
- [ ] No changes to `apps/docs/docs.json`, `README.md`, or any files under `apps/web/src`.
- [ ] No mention of WIP limits or hours rollup.

## 6. Open Questions
- None. Scope and implementation details are fully verified against the source code.

---

## VERIFICATION (orchestrator, independent of the phase)

Every fact below was re-derived by the orchestrator from the working tree at
5d1fc910 before Gate 1, not taken on the phase's word.

| Claim | Verified | Evidence |
|---|---|---|
| Status/Priority/Assignee/Due date chips name the value only when exactly one is selected, else `{{count}} selected` | YES | ternary `length === 1 ? <name> : t("tasks:boardFilters.selectedCount")` in all four blocks |
| Labels chip is UNCONDITIONALLY a count, never a name | YES | `value={t("tasks:boardFilters.selectedCount", { count: filters.labels.length })}` — no ternary |
| "Clear all filters" is a `DropdownMenuItem` INSIDE the filter dropdown, gated on `hasActiveFilters` | YES | board-toolbar.tsx:517-527, inside `DropdownMenuContent` |
| Chip clear is per-FIELD, not per-value | YES | four fields call `updateFilter(<field>, null)`; Labels calls `clearLabelFilters()` |
| `clearLabelFilters()` loops `updateLabelFilter()` per selected label rather than one null write | YES | `for (const labelId of filters.labels) updateLabelFilter(labelId)` |
| Operators differ: `is any of` (4 fields) vs `include any of` (Labels) | YES | `operators.isAnyOf` / `operators.includeAnyOf` in i18n |
| Stacked icons cap at 3 | YES | `items.slice(0, 3)` in `StackedIcons`; Due date chip passes no `StackedIcons` |
| i18n keys exist as cited | YES | `common.actions.clearAllFilters`, `tasks.boardFilters.{selectedCount,subjects,operators}` |
| Board route uses `useTaskFiltersWithLabelsSupport`, not `useTaskFilters` | YES | board.tsx:19,166 — phase caught this; the brief's AC-5 names the other hook |

No claim in this requirements document was found falsifiable against the source.

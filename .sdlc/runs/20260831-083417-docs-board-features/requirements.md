# Requirements — Document the active-filter-chip UI in "5. Use filters to focus"

- **Module:** docs-board-filters
- **Change type:** documentation-only (no code, no schema, no configuration)
- **Target file:** `apps/docs/core/functional/plan-and-execute-tasks.mdx`, section `## 5. Use filters to focus` only
- **Sole behavioural anchor:** `apps/web/src/components/board/board-toolbar.tsx` on the current branch, plus the exact user-visible strings in `i18n/en-US.json`

**Applicability note:** This is a documentation-only change to an existing `.mdx` page; it collects, stores, transmits and exposes no data and alters no permission boundary, so no PII inventory and no role/permission matrix apply and none is provided.

## In scope

1. Extend the body of `## 5. Use filters to focus` in `apps/docs/core/functional/plan-and-execute-tasks.mdx` so it describes the active-filter chips that the board toolbar renders for each of the five filter fields.
2. Preserve the existing bulleted five-filter list (Status, Priority, Assignee, Due date, Labels) verbatim and in its current order, adding to it rather than replacing it.
3. Describe the four visible segments of a chip (subject, operator, value, clear control) using only wording that appears in the shipped UI strings.
4. Describe, per field, exactly what the chip's value segment shows when one value is selected versus more than one.
5. State what a chip's `X` control clears, for all five fields.
6. State where the **Clear all filters** affordance lives and when it appears.
7. Keep the file's existing frontmatter, heading levels, section numbering and prose style unchanged apart from the section 5 body.

## Out of scope

1. Any change to `apps/web/**` or any other application code.
2. Any new documentation page, and any edit to `apps/docs/docs.json`.
3. Any edit to `README.md` or to AI configuration files.
4. Any edit to sections 1–4, 6, "Next", or the frontmatter of the target file.
5. Any mention of WIP limits or hours rollup.
6. Documenting the filter dropdown's own internals beyond the location of **Clear all filters** (the per-field submenus, the "All statuses"/"All priorities"/… reset rows, and the select-all label behaviour).
7. Documenting sorting, the Board/List view-mode toggle, or backlog filtering.
8. Adding screenshots, images or new i18n keys.
9. Any claim about filter persistence, URL state, or how filtering is applied to the task list — none of that is derivable from the supplied source.

## Functional requirements

**FR-1 — When a chip exists.** The docs must state that a chip is rendered for a field only while that field has at least one value selected, and that each of the five fields gets at most one chip. Source: each render site is guarded by a length check — `selectedStatusIds.length > 0` (L533), `selectedPriorityIds.length > 0` (L559), `selectedAssigneeIds.length > 0` (L584), `selectedDueDateFilters.length > 0` (L609), `filters.labels && filters.labels.length > 0` (L634).

**FR-2 — Chip location and order.** The docs must state that chips appear in the board toolbar itself, in the same left-hand row as the **Filter** button and the sort control, after them, and that the row wraps when it runs out of width (L256–258 flex-wrap container; chips rendered at L533–643, after the `DropdownMenu` closing at L529 and `SortControl` at L531). The docs must present the chips in their render order: Status, Priority, Assignee, Due date, Labels. The docs must NOT say chips appear on a separate row, in a separate bar, or below the toolbar.

**FR-3 — Chip anatomy.** The docs must describe a chip as four segments separated by dividers: subject, operator, value, and a clear (`X`) button (`ActiveFilterChip`, L85–108).

**FR-4 — Subject wording.** The docs must use the shipped subject strings exactly: **Status**, **Priority**, **Assignee**, **Due date**, **Labels** (`tasks.boardFilters.subjects.*`). Note that the due-date subject is rendered as "Due date" (lowercase "d"), matching the existing bullet list.

**FR-5 — Operator wording differs for Labels.** Status, Priority, Assignee and Due date chips use the operator **is any of** (`operators.isAnyOf`, L536/L562/L587/L612). The Labels chip uses **include any of** (`operators.includeAnyOf`, L637). The docs must state this difference explicitly and must not describe a single uniform operator.

**FR-6 — Value segment, per field.** The docs must describe the value segment field by field, because the five fields do not behave alike:

| Field | Icon preview in the value segment | Value text when exactly one value is selected | Value text when two or more are selected |
| --- | --- | --- | --- |
| Status | Yes — stacked status/column icons (L539–545) | The column's name (L547–548) | `N selected` (L549–551) |
| Priority | Yes — stacked priority icons (L565–570) | The priority's name (L572–573) | `N selected` (L574–576) |
| Assignee | Yes — stacked member avatars (L590–595) | The member's name (L597–598) | `N selected` (L599–601) |
| Due date | **No icons** (L613–629) | The chosen option's name: **Due this week**, **Due next week** or **No due date** (L614–625) | `N selected` (L626–628) |
| Labels | **No icons** (L638–640) | `N selected` — **always**, even for a single label (L638–640) | `N selected` |

**FR-6a** — The docs must call out that the Labels chip never names the selected label; it always shows the count, unlike the other four fields, which name the single selected value.

**FR-6b** — The docs must call out that the Due date chip shows no icon preview, unlike Status, Priority and Assignee.

**FR-6c** — Where the docs quote the multi-selection text, it must match `tasks.boardFilters.selectedCount` = `"{{count}} selected"`, rendered for a reader as e.g. "3 selected".

**FR-7 — Icon preview is capped at three.** If the docs mention the icon/avatar preview, they must state that at most three icons are shown regardless of how many values are selected (`items.slice(0, 3)`, `StackedIcons`, L121). The docs must not imply one icon per selected value.

**FR-8 — What the `X` clears.** For all five fields, the chip's `X` clears that field's entire selection, not one value — the chip disappears and every value selected for that field is removed. Sources: `updateFilter("status", null)` (L555), `updateFilter("priority", null)` (L580), `updateFilter("assignee", null)` (L605), `updateFilter("dueDate", null)` (L630), and for Labels `clearLabelFilters()` (L641), which loops over every id in `filters.labels` and toggles each one off (L249–252). The docs must state that the `X` never affects the other four fields' chips.

**FR-9 — Location of Clear all filters.** The docs must state that **Clear all filters** is not a standalone toolbar button and is not part of any chip: it is the last item inside the **Filter** dropdown menu, below a separator, and it is shown only while at least one filter is active (L517–527). The docs must state that it clears all filters at once (`clearFilters`, L521).

**FR-10 — Preserve existing content.** The existing bullet list of the five filters and the existing closing line ("Use filters aggressively during standups, planning, and triage.") must remain in section 5; new prose is added around/after them.

**FR-11 — Terminology discipline.** The docs must use only terms visible in the UI or already used on the page — "chip" or "filter chip" may be used as the descriptive noun for the control, but no invented product terminology (e.g. no "filter pill", "filter bar", "facet", "token", "filter tray") and no invented option names.

**FR-12 — No prohibited topics.** The diff must contain no mention of WIP limits or hours rollup.

**FR-13 — Scope of claims.** All new prose must be scoped to the board toolbar, matching the section's existing opening ("The board toolbar supports filtering by:"). The docs must not claim the chips appear in List view, in Backlog, or anywhere else, because the supplied source does not establish that.

## Non-functional requirements

**NFR-1 — Falsifiability.** Every behavioural sentence added must be checkable against `apps/web/src/components/board/board-toolbar.tsx` on this branch and against `i18n/en-US.json`. No sentence may depend on inference from other files.

**NFR-2 — House style.** Frontmatter unchanged; heading remains `## 5. Use filters to focus`; numbering scheme of the page unchanged; prose stays short, second person, imperative where instructional, matching sections 1–4.

**NFR-3 — MDX validity.** The page must remain valid MDX and must render without new components, imports or JSX. Only plain markdown constructs already used on the page (paragraphs, bullet lists, bold, ordered lists) plus, if needed, a simple markdown table.

**NFR-4 — Brevity.** The addition should be proportionate to the page — roughly 10–25 lines of new content; it is a user guide section, not an API reference.

**NFR-5 — i18n fidelity.** UI strings quoted in the docs must match `i18n/en-US.json` character for character ("Clear all filters", "is any of", "include any of", "Due this week", "Due next week", "No due date", "{{count}} selected" rendered with a number).

**NFR-6 — Diff hygiene.** Exactly one file changed. No reformatting of untouched lines, no trailing-whitespace churn, no reordering of existing bullets.

**NFR-7 — Accessibility of description.** The docs must not describe the chip's clear control by colour or position alone; refer to it as the chip's `X` (clear) control.

## Acceptance criteria

1. `git diff` touches exactly one file: `apps/docs/core/functional/plan-and-execute-tasks.mdx`. (FR-scope, NFR-6)
2. The frontmatter block and every heading in the file are byte-identical to the pre-change version. (NFR-2)
3. The bullets `- Status`, `- Priority`, `- Assignee`, `- Due date`, `- Labels` still exist in section 5, in that order, and the line "Use filters aggressively during standups, planning, and triage." is still present. (FR-10)
4. Section 5 states that a chip appears for a field only while that field has at least one selected value. (FR-1)
5. Section 5 states that chips appear in the board toolbar alongside the **Filter** button and the sort control — and does not describe them as a separate bar or row. (FR-2)
6. Section 5 describes a chip as showing a subject, an operator, a value, and an `X` control. (FR-3)
7. Section 5 states that Status, Priority, Assignee and Due date chips read **is any of**, while the Labels chip reads **include any of**. Grep: the added text contains both "is any of" and "include any of". (FR-5)
8. Section 5 states that for Status, Priority, Assignee and Due date, a single selection is shown by name, and two or more selections are shown as a count ("3 selected"). (FR-6)
9. Section 5 states that the Labels chip always shows a count and never names the label, even when one label is selected. (FR-6a)
10. Section 5 states that the Due date chip's single-selection value is one of **Due this week**, **Due next week**, **No due date**. (FR-6)
11. If the icon/avatar preview is mentioned, section 5 states it is capped at three icons, and does not attribute an icon preview to the Due date or Labels chips. (FR-6b, FR-7)
12. Section 5 states that a chip's `X` clears that whole filter field (all of its selected values) and leaves the other filters untouched — stated in a way that covers all five fields including Labels. (FR-8)
13. Section 5 states that **Clear all filters** is the last item inside the **Filter** dropdown menu, appears only when at least one filter is active, and clears every filter. The text must not place it next to the chips or describe it as its own toolbar button. (FR-9)
14. `grep -Ei 'wip|work in progress|hours' apps/docs/core/functional/plan-and-execute-tasks.mdx` returns no match introduced by this change. (FR-12)
15. No sentence in the added text asserts chip behaviour outside the board toolbar (List view, Backlog, task page). (FR-13)
16. Every quoted UI string in the added text appears verbatim in `i18n/en-US.json`. (NFR-5)
17. The added text introduces no MDX imports, components or JSX, and the page builds. (NFR-3)
18. No new page file exists under `apps/docs/`, and `apps/docs/docs.json` is unmodified. (Out of scope 2)
19. Reviewing the added text line by line against `board-toolbar.tsx` L85–108, L148–151, L249–252, L517–527 and L533–643 yields no statement that the source contradicts. (NFR-1)
20. The document contains no PII table and no role/permission matrix. (Applicability note)

## Open questions for HITL

1. **`hasActiveFilters` definition.** `hasActiveFilters` (which gates **Clear all filters**, L517) is a prop supplied by the caller; its definition was not part of the supplied source. If it can be true for something other than the five documented fields (for example a text search), the docs should say "when any filter is active" rather than enumerating. Recommended: keep the neutral phrasing "once at least one filter is active".
2. **List view.** `BoardToolbar` takes a `viewMode: "board" | "list"` prop and renders the view-mode toggle, which suggests the same toolbar — and therefore the same chips — is shown in List view. The route wiring was not supplied, so FR-13 keeps all claims scoped to the board toolbar. Confirm whether the docs may also state that chips appear in List view.
3. **Brief wording vs. code.** Gate 0 acceptance criterion 1 says a "Clear all filters" action "appears" once any filter is active; the code places it inside the **Filter** dropdown, not beside the chips. FR-9 follows the code. Confirm this is the intended reading of the brief.
4. **Edge-case fallbacks.** When a selected status id has no matching column the chip falls back to the raw id (L154–156), and an unresolved assignee falls back to a generic "unknown person" string (L167, key `common:people.unknown`, whose English text was not supplied). Recommendation: omit both from user documentation as internal fallbacks. Confirm.
5. **Localisation.** Only `en-US` strings were supplied, so all quoted labels are the English ones. Confirm no localised variants need mentioning.
6. **Naming the control.** The code names the component `ActiveFilterChip` but no user-visible string uses the word "chip". Confirm "filter chip" is acceptable descriptive prose for the docs, or supply the preferred term.

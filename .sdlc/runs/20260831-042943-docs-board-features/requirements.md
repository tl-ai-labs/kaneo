# Requirements — docs — Enrich §5 "Use filters to focus"

Run: `20260831-042943-docs-board-features` · Intent: `docs` · Task type: `doc_update`
Branch HEAD at analysis: `5d1fc910`

## Scope question this run answers

"What docs?" — exactly one section of exactly one file:
`apps/docs/core/functional/plan-and-execute-tasks.mdx` §5 "Use filters to focus".

## In scope

1. Extend §5 to describe the active-filter-chip UI that ships on this branch but is undocumented.
2. Preserve the existing five-item filterable-field list verbatim.
3. Preserve frontmatter, heading level (`##`), and the numbered-heading scheme (`## 5. …`).

## Out of scope

1. WIP limits — no implementation on `5d1fc910`; lives on unmerged `feature-extend-1/*`.
2. Hours rollup — no estimate field or column aggregation on `5d1fc910`; unmerged `feature-extend-2/*`.
3. `README.md` — repo convention for user-facing feature docs is `apps/docs` (Mintlify).
4. `apps/docs/docs.json` — no new page is created, so no nav registration is required.
5. Any file under `apps/web/src/**` — documentation-only change.

## Functional requirements

- **FR-1** — §5 states that each active filter is shown as a chip in the board toolbar.
- **FR-2** — §5 states each chip carries its own clear control that removes that filter.
- **FR-3** — §5 states a **Clear all filters** action becomes available once any filter is active.
- **FR-4** — The five filterable fields (Status, Priority, Assignee, Due date, Labels) remain listed.
- **FR-5** — The closing guidance sentence ("Use filters aggressively during standups, planning,
  and triage.") is retained; the new material does not displace it.

## Non-functional requirements

- **NFR-1** — Valid MDX; file parses and renders under Mintlify.
- **NFR-2** — Frontmatter (`title`, `description`) byte-identical to pre-run.
- **NFR-3** — House style: sentence-case prose, `**bold**` for literal UI labels (as §1 uses
  `**Create task**` and §6 uses `**Open in full page**`), `-` bullets, no invented terminology.
- **NFR-4** — Terminology limited to strings that exist in `i18n/en-US.json` or the component.

## Source-of-truth evidence (verified this run, on HEAD 5d1fc910)

| Claim | Evidence |
|---|---|
| Chip component exists | `board-toolbar.tsx:78-108` — `ActiveFilterChip({subject, operator, value, onClear})` |
| Chip has its own clear button | `board-toolbar.tsx:99-106` — `<button onClick={onClear}>` rendering an `X` icon |
| One chip per active filter category | `board-toolbar.tsx:534,560,585,610,635` — five conditional `ActiveFilterChip` renders |
| Chip clear resets that category | `onClear={() => updateFilter("status", null)}` etc. (`:555,580,605,630`), labels via `clearLabelFilters` (`:641`) |
| Chips sit in the toolbar row | Rendered after `<SortControl/>` (`:531`) inside the same toolbar flex container, closing at `:643` |
| "Clear all filters" gated on active filters | `board-toolbar.tsx:517-526` — `{hasActiveFilters && (… onClick={clearFilters} …)}` |
| Its label text | `i18n/en-US.json` → `common.actions.clearAllFilters` = `"Clear all filters"` |
| It lives in the filter dropdown | `:519-525` is a `DropdownMenuItem` after a `DropdownMenuSeparator`, inside `DropdownMenuContent` |
| Five filter subjects | `i18n/en-US.json` → `tasks.boardFilters.subjects` = Status, Priority, Assignee, Due date, Labels |
| Chip reads subject-operator-value | operators `isAnyOf` = "is any of"; labels chip uses `includeAnyOf` = "include any of" |
| Filters persist per project | `use-task-filters.ts:61,81-84` — `localStorage` key `kaneo:board-filters:<projectId>` |

## Precision constraints derived from the evidence

- **PC-1** — A chip represents one **filter category**, not one selected value. Clearing a chip
  drops that whole category (all its selected values), not a single value. Text must not imply
  per-value chips.
- **PC-2** — **Clear all filters** is an item **inside the filter dropdown menu**, not a standalone
  toolbar button. The brief's phrasing ("action becomes available") is accurate but under-specified;
  the doc should not imply a top-level button.
- **PC-3** — Per-project filter persistence (`localStorage`) is true and verified, but is **not**
  in the Gate-0 brief's goal statement. Flagged here as an optional inclusion for the operator to
  rule on at Gate 1; default is to **exclude** it to keep the diff to the frozen scope.

## Acceptance criteria

1. §5 describes chip rendering, per-chip clear, and the **Clear all filters** action.
2. The five-field list is present and unmodified.
3. `git diff` touches exactly one file and adds no new heading beyond §5's existing `## 5.`.
4. Frontmatter unchanged; file is valid MDX.
5. No sentence is falsifiable against `board-toolbar.tsx` or `use-task-filters.ts` on `5d1fc910`.
6. The strings "WIP", "work in progress", "rollup", "hours", and "estimate" appear nowhere in the diff.

## Open questions for HITL

- **Q1 (PC-3)** — Include the one-line fact that filters persist per project across reloads?
  It is verified and useful, but is an addition beyond the frozen brief's stated goal.
  **Recommended: no** — keep the diff minimal and exactly as scoped at Gate 0.
- **Q2 (PC-2)** — Should the doc name the filter dropdown as the location of **Clear all filters**?
  **Recommended: yes** — it is more accurate than "available" and costs one clause.

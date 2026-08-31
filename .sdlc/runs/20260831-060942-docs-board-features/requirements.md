# Requirements — docs run 20260831-060942-docs-board-features

**Intent:** `docs` · **Task type:** `doc_update` · **Policy:** `opus-only-v5` · **Auth mode:** `estimated`
**Target surface:** `apps/docs/core/functional/plan-and-execute-tasks.mdx` §5 "Use filters to focus"
**Repo state:** HEAD `5d1fc910`, branch `refactor/opus-flash`

## 1. In scope

1. Enrich the existing §5 "Use filters to focus" of `apps/docs/core/functional/plan-and-execute-tasks.mdx` with a description of the active-filter-chip UI that ships today but is undocumented.
2. Describe that each active filter renders as its own chip in the board toolbar, next to the filter control.
3. Describe that each chip carries its own clear affordance which clears that whole filter field, not one selected value.
4. Describe that a **Clear all filters** action becomes available inside the filter menu once any filter is active.
5. Preserve the existing five-item filterable-field list (Status, Priority, Assignee, Due date, Labels) verbatim.
6. Match the file's existing `.mdx` house style: frontmatter untouched, `##`-level numbered headings unchanged, no new heading added.

## 2. Out of scope

1. WIP limits — no shippable code or docs on this branch (lives on unmerged `feature-extend-1/*`). Must not appear anywhere in the diff.
2. Hours rollup / column-level estimate aggregation — no shippable code on this branch (unmerged `feature-extend-2/*`). Must not appear anywhere in the diff.
3. `README.md` — repo documentation convention for user-facing features is `apps/docs` (Mintlify); the root README is install/deploy only.
4. `apps/docs/docs.json` — no new page is created, so no nav registration is needed.
5. Any file under `apps/web/src/**` or any other code file. This run is documentation-only.
6. Filter persistence, sorting, view-mode switching, and label-filter application semantics — adjacent but not requested.

## 3. Functional requirements

Module: `docs/plan-and-execute-tasks`

- **FR-1** §5 states that each active filter appears as a separate chip in the board toolbar, next to the filter control.
- **FR-2** §5 states the chip's read-out shape as it actually renders: a subject, an operator, and a value — e.g. Status **is any of**, Labels **include any of**.
- **FR-3** §5 states the value-display rule **with its asymmetry intact** (see §5 Falsifiability traps, FT-1): a Status, Priority, Assignee, or Due date chip names the single selection when exactly one value is selected and otherwise shows a count; the Labels chip always shows a count.
- **FR-4** §5 states that each chip's clear control removes that entire filter field, not a single selected value.
- **FR-5** §5 states that **Clear all filters** appears inside the filter menu only once at least one filter is active, and that it resets every filter at once.
- **FR-6** The existing five-item field list is preserved in place and in order; the enrichment is added around it, not in place of it.
- **FR-7** The closing line "Use filters aggressively during standups, planning, and triage." is preserved (it is the section's existing call to action).

## 4. Non-functional requirements

- **NFR-1** Frontmatter (`title`, `description`) byte-identical after the edit.
- **NFR-2** Heading level (`##`) and section numbering (1–6 plus "Next") unchanged; no §5.1 or new §7 introduced.
- **NFR-3** All user-facing labels quoted in the doc match `i18n/en-US.json` exactly (source of truth per AGENTS.md): `Status`, `Priority`, `Assignee`, `Due date`, `Labels`, `is any of`, `include any of`, `Clear all filters`, `{{count}} selected`.
- **NFR-4** No i18n key, component name, file path, or line number appears in user-facing docs prose — the docs describe the UI, not the implementation.
- **NFR-5** Prose voice matches the surrounding sections: imperative, second person, short sentences, no marketing adjectives.
- **NFR-6** Exactly one file is written by this run's packets.

## 5. Falsifiability traps (must be checked before writing, not after)

Every claim must be checkable against `apps/web/src/components/board/board-toolbar.tsx` and `apps/web/src/hooks/use-task-filters.ts` as they exist on this branch. Three specific ways a plausible-sounding sentence is false here:

- **FT-1 — "chips show the selected values" is FALSE as a blanket statement.** Verified at `board-toolbar.tsx:532-643`. Status, Priority, Assignee and Due date chips render the selection's name **only when exactly one value is selected** (`selectedStatusIds.length === 1 ? getStatusDisplayName(...) : t("tasks:boardFilters.selectedCount", ...)`); with two or more they collapse to "N selected". The **Labels chip is unconditionally a count** (`value={t("tasks:boardFilters.selectedCount", { count: filters.labels.length })}`) — it never renders a label's name, not even for a single label. Do not write "shows the selected values", "lists what you picked", or any wording that implies the values are always readable off the chip.
- **FT-2 — "Clear all filters" is not a toolbar button.** Verified at `board-toolbar.tsx:517-526`. It is a menu item inside the filter dropdown, rendered after a separator and gated on `hasActiveFilters`. Do not describe it as a button beside the chips or as always visible.
- **FT-3 — a chip's clear control is per-field, not per-value.** Verified at `board-toolbar.tsx:555, 580, 605, 630, 641`: `onClear` is `updateFilter("<field>", null)` for the four scalar fields, and `clearLabelFilters` (which unselects every selected label) for Labels. Clearing the Status chip while three statuses are selected removes all three. Do not write "remove a value" or "drop one selection".

Secondary facts that are true and may be used: the operator text differs between fields (`is any of` for Status/Priority/Assignee/Due date, `include any of` for Labels), and the Status, Priority and Assignee chips render small stacked icons or avatars alongside the text.

## 6. PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| (none) | — | This run writes documentation prose only. No user data, credential, endpoint, or workspace identifier is read or emitted. The Assignee chip is described generically ("the assignee's name"); no real member name is quoted. |

## 7. Role matrix

| Role | Resource | Action |
|---|---|---|
| (n/a) | `apps/docs/core/functional/plan-and-execute-tasks.mdx` | Documentation-only change. No API surface, no permission vocabulary, no `requireWorkspacePermission` call site is touched. The documented filter UI is client-side view state (`useTaskFilters`) and grants no access a viewer does not already have. |

## 8. Acceptance criteria

1. §5 describes: each active filter appears as a removable chip in the board toolbar; each chip has its own clear affordance; a "Clear all filters" action appears once any filter is active.
2. The five-filter list (Status, Priority, Assignee, Due date, Labels) is preserved, not replaced.
3. No new page created; `apps/docs/docs.json` unmodified.
4. Frontmatter unchanged; heading level and numbering scheme matched; no terminology absent from the UI.
5. No claim in the new text is falsifiable against `board-toolbar.tsx` or `use-task-filters.ts` on this branch — specifically, FT-1, FT-2 and FT-3 above are each satisfied by the written prose.
6. No mention of WIP limits or hours rollup anywhere in the diff.
7. `git diff --stat` shows exactly one changed file, `apps/docs/core/functional/plan-and-execute-tasks.mdx`, with no deletions to lines 1-54 other than the intentional §5 edit.

## 9. Verification plan

`apps/docs` is Mintlify content with no `package.json`, no test runner, and no lint target of its own; the repo's Biome config does not cover `.mdx` prose. **There is therefore no meaningful automated test for this change, and that is correct rather than an omission** — asserting otherwise would mean inventing a test harness the repo has deliberately not adopted. Verification is instead:

1. Structural diff review — `git diff` confirms one file, §5 only, frontmatter and other sections untouched.
2. Claim-by-claim recheck of each new sentence against `board-toolbar.tsx` and `use-task-filters.ts`, with FT-1/FT-2/FT-3 checked explicitly.
3. Label strings cross-checked against `i18n/en-US.json`.

## 10. Open questions for HITL

None. The one genuine scope question — "the requested feature set does not exist on this branch; what should actually be documented?" — was resolved at Gate 0: filter chips only, by enriching §5.

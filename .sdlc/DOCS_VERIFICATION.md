# Filter Chip Docs Audit

**Verification of the `docs-board-filter-chips` brief across four model policies.**

Four model policies each wrote the same documentation patch. All four passed a line-by-line
fact-check against the board toolbar source. They differ in depth, not in accuracy.

| | |
|---|---|
| **Brief** | `docs-board-filter-chips` |
| **Target** | `apps/docs/core/functional/plan-and-execute-tasks.mdx` |
| **Base** | `5d1fc910` (merge-base for all four branches) |
| **Verified** | 3 Sep 2026 |

---

## Verdict

| Metric | Result | |
|---|---|---|
| Runs that shipped the edit | **4 / 4** | Target file only, nothing else in `apps/` |
| False claims | **0** | Across all four diffs |
| Acceptance criteria met | **6 / 6** | By every run |
| Defects found | **1** | Stylistic, one run |

---

## What the source actually does

Ground truth read from `board-toolbar.tsx` (676 lines), `use-task-filters.ts`,
`sort-control.tsx`, and `i18n/en-US.json` on `main`. Every claim in the four diffs was checked
against this.

| Behavior | Where it lives |
|---|---|
| Chip is subject │ operator │ value │ X — four segments, 1px dividers | `board-toolbar.tsx:85-106` |
| Chips render after the Filter menu and sort control, in a wrapping row | `board-toolbar.tsx:258, 532` |
| Order: Status → Priority → Assignee → Due date → Labels; one chip per field | `board-toolbar.tsx:532-641` |
| Operators `is any of` / `include any of` (Labels) | `en-US.json:1848-1851` |
| Icon preview caps at three — `items.slice(0, 3)` | `board-toolbar.tsx:121` |
| Due date and Labels chips render no icons; the other three do | `board-toolbar.tsx:610, 635` |
| One value → name; two or more → `{{count}} selected`. Labels always a count | `board-toolbar.tsx:548, 641` |
| Chip X clears the whole field, never one value | `updateFilter(key, null)` · `clearLabelFilters` |
| Clear all filters — last menu item, after a separator, gated on active filters | `board-toolbar.tsx:517-526` |
| Labels group by name + color, so one menu entry can add several ids | `toggleLabelGroup` · `board-toolbar.tsx:233` |

---

## Claim coverage by policy

Columns run left to right by diff size. Every ✓ is a claim that is true of the code as it exists
on `main` — a dash means the run did not make the claim, never that it got it wrong.

| Claim | opus-flash<br>+4 | opus-only<br>+6 | flash-agsdk<br>+16 | opus-sonnet<br>+18 |
|---|:-:|:-:|:-:|:-:|
| Chip exists, one per filter field | ✓ | ✓ | ✓ | ✓ |
| Clears the whole field, not a single value | ✓ | ✓ | ✓ | ✓ |
| Clear all filters, in the Filter menu, gated on active state | ✓ | ✓ | ✓ | ✓ |
| Per-chip clear control named explicitly | *implied* | ✓ | ✓ | ✓ |
| Subject / operator / value structure | — | ✓ | ✓ | ✓ |
| Exact operator strings | — | ✓ | ✓ | ✓ |
| One value shows a name, several show a count | — | ✓ | ✓ | ✓ |
| Labels chip is always a count, never a name | — | ✓ | ✓ | ✓ |
| Due-date option names | — | — | ✓ | ✓ |
| Which fields show icons, which do not | — | — | ✓ | ✓ |
| Icon preview caps at three | — | — | ✓ | ✓ |
| Position relative to Filter and Sort | — | — | ✓ | ✓ |
| Chip ordering across the five fields | — | — | — | ✓ |
| The chip row wraps | — | — | — | ✓ |
| Label name + color grouping can inflate the count | — | — | — | ✓ |
| **False claims** | **0** | **0** | **0** | **0** |

Legend: **✓** claim made and verified true · **—** claim not made · ***implied*** behavior
gestured at, control not named.

---

## The one defect

**Stylistic · `docs/opus-sonnet` · New prose lands after the section's closing line**

The other three runs inserted their text directly beneath the five-filter list. `opus-sonnet`
inserted after the sentence that closes the section:

> Use filters aggressively during standups, planning, and triage.

Three paragraphs of chip mechanics now follow that wrap-up line, immediately before the `## 6.`
heading. The content is still inside §5 and acceptance criterion 4 (heading level and numbering
matched) is met, so this is a reading-order problem rather than a structural one. It is a
one-line fix in the `.mdx`.

---

## How each run read

### `opus-plus-flash-v37` — +4 lines · $0.64 · Thin

Accurate but minimal. Names the chip, the one-chip-per-field rule, and Clear all filters. It
never names the per-chip clear control, only saying "clearing it" — which leaves acceptance
criterion 1 ("each chip has its own clear affordance") satisfied by implication rather than by
statement.

### `opus-only-v5` — +6 lines · $0.53 · Best fit

Covers all six acceptance criteria in three paragraphs. States the operator strings, the
name-versus-count rule, the Labels exception, and the per-chip clear semantics with a worked
example. Asserts nothing that a restyle would falsify — no icon counts, no layout geometry.

### `flash-agsdk-only` — +16 lines · $1.04 · Exhaustive

Every claim verified, including the three-icon cap and which fields render icons. Explicitly
corrects two likely misreadings ("It is not a per-value control", "It is not a standalone button
on the toolbar"), which is genuinely useful. Long for a user-facing page, and pins down
presentation detail that will drift.

### `opus-plus-sonnet-max` — +18 lines · $2.84 · Deepest read

The only run to catch the label-grouping subtlety: because `toggleLabelGroup` selects every id
sharing a name and color, picking one Labels entry can produce a count above one. That is real,
non-obvious, and correctly stated. It also documents chip ordering and row wrapping — accurate,
but CSS-level detail in a user guide. Carries the placement defect above.

---

## What we take from this

**Recommendation: ship `docs/opus-only`.** It clears every acceptance criterion, states the
clear-control behavior outright, and stops before the presentation detail that will need
re-verifying after the next toolbar restyle. It was also the cheapest run in the set at $0.53.

Worth lifting from `opus-sonnet` before merge: one sentence on the Labels count, since a user
seeing "2 selected" after picking a single label has no other explanation available.

- **Accuracy did not track cost or depth.** A 5.4× spend spread and a 4.5× length spread produced
  zero difference in correctness. All four runs read the source correctly.
- **Depth carries its own cost.** The two longest runs are accurate today and brittle tomorrow —
  icon caps and row-wrap behavior are styling, and styling moves.
- **Scope discipline held everywhere.** No run created a page, touched `docs.json`, edited
  `README.md`, entered `apps/web/**`, or mentioned the out-of-scope WIP-limit and hours-rollup
  features.
- **The gap review missed is editorial, not factual.** Reviewers verified every claim and did not
  catch that one run's text sits after its section's closing sentence.

---

## Method

Each branch diffed against `main` at merge-base `5d1fc910`. Every assertion in the four diffs was
traced to a specific line in `board-toolbar.tsx`, `use-task-filters.ts`, `sort-control.tsx`, or
`i18n/en-US.json`. UI terms "Filter", "Sort", and "Clear all filters" were confirmed against
rendered i18n strings.

**Not covered here.** Mintlify render of the edited `.mdx` was not checked, and the refactor and
three feature-extend briefs are still pending verification.

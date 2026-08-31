# Senior review — run 20260831-083417-docs-board-features

**Reviewer model:** claude-opus-5 (rule_index 3, "Cross-file reasoning + judgment")
**Verdict:** approved_with_refinements → refinement applied as `tp_docs_002`, re-verified clean.

## Verified correct on first pass (no defect)

Checked field by field against `board-toolbar.tsx` on disk: chip render order; placement in the same flex-wrap row as the Filter trigger and SortControl; the four divider-separated segments; both operator strings (`is any of` ×4, `include any of` for Labels); one-value rendering for Status (column name), Priority (priority name), Assignee (member name) and Due date (Due this week / Due next week / No due date); icon preview present for Status/Priority/Assignee and absent for Due date/Labels; the cap of three (`items.slice(0, 3)`); what the X clears for all five fields; and the location and gating of **Clear all filters**.

## Defects found and fixed

**F1 — factual, medium.** The table's Labels row illustrated its "One value selected" cell with `e.g. "3 selected"`, contradicting its own column heading. One selected label renders `1 selected`.
*Evidence:* `board-toolbar.tsx:634-643` — the Labels chip has no `length === 1` branch, unlike Status (`:547-552`), Priority (`:571-577`), Assignee (`:596-602`) and Due date (`:614-629`).
*Fixed:* Labels bullet now reads `"1 selected" for one label, "3 selected" for three`.

**F2 — factual, low (omission).** The Labels chip counts raw label ids, but one entry in the Labels list toggles every workspace label sharing that name and color. So one menu choice can display a count above one, and the "how many values are selected" framing did not hold for that field.
*Evidence:* `uniqueLabels` dedupes on name+color (`:184-199`); `toggleLabelGroup` calls `updateLabelFilter` for every matching id (`:233-247`); the chip counts `filters.labels.length` (`:638-640`). Independently re-verified by the orchestrator.
*Fixed:* one sentence added to the Labels bullet.

**S1 — style, medium.** The four em dashes introduced were the only em dashes in the entire `apps/docs` tree.
*Evidence:* `grep -rc "—" apps/docs --include=*.mdx` returned exactly one non-zero file — this one, count 4, all from this diff. Independently re-verified; post-fix the tree is back to zero.
*Fixed:* recast with commas and sentence breaks.

**S2 — style, medium.** The markdown table was the only table under `apps/docs/core/functional`. This docs set reserves tables for reference material (integrations, installation, migrations) and uses bullets or numbered steps for functional behaviour. The table also duplicated content — its "Two or more selected" column was identical in all five rows, its "Operator" column repeated the sentence above it, and a following "Two exceptions" paragraph restated it in prose — tripling a section whose peers run under eight lines. "Icon preview" was a coined heading with no product counterpart.
*Evidence:* independently re-verified — `grep -rl '^| ---' apps/docs/core/functional` matched only the file this run edited; the other nine functional pages have no table.
*Fixed:* replaced by a five-item bullet list; the redundant paragraph removed; "Icon preview" gone.

**S3 — style, low.** The closing paragraph repeated "at once" and "menu" twice each.
*Fixed:* tightened to one sentence plus its condition.

## Checked and explicitly not a finding

Contractions. `It's` is consistent with sibling functional pages (`manage-workspace-labels.mdx` uses "You'll", "don't", "they're"). The reviewer checked and declined to raise it — correctly.

## Post-refinement verification (orchestrator)

- `git diff --stat`: 18 insertions, 0 deletions, one file.
- Em dashes in file: 0. Em dashes anywhere in `apps/docs`: none.
- Table lines in file: 0.
- Prohibited-topic grep (`wip|work in progress|hours`): no match.
- Frontmatter, all headings, the five existing bullets and the existing closing line: untouched (0 deletions confirms it).

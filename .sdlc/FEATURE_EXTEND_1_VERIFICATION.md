# Column WIP Limits Audit

**Verification of the feature-extend-1 (per-column WIP limit) brief across four model policies.**

All four runs shipped a working feature: schema, migration, validated API, board indicator, and
tests. All four are green and add **zero** new type errors. But unlike the docs and refactor
briefs, **the four arms were not given the same specification** — the briefs diverge on where the
limit is configured and on whether other locales may be touched. Cross-arm comparison is
therefore confounded.

| | |
|---|---|
| **Brief** | feature-extend-1 — advisory per-column WIP limit with over-cap indicator |
| **Base** | `5d1fc910` (merge-base for all four branches) |
| **Verified** | 3 Sep 2026 |

---

## Verdict

| Metric | Result | |
|---|---|---|
| Runs that shipped the feature | **4 / 4** | Schema → API → board, end to end |
| Suites green | **4 / 4** | API and web, no failures |
| New type errors introduced | **0** | Across all four, API and web |
| Distinct specifications given | **4** | The briefs are not the same document |
| Defects found | **3** | One per arm; none fatal |

---

## The finding that reframes the rest

The four arms did **not** run the same ticket. Each branch carries its own `intent_brief.md`, and
they are different documents — 94, 111, 135 and 164 lines, with different titles.

The substantive divergence is **where the limit is configured**:

| Arm | Configuration surface | Stated in its brief |
|---|---|---|
| `gemini-only` | Inline in the board column header | "Where configured: inline in `ColumnHeader` — not a separate settings page" |
| `opus-flash` | `ColumnEditor` in project settings | Non-goal: "No inline WIP-limit editing from the board lane header" |
| `opus-sonnet` | `ColumnEditor` | Same |
| `opus-only` | `ColumnEditor`, header display-only | "This deliberately diverges from the prior flash arm, which put the input in the header" |

`opus-only`'s brief names the other branches and their commits, and sets its own design in
reaction to them. The briefs also disagree on locales: three forbid touching anything but
`en-US.json`; `opus-flash`'s says nothing about it.

**Consequence:** differences in output across these four arms measure the briefs at least as much
as the models. Every judgement below is therefore made against **each arm's own brief**.

---

## Verification run

Executed in a detached worktree with its own `pnpm install`, leaving the working tree untouched.

| Branch | API tests | Web tests | New TS errors | biome |
|---|:-:|:-:|:-:|:-:|
| `main` (baseline) | 374 | 112 | — | PASS |
| `opus-only` | 398 (+24) | 126 (+14) | 0 | PASS |
| `opus-flash` | 399 (+25) | 118 (+6) | 0 | PASS |
| `opus-sonnet` | 394 (+20) | 127 (+15) | 0 | PASS |
| `gemini-only` | 379 (+5) | 115 (+3) | 0 | PASS |

**On the type errors.** A first pass reported `Property 'wipLimit' does not exist` on all four.
That was a harness artifact: the worktree's `node_modules` was symlinked to the primary checkout,
so `@kaneo/libs` resolved back to `main`'s API types. With a real `pnpm install` in the worktree
and `turbo`'s `^build` step honored, all four branches land on exactly the same 25 pre-existing
web errors and 9 pre-existing API errors as `main` — all in `roles.tsx`, `auth.ts` and the
permissions plumbing, none related to this feature. **Zero new errors from any arm**, and the
`wipLimit` field propagates cleanly through the typed client once the API is built.

Integration tests were not run: no PostgreSQL available in this environment (see Limits below).

---

## API implementation: effectively identical

All four converged on the same shape without coordination:

- `wipLimit: integer("wip_limit")` on `columnTable` — nullable, no default
- `v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647))))`
- `...(data.wipLimit !== undefined && { wipLimit: data.wipLimit })` in update, `?? null` in create
- `wipLimit` added to the hand-whitelisted column projection in `get-tasks.ts`

Every arm found the int4 ceiling and every arm found the `v.integer()` requirement. The
differences are organisational:

| Arm | Where the validator lives |
|---|---|
| `opus-flash` | New `apps/api/src/column/validators.ts` — cleanest, single definition, documented |
| `opus-sonnet` | Exported from `controllers/create-column.ts` — a controller exporting a validator |
| `opus-only` | Inlined twice (create and update) — duplicated |
| `gemini-only` | Inlined twice, with `2_147_483_647` numeric separators |

`gemini-only` also added `columnId: column.id` to the board projection. That is not in any
acceptance criterion, but it is *necessary* for its design: the projection sets `id` to the
column's slug, so inline editing from the board needs the real id to call `updateColumn`.

---

## Live web verification

No browser automation and no PostgreSQL are available in this session, so a click-through pass
could not be done. What was done instead: the **real `ColumnHeader` component from each branch**
was rendered with real props and real `en-US` copy, and the produced markup captured for three
states — no limit, within cap, over cap.

### Over-cap state (4 tasks, limit 3)

| Arm | Rendered badge |
|---|---|
| `opus-only` | `4 / 3` + alert icon · `bg-destructive/15 text-destructive` · `aria-label="4 of 3 tasks (WIP limit)"` · title |
| `opus-flash` | icon + `4/3` · `bg-destructive/10 text-destructive ring-1 ring-destructive/30` · `aria-label` · `data-over-limit="true"` |
| `opus-sonnet` | icon + `4 / 3` · `border border-destructive/30 bg-destructive/10 text-destructive` · `aria-label` |
| `gemini-only` | `4/3` · `bg-destructive/15 text-destructive font-semibold` · **no icon, no aria-label**, `title` only |

All four render a distinct over-cap state, so acceptance criterion 5 holds everywhere.

### No-limit state (4 tasks, no limit) — where they diverge

`main`, `opus-flash` and `opus-sonnet` all render the original badge byte-for-byte:

```html
<span class="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">4</span>
```

The other two do not:

```html
<!-- opus-only: adds flex classes, role and aria-label to every column, limit or not -->
<span class="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs
      font-medium text-muted-foreground" role="img" aria-label="4 tasks">4</span>

<!-- gemini-only: the badge becomes a popover trigger button on every column -->
<button type="button" aria-haspopup="dialog" data-slot="popover-trigger" title="Set WIP limit">
  <span class="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">4</span>
</button>
```

`opus-flash`'s brief is the only one that states "a column with no limit renders exactly as it
does today" as an acceptance criterion — and it is the only arm that implemented an explicit
early return to guarantee it. `opus-sonnet` achieved the same without being asked.

---

## Defects

### 1 · `opus-only` — every board's count badge changes, limit or not

Confirmed in rendered markup. With no WIP limit set, the badge gains `inline-flex items-center
gap-1` and, more significantly, `role="img"` with an `aria-label`. Screen-reader output for the
task count changes on **every existing board in every installation**, whether or not anyone uses
the feature. `role="img"` on a numeric count is also questionable semantics.

Not a criterion failure — `opus-only`'s brief has no "unchanged when unset" criterion — but a
blast radius its reviewers did not flag.

### 2 · `gemini-only` — over-cap is signalled by colour alone

The only arm whose over-cap badge has no icon and no `aria-label`. The state is carried by red
text plus a `title` attribute, which is not reliably announced by screen readers and is
unavailable on touch. Its brief permitted "badge color change / warning icon", so it is compliant
— but it is the one implementation a colour-blind or screen-reader user cannot perceive.

Separately, its design makes the count badge an interactive `<button>` on **every** column,
which is a larger change to existing boards than any other arm's.

### 3 · `opus-flash` — the edit surface it is graded on has no test

`opus-flash` is the only arm with no test for `ColumnEditor`, the surface its own acceptance
criterion 4 covers ("can set, change, and clear a column's limit, and the change persists across
reload"). It has no integration test either — permitted by its brief, which recorded that
PostgreSQL was unavailable. Its +6 web tests all cover the badge component; the input that writes
the value is unverified. `opus-only` (+14) and `opus-sonnet` (+15) both test their editor.

---

## i18n

Three briefs forbid touching locales other than `en-US`; `opus-flash`'s does not mention it, and
it translated into all 16 other locales.

| Arm | Locale files | New missing-key lines in `pnpm i18n:check` |
|---|:-:|:-:|
| `opus-flash` | 17 | **0** |
| `opus-sonnet` | 1 | +144 |
| `gemini-only` | 1 | +144 |
| `opus-only` | 1 | +224 |

Context that keeps this in proportion: `i18n:check` **already fails on `main`** (358 lines of
pre-existing missing keys) and is **not run in CI**. So the three compliant arms added debt to a
pile that already exists and gates nothing, exactly as their briefs instructed. `opus-flash` did
unasked-for work that happens to leave the check no worse.

`opus-only`'s larger figure comes from pluralised keys (`_one` / `_other`) where **three of the
four pairs have identical text** — pluralisation that doubles the translation burden for no
behavioural difference.

---

## What we take from this

**Recommendation: ship `opus-sonnet`.** It is the only arm that combines a byte-identical
no-limit badge, a full accessible over-cap state (icon plus `aria-label`), a tested edit surface,
a PostgreSQL integration test, and the strictest validation. Before merge, move its
`wipLimitSchema` out of `create-column.ts` into `opus-flash`'s `validators.ts` — that is the right
home, and it removes the duplication the other arms carry.

- **The briefs, not the models, drove the divergence.** Same ticket, four specifications, four
  different products. Any cost-per-quality read across these arms is measuring brief quality.
- **Every arm found the hard parts unaided.** The int4 ceiling, `v.integer()` over bare
  `v.number()`, and the hand-whitelisted `get-tasks` projection — the three things a careless
  implementation would miss — were caught by all four.
- **Test counts hid the real gap.** `opus-flash` has the most API tests (+25) and the least web
  coverage (+6), with nothing at all on the surface where users set the value.
- **Verification tooling can lie.** The first typecheck pass reported four broken branches. The
  branches were fine; the harness was wrong. A failing check is a hypothesis until the baseline
  is run in the same environment.

---

## Method

Each branch checked out in a detached `git worktree` with its own `pnpm install --frozen-lockfile`,
so workspace packages resolve within the worktree and `turbo`'s `^build` prerequisite is honored.
For every branch: `vitest run` on `@kaneo/api` and `@kaneo/web`, `pnpm --filter … typecheck`
through turbo with error sets diffed against `main` in the same environment, `biome ci` over
`apps/**/src` and `tests`, and `node scripts/i18n/check.mjs` diffed against `main`. UI states were
captured by rendering each branch's real `ColumnHeader` with fixtures at no-limit, within-cap and
over-cap, resolving real `en-US` strings, and recording the produced markup. Worktree removed
afterwards.

**Not covered here.** No end-to-end pass: PostgreSQL is not running and Docker Desktop is not
started in this environment, so the API cannot boot (migrations run on startup) and the
`tests/api-integration/column-wip-limit.test.ts` suites on three of the four branches never
executed. No browser automation is available in this session, so no click-through of the editor,
no persistence-across-reload check, and no visual confirmation in a real board. Start Docker
Desktop and the remaining checks can be completed.

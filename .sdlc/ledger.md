# SDLC run ledger — Kaneo

One row per completed `/mmo:*` run. Created on branch `feature-extend-3/opus-sonnet`.

> **Note on this file's history.** Ledgers written by earlier runs were committed on other
> branches and are unreachable from here, so this file starts fresh at the run below. It is not
> the project's first SDLC run — only the first on this branch.

> **Cost columns are not internally comparable.** Under `auth_mode: estimated`, mechanical-tier
> (Sonnet) cost is vendor-reported `total_cost_usd` from `claude -p`. Direct-tier (Opus) cost is a
> `chars/3.8` estimate, measured on 2026-08-26 to undercount by **~2.17×** because it does not model
> multi-turn context re-send. **Treat every Opus figure as a floor, never as a measurement.**

| Run ID | Date | Intent | Policy | Cost (total) | Opus (est. FLOOR) | Sonnet (vendor) | Tests | Verdict | Committed |
|---|---|---|---|---|---|---|---|---|---|
| `20260826-132654-feature-extend-board-filter-chips` | 2026-08-26 | feature-extend | opus-plus-sonnet-max | **$4.70** | $2.20 | $2.50 | 43 files / **172** (from 36 / 112) | ship with follow-ups + conditions | **No** |

---

## `20260826-132654-feature-extend-board-filter-chips`

**Branch:** `feature-extend-3/opus-sonnet` · **Anchor:** `5d1fc910` · **Nothing committed** (0 staged, 18 changed paths).

**Delivered.** URL persistence for the five existing board filter chips (status, priority, assignee,
dueDate, labels) via TanStack Router search params. URL wins on load, then syncs down to the
per-project `localStorage` key. Chips, toolbar and filtering semantics unchanged. 10 new files,
8 modified. Typecheck clean; `biome ci` **exit 0** on the 18 changed paths (exit code read, not
asserted); 0 allowlist violations; 0 reverts.

### Headline open item — Sentry passively exports filter params

`apps/web/src/instrument.ts` runs Sentry `browserTracingIntegration()` + `replayIntegration()` at
`replaysSessionSampleRate: 0.1` with **zero** `beforeSend` / `beforeBreadcrumb`. Now that assignee
ids are in the URL, **~10% of sessions ship `?assignee=<userId>` to Sentry automatically, with no
user action**. `sendDefaultPii: false` does **not** strip query strings. Remedy: a scrubbing
`beforeSend`/`beforeBreadcrumb` in `instrument.ts`.

**The run identified this real exposure and did not touch the file, because scope forbade it.**
`instrument.ts` is not among the 15 allowlist globs; it was verified clean at closeout along with
every other off-limits path. Blocked by scope, not by difficulty.

**The run's own `requirements.md` §6 named the wrong vector.** It cited `Referer`, which is already
closed by `Referrer-Policy: strict-origin-when-cross-origin` (`apps/web/nginx.conf:9`), and omitted
Sentry entirely. The security review found this by reading the code rather than accepting the
document.

### Acceptance status — stated accurately, not rounded up

- **AC-5: nine navigation call sites PROVEN** (9 behavioral tests + mutation checks 2/4/5).
  **FR-19 — filters surviving a board↔list view switch — UNPROVEN.** The test mapped to it rerenders
  with a new `project` object, which is not a view switch, and would still pass in exactly the world
  FR-19 guards against. Do not read this row as "AC-5 satisfied".
- **AC-9 (browser Back): REASONED, NOT PROVEN.** jsdom cannot exercise real `popstate`/bfcache.
  Flagged as such from Gate 1 and never upgraded.
- AC-6 was not merely argued: the security reviewer **executed** the codec against 32 hostile inputs
  (throwing getters, revoked Proxy, throwing `Symbol.toPrimitive`, cyclic objects, `__proto__`
  payloads) — **zero throws**.

### Other open items

1. **Project-switch transient — untested.** `RouteComponent` does not remount on `$projectId` change,
   so project A's filters are briefly written into project B's `localStorage` key and URL before
   self-correcting. It **converges and causes no durable data loss**; it is also **completely
   untested**, because every hook test uses `"project-1"`.
2. **Unbounded write path.** `MAX_FILTER_VALUES`/`MAX_FILTER_VALUE_LENGTH` are properties of one
   entry point, not invariants on filter state.
3. **KD-1/KD-2/KD-3** recorded and deliberately unfixed (duplicated filter hooks diverging on
   `hasActiveFilters`; the same navigate bug on backlog/gantt; the unconditional-write design).

### Self-corrections — review caught each of these, not the orchestrator

1. **"Structurally impossible" overstated** — true only for a constant `storageKey`, which was never
   stated at the time.
2. **A mutation check the run's own plan specified was skipped** (§8.2 one-sided kanban `j`-only).
   The senior review caught the omission; once run: **`j` RED, `k` GREEN**.
3. **Two seams were unbound** — deleting `board.tsx`'s `urlState` argument or its
   `useBoardFilterUrlSync` call left all 170 tests green. Now argument-asserting spies, with mutation
   checks 6a/6b turning exactly one test red each.
4. **AC-5 was reported as satisfied and was not** — see above.

**Operator error:** a `basename`-derived backup filename collided both `index.tsx` files during
mutation check 4, writing ListView's contents into `kanban-board/index.tsx`. Caught by the next
`git status --porcelain`, restored from HEAD, re-applied deterministically. The `opus-plus-flash` arm
hit the same class of bug — **full-path-derived backup names are the fix.**

### Routing — third independent reproduction of a plugin bug

Actual: **0 opus / 21 sonnet** on mechanical work. Counterfactual under `pipeline/SKILL.md`'s
documented brownfield task_types (`new_file_add` / `existing_file_edit`): **9 opus / 9 sonnet** —
they match no codegen rule and fall through to `{ default: opus }`, silently turning a mixed-policy
run mostly premium while appearing to succeed. Simulated with the plugin's real `pickModel` before
dispatch and confirmed against telemetry afterwards.

**Cost note:** the cheap tier cost **more** than the premium tier ($2.50 vs $2.20 floor) across 18
calls averaging $0.14. Each `claude -p` spawn reloads session context — 838,682 cached input tokens
against 316,928 fresh.

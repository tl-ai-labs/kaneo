# Kaneo — SDLC project fingerprint

Facts established by completed `/mmo:*` runs. **A future run should read this instead of
re-deriving them.** Every entry below was measured or verified against this repository, not assumed.

Run history and per-run detail: **[ledger.md](./ledger.md)** · machine-readable: **[ledger.json](./ledger.json)**

---

## Cost model — read this before estimating any run

**Do not estimate agent-tier cost from $/Mtok.** It will be wrong by more than 2×.

The `antigravity-worker` adapter hands each packet a working directory and a toolset. The worker
then **reads the repository itself** — listing, grepping, opening and re-opening files across turns.
Input volume is therefore dominated by *the worker's own repo reads*, not by the `inputs[]` slices
the packet carries. Enriching a packet's `inputs[]` reduces reads only weakly; the worker still
explores.

Measured on run `20260826-103235-feature-extend-board-filter-chips` (10 files, ~800 changed lines):

| | |
|---|---|
| Billed input | **6.9M** tokens (2.49M fresh + 4.43M cached) |
| Output | 199K tokens |
| Total | **$6.1841** across 21 dispatches |
| Same ticket on `opus-plus-flash-v37` | **$2.70** |

So the single-tier Flash policy cost **2.29× more** at roughly **1/6** the per-token price. Single
dispatches reached 1.4M billed tokens for one document. Budget agent-tier phases by *expected repo
reads*, not by the size of the artifact you want back.

Corollary for packet design: keeping a packet's output small helps (the retry that shrank a
change-plan rewrite from a full reproduction to section pointers cut it from a failure to $0.375),
but you cannot shrink the read side much from the packet.

---

## Repository facts

### Search-param encoding is app-wide and not per-route

`apps/web/src/main.tsx` calls `createRouter()` with **no `parseSearch` / `stringifySearch`
override**, so TanStack's defaults apply everywhere:
`parseSearchWith(JSON.parse)` / `stringifySearchWith(JSON.stringify, JSON.parse)`.

Consequences, measured against `@tanstack/router-core@1.171.20`:

- **Arrays are emitted JSON-encoded.** `{ status:["todo"] }` → `?status=%5B%22todo%22%5D`.
  **Emitting repeated params (`?status=a&status=b`) is impossible without overriding
  `stringifySearch` in `main.tsx`** — an app-wide change, normally out of scope for a feature ticket.
- **Inbound, three shapes all arrive:** JSON array; repeated keys (which *parse* to an array fine);
  and a **bare single string** — `?status=todo` arrives as `"todo"`, not `["todo"]`. A parser using
  only `Array.isArray` silently drops single-value params.
- `?status=` arrives as `{ status: "" }` — **the key is present**, so "does the URL carry filters?"
  must be computed from *normalized* values, never from key presence. `?status=%20` → `{ status: " " }`.
- Nothing splits commas: `?status=todo,review` is the single string `"todo,review"`.
- `{}` stringifies to `""` and `undefined`-valued keys are dropped, so a clean URL is free —
  emit `undefined` for an inactive filter, never `[]`.
- **Round-trip identity holds** for JSON encoding, including values containing commas
  (`assignee: ["u,1"]` survives intact).

Full measurement table: `runs/20260826-103235-feature-extend-board-filter-chips/verified-encoding.md`.

### `board-toolbar.tsx` calls filter mutators in loops

`clearLabelFilters` and `toggleLabelGroup` (`apps/web/src/components/board/board-toolbar.tsx:239-251`)
each call `updateLabelFilter(...)` **N times inside a single event handler**:

```ts
const clearLabelFilters = () => {
  if (!filters.labels || filters.labels.length === 0) return;
  for (const labelId of filters.labels) updateLabelFilter(labelId);
};
```

**Any rework of filter state must preserve call composition** — either a functional updater
(`setFilters(prev => …)`) or a within-tick accumulator ref. A mutator that computes its next value
from a render-scoped memo makes all N calls read the same base, so **only the last survives** and
"clear label filters" removes one label instead of all. This shipped as a blocker in the run above
and is now guarded by regression tests named for these handlers.

### `validateSearch` convention is genuinely forked

`zod@^4.4.3` **is** a dependency of `apps/web` and **is** used as `import { z } from "zod/v4"` in
`validateSearch` on **five** routes. **Five others** use hand-rolled `typeof` predicates. Neither is
"the" convention — pick deliberately and justify it.

Hard constraint either way: **`validateSearch` must never throw.** A throwing validator takes the
whole route down, so never-throw is a security property, not a style preference. The board route's
implementation wraps defensively and is asserted against 14 hostile input shapes.

### `useTaskFilters()` is dead code

`apps/web/src/hooks/use-task-filters.ts` exports the `BoardFilters` type and `DUE_DATE_FILTER_VALUES`,
which **are** imported elsewhere — but the `useTaskFilters()` **hook itself has zero call sites**.
`use-task-filters-with-labels-support.ts` is the sole production hook (used by `board.tsx`).

The two files duplicate `DEFAULT_FILTERS`, `FILTER_KEYS` and `normalizeFilters` verbatim. Deduplicating
them, and deleting the dead hook, have both been explicitly out of scope so far. Note them; don't
fold them into an unrelated ticket.

### The board route renders two views, and `viewMode` is not routing

`board.tsx` renders **`KanbanBoard` or `ListView` depending on `viewMode`** — both are live code
paths, so a change to task-navigation behaviour must be applied to `kanban-board/` **and**
`list-view/`. Nine `navigate()` sites reachable from the board replace the whole search object;
they are now functional updaters.

**`viewMode` comes from the `useUserPreferencesStore` Zustand store, not from the router.** Toggling
board↔list therefore does not navigate and cannot touch search params. That is a *by-construction*
argument for filter survival across view switching — it is sound, but **no test proves it** (AC5
above). `apps/web/src/store/user-preferences.ts` has been off-limits in every run so far.

Backlog / gantt routes have their own equivalents and have been consistently out of scope.

---

## Verification commands

```bash
pnpm --filter @kaneo/web test        # vitest, jsdom, setup src/test/setup.ts
pnpm --filter @kaneo/web typecheck   # tsc -p tsconfig.app.json && -p tsconfig.node.json
```

**Never run root or package `lint`** — both are `biome check --write`, which rewrites unrelated
files. Use a targeted `biome check` on changed paths only. **Never run `pnpm i18n:check:fix`.**

Take a **green baseline before any codegen** so later failures are attributable. Last recorded
baseline: **36 test files / 112 tests passing, typecheck exit 0** (pre-run, 2026-08-26).

Two verification traps observed:

1. **Run both `test` and `typecheck`.** A vitest-green file can still fail `tsc` — an `it.each`
   array mixing scalars with `[]` / `[1,2]` produced 13 `TS2769` errors, because vitest treats each
   element as an argument tuple. Wrap heterogeneous cases in single-element tuples.
2. **Functional search updaters need explicit `prev` types.** Components calling `useNavigate()`
   without `from` cannot infer the search shape, so `search: (prev) => …` is an implicit `any` under
   `noImplicitAny`. Annotate `prev: Record<string, unknown>`. This cost a whole debug packet across
   10 call sites.

---

## Tooling caveats that affect how a run must be operated

- **The write-contract PreToolUse hook does not fire.** Verified empirically: a `Write` to an
  off-limits path was **allowed**, while the identical input piped to
  `scripts/write-contract-check.mjs` **denied with exit 1**. The script is correct; it is not being
  invoked, even though the PostToolUse telemetry matcher in the same `hooks.json` works.
- **`artifact_path` is never validated** — it exists only as a type declaration, with no reader in
  the MCP server or any adapter.
- **Agent workers bypass the hook by construction**, editing files from a separate process.

**Therefore: treat containment as the orchestrator's job.** Put an explicit may-write / must-not-touch
list in every packet instruction and run `git status --porcelain` after **every** dispatch. That
method held for 21 consecutive dispatches with 0 out-of-scope writes and 0 reverts, with no
enforcement layer active at all.

- **`.sdlc/**` is in the default off-limits list**, which by the script's logic would deny the
  orchestrator's own writes to its mandated `output_dir`. Write run bookkeeping via Bash, or clear
  the contract first.
- **`write-provenance.mjs` accepts one before/after pair per file per run.** A file edited by two
  packets keeps the *first* edit's `sha_after`. Revert still works (it restores `sha_before`), but the
  after-fingerprint misrepresents final state.

# Kaneo — SDLC plugin project fingerprint

- Baseline: `.sdlc/baseline/current.json`, built 2026-08-20 at git HEAD `5d1fc910`.
- Default policy: `flash-agsdk-only` (`.sdlc/project.json`) — Gemini Flash via the Antigravity
  agent worker is the only priced leaf; premium-tier orchestration work runs in-session and is
  logged at $0/estimated.
- Test commands: `pnpm test` (repo-wide), scoped alternatives per package in
  `.sdlc/baseline/current.json#test_command_alternatives`. Integration tests need
  `DATABASE_URL` exported per-shell (no committed `apps/api/.env.test` — only
  `.env.test.example`, which points at the wrong default port). See run
  `20260820-123148-feature-extend-lane-wip-limit` in the ledger for the concrete gotcha.
- Runs so far: see `.sdlc/ledger.md` / `.sdlc/ledger.json`. Three runs of the same feature-extend
  ticket have completed, on separate branches off `5d1fc910`, as arms of a four-policy benchmark:
  `flash-agsdk-only` (run `20260820-123148`, $3.50 floor), `opus-only-v5` (run `20260821-065909`,
  $3.8845 vendor-reported across 14 dispatches), and `opus-plus-sonnet-max` (run
  `20260821-094808`, **$2.7070** across 10 dispatches — the cheapest arm).
  The mixed arm's headline result: **the cheap tier cost more in absolute terms than the premium
  tier** ($1.5813 Sonnet vs $1.1256 Opus) despite being 2.4× cheaper per output token, because
  mechanical work emitted 3.3× more output. A mixed policy pays off on input-heavy / output-light
  phases (review, analysis, planning) and pays off least on test generation.
- **Integration tests share one PostgreSQL container (`kaneo-mmo-itest`, port 55432), and that
  caused cross-arm contamination.** Two arms each generated a different `0043` migration; the
  second arm's run failed 177 tests with `column "wip_limit" ... already exists` because Drizzle
  re-ran an `ADD COLUMN` the other arm had already applied. If you run the same ticket more than
  once, give each run its own database or drop `kaneo_test` between runs — the harness recreates
  and migrates it from zero automatically (`ensureTestDatabaseExists`).
- `pnpm i18n:check` fails at baseline (`common:error.*` missing from `de-DE`). Do not read a
  failure there as damage from a run; compare against the pre-existing set first. Adding en-US
  keys legitimately widens the per-locale missing list — translating them is normally out of scope.
- Plural i18n keys use the `_one`/`_other` convention with **no** base key (see
  `settings.workspaceRoles.permissionCount`, `notifications.newCount`). Component tests mock
  `react-i18next` so `t` echoes the key, which means plural bugs are invisible to them — assert
  plural forms against a real i18next instance instead.

## Standing repo properties

These are properties of **this repository**, not records of any one run. They will bite any future
run here regardless of ticket. Read them before planning work.

- **`pnpm --filter @kaneo/api db:generate` reddens `biome ci`.** drizzle-kit writes
  `apps/api/drizzle/meta/_journal.json` and `meta/<n>_snapshot.json` with **2-space** indentation,
  but `biome.json` sets `formatter.indentStyle: "tab"` (the `javascript` override does not apply to
  JSON) and `apps/api/drizzle/**` is **not** excluded from Biome's file discovery. The result is
  silent: `_journal.json` gets rewritten wholesale (**313 insertions / 306 deletions** for what
  should be a 7-line append, obscuring review and guaranteeing conflicts with any concurrent
  migration), and `npx biome ci .` — **the first job in `.github/workflows/ci.yml`** — goes red.
  **After every `db:generate`, run**
  `npx biome format --write apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/<n>_snapshot.json`.
  Do **not** try to fix it by re-running `db:generate`; that is what produces the spaces.
  Corollary: lint the files a *generator wrote*, not only the files you *edited* — the usual
  four-command verification gate contains no linter at all.

- **`apps/docs/openapi.json` is roughly 11 route-groups stale, and CI has no spec-freshness check.**
  Regenerating with `pnpm --filter @kaneo/api openapi:export` currently produces ~1,481 insertions /
  166 deletions: entire missing route groups (`/billing/{workspaceId}` +`/checkout` +`/portal`,
  `/mcp/authorize` +`/request/{requestId}`, `/mcp/register`, `/oauth/id-token`, `/project/reorder`,
  `/user/avatar` +`/{id}`, `/workspace/{workspaceId}/members` — 13 new operationIds) plus 27
  `"nullable": true` → `"readOnly": true` changes originating from a Better Auth version difference.
  **A ticket that changes one route's contract cannot regenerate this file without dragging in ~1,300
  unrelated lines.** Either land the regeneration as its own dedicated change, or document the
  contract gap and defer. The absence of any spec-freshness check in CI is why the gap grew unnoticed
  — adding one is worth its own ticket.

- **`pnpm i18n:check` is already red at HEAD** (`common:error.*` missing from `de-DE` and other
  locales). Never read a failure there as damage from your run — compare against the pre-existing set
  first. Adding en-US keys legitimately widens the per-locale missing list.
  **Never run `pnpm i18n:check:fix`**: it copies the English strings into all 16 locale files, which
  is almost never what a ticket wants and is an explicit non-goal on most of them.

- **Benchmark/repeat runs need their own database, or a drop between arms.** Integration tests share
  one PostgreSQL container (`kaneo-mmo-itest`, port 55432). Two arms of the same ticket each generate
  a *different* `0043` migration; the second arm then fails en masse with
  `column "wip_limit" ... already exists` because Drizzle sees its own `0043` as unapplied and re-runs
  the `ADD COLUMN`. Drop `kaneo_test` between arms — the harness recreates and migrates it from zero
  automatically (`ensureTestDatabaseExists`).

- **Integration tests need `DATABASE_URL` exported per shell.** There is no committed
  `apps/api/.env.test`, only `.env.test.example`, which points at the wrong default port. Use
  `DATABASE_URL=postgresql://postgres:postgres@localhost:55432/kaneo_test`.

- **The board projection is lossy and silently so.** `apps/api/src/task/controllers/get-tasks.ts`
  re-maps columns field-by-field and already drops `color` and `position`. A new column field is
  invisible to the board unless added there explicitly. The saving grace is that `ProjectWithTasks`
  is *inferred* from that response, so `pnpm typecheck` catches the omission at every column-literal
  fixture — treat typecheck as load-bearing for any change to this projection.

- **The board route is `GET /api/task/tasks/:projectId`**, not `/api/task/:projectId` (which is the
  single-task route and will 400 with "Workspace ID could not be determined"), and its response is
  wrapped in `{ data, pagination }` — the columns live at `body.data.columns`.

- **Plural i18n keys use the `_one`/`_other` convention with no base key** (see
  `settings.workspaceRoles.permissionCount`, `notifications.newCount`). i18next reserves the `count`
  option for plural selection, so a label interpolating two numbers should use names like
  `{{current}}`/`{{limit}}` rather than `{{count}}`. Component tests mock `react-i18next` so `t`
  echoes the key, which means plural bugs are invisible to them — assert plural forms against a real
  i18next instance instead.

- **`adapter: claude-cli` caveats** (affects any policy using it): `budget.maxOutputTokens` is inert —
  the adapter passes no max-tokens flag, so budgets never constrain the model and the ceiling-doubling
  retry cannot fire. There is also a hard 300 s timeout with no partial result; cap any single
  dispatch at roughly 5,000 output tokens and split larger generations.

Update this fingerprint when the baseline is refreshed or the default policy changes.

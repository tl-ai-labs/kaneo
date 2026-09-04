# SDLC state — kaneo

Last run: `20260903-125223-feature-extend-task-estimated-hours` (feature-extend, accepted).
Ledger: [ledger.md](./ledger.md) · [ledger.json](./ledger.json)

- Baseline: `.sdlc/baseline/current.json` (+ `stack-profile.md`, Tier 2b).
- Project default policy: `opus-plus-flash-v37` — note its `gemini-flash` slot defaults to the
  completion **API** door. For the SDK worker use `.sdlc/policies/opus-flash-sdk.yaml` as a
  `policy_path` override; it has no API door and needs no `MMO_SELECT`.
- Verify routing with `preflight_dispatch` before spending: `flash-agsdk-worker` must appear
  under `models` with `adapter: antigravity-worker`, not under `not_selected`.
- Verification: `pnpm --filter @kaneo/api test && pnpm --filter @kaneo/web test`, plus
  `typecheck` on both packages — the test suites and `pnpm run build` do NOT typecheck.
- Filtered single test file: `pnpm --filter <pkg> test <path>` — NO `--`, which is consumed and
  silently runs the whole suite.
- `biome ci .` exits 1 only because it lints `.sdlc/`; scope it to changed files.

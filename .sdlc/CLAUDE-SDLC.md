# SDLC state — kaneo

Last run: `20260903-094517-feature-extend-column-wip-limit` (2026-09-03, feature-extend, accepted).
Ledger: [ledger.md](./ledger.md) · [ledger.json](./ledger.json)

- Baseline: `.sdlc/baseline/current.json` (+ `stack-profile.md`, Tier 2b — Hono/React match no
  shipped adapter).
- Project default policy: `opus-plus-flash-v37`. An SDK-pinned override lives at
  `.sdlc/policies/opus-flash-sdk.yaml`; pass it as `policy_path` to route the mechanical tier
  to the Antigravity SDK worker without depending on `MMO_SELECT`.
- Verification: `pnpm --filter @kaneo/api test && pnpm --filter @kaneo/web test`.
  Never root `pnpm test` (rebuilds all) or package `lint` (biome --write).
- `biome ci .` is red purely from `.sdlc/` artifacts; scope it to changed files instead.

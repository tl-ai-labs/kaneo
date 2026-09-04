# Kaneo — SDLC fingerprint

Maintained by the mmo plugin. Not source; safe to regenerate.

## Project

- **Stack**: React 19 + Vite + TanStack Router/Query; pnpm workspace + Turborepo, 9 packages.
- **Default policy**: `opus-plus-flash-v37`, mechanical slot pinned to `flash-agsdk-worker`
  (Antigravity SDK) via `MMO_SELECT` in `.claude/settings.local.json`.
- **Verification** (all three are separate gates — none implies another):
  - `pnpm --filter @kaneo/web test`
  - `pnpm --filter @kaneo/web typecheck`   ← nothing else typechecks; `pre-commit` is
    `biome ci . && pnpm run build` with no `tsc`, so a non-compiling change passes the hook
  - `pnpm exec biome ci <paths>`           ← never any `lint` script; they are all
    `biome check --write .` and rewrite unrelated files
- Never root `pnpm test` (turbo, `dependsOn: ["^build"]`, rebuilds all 9 packages).
- `pnpm --filter <pkg> test -- <path>` silently runs the WHOLE suite; drop the `--`.

## Runs

See [ledger.md](./ledger.md) · machine mirror [ledger.json](./ledger.json).

## Open items left by prior runs

- `apps/web/src/components/backlog-list-view/index.tsx:97,104` — byte-identical `j`/`k`
  filter-wipe pattern to the one fixed on the board. Deliberately untouched (out of scope).
  Only a live bug if backlog filters ever move into the URL.
- **Prototype-pollution caveat, 8 navigation sites.** The `{ ...prev }` spread form in the
  board's `navigate({ search: … })` updaters is what keeps this off a real sink. Do not convert
  any of them to `Object.assign(prev, …)`.
- `apps/web/src/hooks/use-task-filters.ts` — near-duplicate of
  `use-task-filters-with-labels-support.ts`; its `updateLabelFilter` is now unused app-wide.
- `pnpm audit --prod`: 7 high / 4 moderate, all pre-existing transitive.

## Tooling gap worth knowing

`preflight_dispatch` reports `ok: true` against a **suspended** GCP consumer — it constructs
adapters without making an API call. Both Flash doors in `opus-plus-flash-v37` fall through to
Vertex ADC on one project (no `auth:` block anywhere), so a suspension takes out the entire
mechanical tier with no fallback door. Prove the tier is live with a real `generateContent` POST
before Gate 0.

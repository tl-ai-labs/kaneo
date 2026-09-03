# SDLC run ledger

| Date | Run | Intent | Policy | Files | Tests | Cost | Committed |
|---|---|---|---|---|---|---|---|
| 2026-09-03 | `20260903-094517-feature-extend-column-wip-limit` | feature-extend | `opus-flash-sdk` (SDK-pinned) | 18 (+181/-9) | 392 API / 123 web, green | $6.28 | no |

## 2026-09-03 — Per-column WIP limit with over-cap indicator

Branch `feature-extend-1/opus-flash-sdk`; HEAD unchanged at `5d1fc910`, nothing committed.
Auth mode `estimated`. Routing: 24/24 mechanical dispatches on `flash-agsdk-worker`, zero fell
through to `default: opus`.

Purpose of the run was to exercise the Antigravity SDK worker path rather than the completion
API path. Policy was a per-run override at `.sdlc/policies/opus-flash-sdk.yaml` with the
`select:` slot and the `flash-completion` model removed, so no API fallback was reachable.

Open follow-ups:
- `pnpm i18n:schema` — `i18n/schema.json` stale by 8 keys; no CI job catches it.
- Column mutations publish no events, so WIP limits do not propagate in realtime.
- `pnpm audit --prod`: 7 high / 4 moderate, pre-existing, untouched by this run.
- `.sdlc/` is not in `.gitignore`, so `biome ci .` goes red on run artifacts (57 errors, all
  inside `.sdlc/`). Source at HEAD and after this run is clean.

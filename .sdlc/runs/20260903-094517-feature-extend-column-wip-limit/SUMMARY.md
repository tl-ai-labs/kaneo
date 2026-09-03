# Run Summary — Per-column WIP limit with over-cap indicator

- **Run:** `20260903-094517-feature-extend-column-wip-limit`
- **Mode:** brownfield · **Intent:** `feature-extend` · **Auth mode:** `estimated`
- **Policy:** `opus-flash-sdk` v1 (`.sdlc/policies/opus-flash-sdk.yaml`), cap $50
- **Tiers:** `opus` → `claude-opus-5` (adapter `claude-cli`) · `flash-agsdk-worker` → `gemini-3.7-flash` (adapter `antigravity-worker`, Vertex ADC, project `ai-studies-console`, location `global`)
- **HEAD:** `5d1fc9104337786c3ef295ec0dc31656df371d8d` (branch `feature-extend-1/opus-flash-sdk`), **uncommitted**
- **Total cost:** **$6.2786** of $50 · 30 dispatch events, 1 vendor failure
- **Status:** COMPLETED · Gate 4 accepted · **not committed** (HEAD unchanged)

## Why this run existed

To exercise the Antigravity **SDK agent worker** path for the mechanical tier. The policy has no
completion/API door, so every mechanical packet had to route to `flash-agsdk-worker` or fail.
**All 24 mechanical dispatches routed there; zero fell through to `default: opus`.**

## Outcome

Nullable `wipLimit` on `columnTable`, validated on create/update, returned by `getColumns`,
carried through the typed client, editable per column in project settings, and surfaced as an
advisory over-cap indicator in the authenticated board header. Indicate-only — no enforcement.

| Check | Baseline | Final |
|---|---|---|
| `pnpm --filter @kaneo/api test` | 58 files / 374 tests | **61 files / 392 tests** |
| `pnpm --filter @kaneo/web test` | 36 files / 112 tests | **37 files / 123 tests** |
| `pnpm --filter @kaneo/api typecheck` | pass | **pass** |
| `pnpm --filter @kaneo/web typecheck` | pass | **pass** |
| `biome ci` on changed files | n/a | **all pass** |

18 distinct files changed, every one inside the frozen allowlist. No off-limits path touched
(`i18n/schema.json` and the 16 non-English locales verified checksum-identical).

## Cost by tier — the comparison this run was for

> **READ THIS BEFORE QUOTING THE NUMBERS. MIXED PROVENANCE.**
> The `opus` figures are **modelled** (`provenance: estimated`, char/3.8 heuristic — under
> `auth_mode=estimated` the direct tier runs in-session and is never dispatched through the
> server). The `flash-agsdk-worker` figures are **vendor-reported** by the Antigravity SDK.
> The two columns are therefore **not like-for-like**, and the "74% more" headline below
> **must not be quoted as a clean SDK-vs-API result.** It is a directional signal about input
> amplification on the agent path, nothing stronger.

| Tier | Dispatches | Input | Cached input | Total billed input | Output | Cost | $/1k output |
|---|---:|---:|---:|---:|---:|---:|---:|
| `opus` (direct) | 6 | 407,875 | 275,121 | 683,996 | 50,311 | **$2.2945** | $0.0456 |
| `flash-agsdk-worker` | 24 | 1,753,913 | 3,742,816 | 5,496,729 | 76,458 | **$3.9841** | $0.0521 |

The "cheap" tier cost **74% more** than the premium tier despite a 3.3× cheaper per-token rate.
Cause: the agent path billed **8.0× the input tokens** to produce 1.5× the output. The SDK
re-sends the conversation each turn and prepends a ~11.5k-token identity preamble, and the
worker also reads files and runs commands on its own initiative.

Caveats that matter before quoting these numbers:
1. `opus` figures are `provenance: estimated` (char/3.8 heuristic); `flash-agsdk-worker` figures
   are vendor-reported. **Not like-for-like.**
2. `tp_test_001` was killed by the 540s worker timeout with usage unreported, so the flash total
   is **under**-stated by roughly one codegen packet.
3. The policy's `gemini-3.7-flash` pricing block carries a `TODO(pricing)` marker.
4. In the SDK's accounting, `input_tokens` and `input_tokens_cached` are **disjoint and additive**
   (verified against the cost arithmetic), unlike Anthropic's subset convention.

## Required post-run steps

1. **`pnpm i18n:schema`** — `i18n/schema.json` is `additionalProperties: false`, generated from
   `en-US.json`, and now stale (10 new keys). No CI job runs it, so the drift is silent.
2. Optionally `pnpm i18n:check` — will report the 16 non-English locales missing the new keys
   (accepted at Gate 1 as OQ-3). Do **not** run `i18n:check:fix`; it writes those files.
3. Nothing is committed. `git_head_before == git_head_after`.

## Known issues carried forward

- **Staleness bound (N-2).** `use-get-tasks` polls every 30s, `use-get-columns` does not, and
  `apps/api/src/column/` publishes no events. A limit *raised* by another user leaves this client
  showing a stale red indicator until refocus. `change_plan.md` §8.2 has been amended to say so.
  Kaneo's own AGENTS.md calls for `publishEvent()` on mutations driving realtime updates; column
  mutations have never done it. Pre-existing, not a regression, out of scope here.
- **Dependency advisories.** `pnpm audit --prod`: 7 high / 4 moderate across 1220 prod deps
  (`fast-uri`, `mysql2`, `nanoid`, `qs`, `@tiptap/core`, `deepmerge-ts`). Not introduced by this
  run — `package.json` and `pnpm-lock.yaml` untouched. Warrants a separate `/mmo:deps` run.
- **Provenance double-records.** 24 records over 18 paths; 6 files were touched in both the
  pre-Gate-3 and post-Gate-3 rounds. `/mmo:revert` must use the **earliest** record per path to
  restore true pre-run state.

## Artifacts

`requirements.md` · `change_plan.md` (amended §8.2, §8.2b) · `packets.json` · `review.md` ·
`security_review.md` · `manifest.json` · `telemetry.jsonl` · `provenance.json` ·
`discovery.md` · `stack-profile.md` · `delegation/` (per-packet worker brief, sidecar, receipt)

## Per-packet dispatch table

| # | task_id | phase | task_type | model_id | in | cached | out | cost | ok |
|---|---|---|---|---|---:|---:|---:|---:|---|
| 1 | `smoke-opus` | codegen | `smoke` | `opus` | 14,138 | 10,121 | 11 | $0.1478 | ok |
| 2 | `smoke-flash` | docs | `smoke` | `flash-agsdk-worker` | 11,077 | 0 | 184 | $0.0183 | ok |
| 3 | `tp_req_001` | requirements_analysis | `delta_requirements` | `opus` | 46,000 | 30,000 | 5,900 | $0.2425 | ok |
| 4 | `tp_design_001` | change_plan | `delta_design` | `opus` | 104,437 | 70,000 | 15,500 | $0.5947 | ok |
| 5 | `tp_plan_001` | plan_task_packets | `decomposition` | `opus` | 78,000 | 55,000 | 8,500 | $0.3550 | ok |
| 6 | `tp_cg_001` | codegen | `entity` | `flash-agsdk-worker` | 60,950 | 61,806 | 1,869 | $0.1175 | ok |
| 7 | `tp_cg_002` | codegen | `migration` | `flash-agsdk-worker` | 30,071 | 73,638 | 2,374 | $0.0775 | ok |
| 8 | `tp_cg_002r` | codegen | `migration` | `flash-agsdk-worker` | 28,468 | 32,434 | 1,469 | $0.0608 | ok |
| 9 | `tp_cg_003` | codegen | `service_method` | `flash-agsdk-worker` | 74,856 | 149,902 | 1,912 | $0.1520 | ok |
| 10 | `tp_cg_004` | codegen | `service_method` | `flash-agsdk-worker` | 67,791 | 96,441 | 2,298 | $0.1368 | ok |
| 11 | `tp_cg_005` | codegen | `controller_handler` | `flash-agsdk-worker` | 76,159 | 182,195 | 3,142 | $0.1698 | ok |
| 12 | `tp_cg_006` | codegen | `frontend_config` | `flash-agsdk-worker` | 91,124 | 284,368 | 3,407 | $0.2100 | ok |
| 13 | `tp_cg_007` | codegen | `api_client` | `flash-agsdk-worker` | 99,040 | 227,030 | 3,321 | $0.2125 | ok |
| 14 | `tp_cg_008` | codegen | `frontend_util` | `flash-agsdk-worker` | 106,867 | 315,914 | 3,297 | $0.2374 | ok |
| 15 | `tp_cg_009` | codegen | `react_component` | `flash-agsdk-worker` | 112,789 | 386,804 | 6,619 | $0.2868 | ok |
| 16 | `tp_cg_010` | codegen | `react_component` | `flash-agsdk-worker` | 75,508 | 245,534 | 3,927 | $0.1854 | ok |
| 17 | `tp_cg_009r` | codegen | `react_component` | `flash-agsdk-worker` | 36,267 | 25,294 | 1,381 | $0.0706 | ok |
| 18 | `tp_test_001` | tests | `test_unit` | `flash-agsdk-worker` | 0 | 0 | 0 | $0.0000 | **FAIL** |
| 19 | `tp_test_002` | tests | `test_unit` | `flash-agsdk-worker` | 104,426 | 305,997 | 6,222 | $0.2585 | ok |
| 20 | `tp_test_003` | tests | `test_integration` | `flash-agsdk-worker` | 160,485 | 342,187 | 7,717 | $0.3615 | ok |
| 21 | `tp_test_004` | tests | `test_unit` | `flash-agsdk-worker` | 146,849 | 436,839 | 8,597 | $0.3632 | ok |
| 22 | `tp_review_001` | senior_code_review | `module_review` | `opus` | 93,500 | 62,000 | 13,700 | $0.5680 | ok |
| 23 | `tp_test_001r` | tests | `test_unit` | `flash-agsdk-worker` | 83,021 | 75,063 | 4,661 | $0.1777 | ok |
| 24 | `tp_sec_001` | security_review | `threat_model` | `opus` | 71,800 | 48,000 | 6,700 | $0.3865 | ok |
| 25 | `tp_cg_011` | codegen | `controller_handler` | `flash-agsdk-worker` | 85,305 | 102,952 | 2,062 | $0.1620 | ok |
| 26 | `tp_test_005` | tests | `test_integration` | `flash-agsdk-worker` | 93,313 | 75,058 | 4,474 | $0.1915 | ok |
| 27 | `tp_cg_012` | codegen | `frontend_config` | `flash-agsdk-worker` | 33,961 | 84,412 | 2,528 | $0.0864 | ok |
| 28 | `tp_cg_013` | codegen | `react_component` | `flash-agsdk-worker` | 63,043 | 101,125 | 5,640 | $0.1605 | ok |
| 29 | `tp_test_006` | tests | `test_unit` | `flash-agsdk-worker` | 64,782 | 203,455 | 11,224 | $0.2287 | ok |
| 30 | `tp_test_005r` | tests | `test_integration` | `flash-agsdk-worker` | 27,721 | 32,372 | 1,365 | $0.0587 | ok |

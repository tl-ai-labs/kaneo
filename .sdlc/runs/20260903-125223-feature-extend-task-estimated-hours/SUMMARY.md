# Run summary — 20260903-125223-feature-extend-task-estimated-hours

Brownfield · `feature-extend` · policy `opus-flash-sdk` · auth `estimated` · accepted at Gate 4.
Written by the main session: the harness forbids subagents writing report files, so the
orchestrator's Gate 4 report had no on-disk home. This is that report's content of record.

## Outcome

Nullable `estimated_minutes` on `taskTable`, editable in the task detail sidebar, shown on the
task card, and summed per column in the kanban column header over the **filtered** task set.

| Check | Baseline | Final |
|---|---|---|
| `pnpm --filter @kaneo/api test` | 374 / 58 files | 390 / 60 |
| `pnpm --filter @kaneo/web test` | 112 / 36 files | 132 / 39 |
| `typecheck` (both packages) | clean | clean |

32 files, all inside the contract. HEAD unchanged at `5d1fc910` at acceptance time.

## Design decisions

- **Integer minutes, not decimal hours.** The schema has no `numeric`/`decimal`/`real` column
  anywhere, Drizzle returns `numeric` as a JS string, and float sums produce rollup artifacts.
  Precedent: `timeEntryTable.duration`. UI accepts and displays hours.
- **The header sums raw minutes and formats once.** Three 100-minute cards each read `"1.67h"`
  while the header reads `"5h"`. This is correct; summing formatted values is the bug. Kept
  deliberately, with the worked proof in `change_plan.md` §2.3.
- **`Task.estimatedMinutes` kept required, never widened to optional.** This is what surfaced
  three production components missing the field.

## Routing

**27/27 mechanical dispatches on `flash-agsdk-worker`** (Antigravity SDK worker, gemini-3.7-flash,
Vertex ADC), first attempt. 0 misroutes to opus, 0 failures, 0 retries, 0 escalations. The policy
has no completion/API door, so no fallback was reachable.

Total **$7.8329** — flash 27 calls $6.6131, opus 3 calls $1.0404.

## Cost caveat — the headline ratio is NOT measurable

The SDK worker's input amplification is well evidenced: `input_cached` 6.96M vs `input` 2.89M,
from per-turn conversation re-send plus a ~11.5k identity preamble.

The **tier ratio is not** measurable from this telemetry, and neither this run's nor the sibling
run's ratio should be quoted as an SDK-vs-API or SDK-vs-Opus result:

1. **Largest understatement** — `senior-reviewer` and `security-reviewer` each ran full Opus
   sessions and emitted **no cost event at all**; they are absent from the $1.0404 entirely.
2. Orchestrator overhead (verification runs, git inspection, gate relays) is unbilled.
3. Opus is a char/3.8 estimate; flash is vendor-reported. Not like-for-like.
4. Gemini 3.7 Flash rates are unconfirmed — the policy still carries `TODO(pricing)`.

## Findings

1. **The plan enumerated one full-PUT caller; there were two.** `apps/api/src/mcp/tools.ts` is a
   second read-merge-full-PUT caller, so every MCP task edit would have silently NULLed the
   estimate. Caught by security review, fixed under contract amendment 3. The lesson is the
   enumeration gap: *a design that mandates round-tripping a field through a full-document
   endpoint owes a complete inventory of that endpoint's callers.* Declining a feature ("no MCP
   exposure") is not declining to prevent data loss.
2. **The pre-commit hook does not typecheck.** `.husky/pre-commit` is
   `biome ci . && pnpm run build`; `pnpm run build` is `vite build` with no `tsc`, and vitest
   does not typecheck either. A non-compiling commit passes it. Demonstrated mid-run: 385+132
   tests green while `apps/web` had 7 `error TS` failures. Pre-existing.
3. **CORRECTION TO THE ORCHESTRATION INSTRUCTION** — `pnpm --filter <pkg> test -- <path>`
   silently runs the entire suite. The `--` is consumed before vitest sees the path (with `--`:
   39 files; without: 1). Workers tp_019/020/021 did not disobey; they ran the command they were
   given. Correct form: `pnpm --filter <pkg> test <path>`, no `--`. This is the same trap that
   killed a packet on the sibling branch, reproduced inside the instruction meant to prevent it.
4. **Unformatted reference code in a design doc propagates.** `change_plan.md` §2.5's reference
   implementation was itself unformatted; codegen copied it verbatim (correct behaviour) and
   `lib/estimate.ts` failed `biome ci`. Format reference snippets in design docs.
5. **`.sdlc/` is not gitignored and biome lints it**, so `biome ci .` exits 1 — and that is
   exactly what the pre-commit hook runs. Unfixable during the run: `.gitignore`, `biome.json`
   and `.husky/**` were all declined for the allowlist at Gate 0.

## Contract amendments (3, one file each)

| # | At | File | Why |
|---|---|---|---|
| 1 | `gate_1` | `apps/web/src/lib/estimate.ts` | Nothing under `lib/` was writable; raised as R-2 before any code was written. |
| 2 | `gate_3_b1` | `apps/web/src/components/shared/modals/create-task-modal.tsx` | The required-field change surfaced an out-of-allowlist construction site. |
| 3 | `gate_3_security` | `apps/api/src/mcp/tools.ts` | MCP data-loss fix. Blanket off-limits narrowed to `apps/api/src/mcp/!(tools.ts)`; `packages/mcp/**` untouched. |

The stop-and-report rule fired twice and was honoured both times. Each amendment corrected an
over-tight initial allowlist rather than expanding the feature.

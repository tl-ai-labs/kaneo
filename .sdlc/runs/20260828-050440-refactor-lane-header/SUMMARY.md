# Run 3 of 4 — `opus-only-v5`, auth `vendor` — final report

Run ID `20260828-050440-refactor-lane-header` · mode brownfield · intent refactor
Branch `refactor/opus-only` at `5d1fc9104337786c3ef295ec0dc31656df371d8d`
Policy `opus-only-v5` — single tier, `claude-opus-5` via the `claude-cli` adapter
Auth mode `vendor` — every phase dispatched through the MCP server; all costs vendor-reported

---

## 1. Lead finding — the brownfield write contract has never blocked anything, on any adapter

This is the most important result of the four-run exercise, and it is not about cost.

**The gate's decision logic is correct. Its enforcement is not.** Fed synthetic PreToolUse payloads,
`plugin/scripts/write-contract-check.mjs` ALLOWs all three allowlisted paths and correctly DENYs both
`apps/web/src/components/kanban-board/**` (off-limits pattern) and the unlisted
`apps/web/src/components/public-project/list-view.tsx` (absent from allowlist). The classification is
right every time.

The defect is in how the refusal is signalled:

```js
function deny(msg, ctx = {}) {
  console.error(`[mmo-brownfield write-contract] DENY: ${msg}`);
  log("warn", "write.deny", { ... });
  process.exit(1);          // <-- line 158
}
```

Claude Code's PreToolUse protocol treats exit code **2** as the blocking error. Every other non-zero
code is a *non-blocking* error: it is surfaced, and **the tool call proceeds**. The script exits `1`.
The only exit codes in the file are `0`, `1`, `0`. It never emits the alternative
`hookSpecificOutput` / `permissionDecision` JSON protocol either — `grep -c` for both returns exactly
`0`.

So the hook runs, decides correctly, logs `write.deny` at WARN, and then lets the write through.

### Proof — live probe

Synthetic payloads only prove what the script decides, not what Claude Code does with it. So the gate
was tested live: a `Write` was issued to `apps/web/src/components/kanban-board/__mmo_gate_probe.tmp`,
a path matching the `apps/web/src/components/kanban-board/**` off-limits pattern.

**The write succeeded.** The file was deleted immediately; `git status` on `kanban-board/` is clean and
nothing was left behind.

### Three-run progression

Each run saw only part of this. Stated together it is a single escalating finding:

| Run | Adapter | What it reported | Status of that claim now |
|---|---|---|---|
| 1 | mixed opus + flash | Enforcement path "unproven" | Correct but understated |
| 2 | `antigravity-worker` | "Unprovable on this adapter" — the worker writes through its own process, so the `Write\|Edit` matcher never fires | Still true, but now the *lesser* problem |
| 3 | `claude-cli` | **Non-functional on every adapter** | The matcher does fire here and the gate still cannot refuse |

Run 2's bypass finding remains valid and is a real second hole. But run 3 removes the comforting
reading of it. `claude-cli` never writes files at all: `ClaudeCliAdapter` spawns
`claude -p --model claude-opus-5 --output-format json` with no `--allowedTools`, returns
`file_content` as JSON, and the orchestrator performs every write via `Write`/`Edit`. This is the
best case for the hook — the matcher fires on every single write — and the gate is still advisory.

Of the three claimed enforcement layers, only two were ever live this run: orchestrator discipline
(layer 1) and the allowlist check run over `packets.json` before dispatch (layer 2). Layer 3, the one
described as the layer "you cannot talk your way past", is a warning.

### The corollary that proves it has never been exercised

Fed `.sdlc/runs/<run-id>/security_review.md`, the checker **DENYs it** — `.sdlc/**` is in `off_limits`
and no carve-out exists for the run's own output directory, contrary to the orchestrator contract,
which states paths under `.sdlc/runs/<run-id>/` are auto-allowlisted.

Had the gate ever enforced, **every brownfield run would have failed on its own first artifact write** —
at Gate 1, writing `requirements.md`. A safety gate that would break the product the moment it started
working has clearly never been exercised in anger. This run's `.sdlc` artifacts landed only because
they were written via Bash, which the `Write|Edit` matcher does not cover.

### Fix

1. `deny()` must `process.exit(2)`, or emit the `hookSpecificOutput.permissionDecision: "deny"` JSON.
2. Add a run-directory carve-out so `.sdlc/runs/<run-id>/**` is allowed before `.sdlc/**` is tested.
3. Order matters: shipping (1) without (2) converts a silent no-op into a run that cannot start.

This finding, including the fix-ordering constraint, is duplicated verbatim into `manifest.json`
under `findings[0]` — a reader who opens only the manifest must not receive the defect without the
ordering constraint attached.

---

## 2. Second headline — measured vs estimated cost

Run 3 is the only run in the set that can produce this comparison: same model and same adapter as
run 1's premium tier, but with `auth_mode: vendor`, so the CLI returns real `total_cost_usd` instead
of a character-count heuristic.

### Per-phase, where run 1 estimates are available

| Phase | Run 1 (estimated) | Run 3 (measured) | Ratio |
|---|---|---|---|
| `requirements_analysis` | $0.1354 | $0.23596 | **1.74×** |
| `change_plan` | $0.2225 | $0.43582 | **1.96×** |

Both point the same way and agree with run 2's independent finding: run 1's heuristic **understated**.
The likely mechanism is per-turn context re-send, which a chars/3.8 estimate on the visible prompt
does not capture — visible in run 3's own numbers, where cached input (493,995 tokens) is 3.6× the
uncached input (136,550).

### Totals — stated carefully

Run 3 measured **$2.58435** against run 1's reported **$0.9731** estimated: a **2.66×** gap.

**This does not mean run 1 "really" cost $2.58.** The two runs differ in phase count and packet shape,
and run 1 dispatched three codegen packets to Flash at mechanical-tier rates while run 3 ran them on
Opus. The honest comparison is the per-phase ratios above, on phases that exist in both runs. The
totals are not like-for-like and should not be presented as though they were.

What can be said: the direction and rough magnitude of the estimator's error is now measured on two
phases rather than assumed, and any conclusion about the mixed policy's cost advantage that rests on
run 1's estimated premium-tier figures needs re-deriving before it is trusted.

### Run 3 per-phase measured cost

| Phase | Packet | Cost | Model latency |
|---|---|---|---|
| `requirements_analysis` | tp_req_001 | $0.23596 | 39.4s |
| `change_plan` | tp_plan_001 | $0.43582 | 103.7s |
| `plan_task_packets` | tp_decomp_001 | $0.29543 | 52.2s |
| `codegen` (new file) | tp_codegen_001 | $0.14567 | 22.0s |
| `codegen` (edit) | tp_codegen_002 | $0.19040 | 14.8s |
| `codegen` (test) | tp_codegen_003 | $0.17267 | 8.3s |
| `senior_code_review` | tp_review_001 | $0.53688 | 98.4s |
| `security_review` | tp_sec_001 | $0.57152 | 129.8s |
| **Total (8 dispatches)** | | **$2.58435** | **468.6s** |

Excluded: the pre-check smoke ($0.13513, `pass: precheck3`), per the comparability rule — runs 2–4
skip pre-check from cache, so folding it in would only inflate run 1.

Tokens: 136,550 input · 493,995 cached · 37,634 output.

Note the shape: the two review phases cost $1.10838, or **43% of the run**, more than all three
codegen packets ($0.50874) plus requirements combined. Under an all-premium policy the expensive work
is judgment about the change, not production of it — for a 22-line component.

**Hypothesis this run cannot confirm.** That split suggests the premium tier earns its keep on
judgment about *large* changes and is poor value reviewing small mechanical ones — which would be an
argument for a policy that routes review by **diff size** rather than by phase name. It is stated as
an observation to be tested, not a conclusion: n=1, on a single small refactor. Confirming it needs
the same measurement across changes of varying size, which this four-run set does not contain.

---

## 3. Wall-clock

| Run | Policy | Auth | Wall-clock |
|---|---|---|---|
| 1 | `opus-plus-flash-v37` | estimated | ~30 min |
| 2 | `flash-agsdk-only` | estimated | 15.43 h |
| 3 | `opus-only-v5` | **vendor** | **26 m 44 s** |

Of run 3's 26m44s, **7m49s** was model time; the remainder was orchestration, verification commands
and gate handling. Run 2's 15.43h is the outlier by three orders of magnitude and is a property of the
agent-worker floor, not of the task.

---

## 4. The change itself

Pure structural extraction, exactly as briefed.

| Path | Change |
|---|---|
| `apps/web/src/components/public-project/public-column-header.tsx` | new — exports `PublicColumnHeader` |
| `apps/web/src/components/public-project/kanban-view.tsx` | edited — +2 / −13 |
| `apps/web/src/components/public-project/public-column-header.test.tsx` | new — one render test |

**Cross-run artifact identity.** `public-column-header.tsx` and `kanban-view.tsx` are byte-identical to
run 1, which run 2 already matched. Three policies — mixed Opus+Flash, an all-Flash agent floor, and
all-Opus — produced identical source from the same frozen brief. With a third independent datapoint
this is a genuine result rather than a two-point coincidence.

The test file differs from run 1 cosmetically: fixture hoisted above `describe`, two fixture tasks
instead of three, one assertion reordered. One difference favours run 3 — it asserts
`expect(container.querySelector("svg")).toBeVisible()` where run 1 used `.not.toBeNull()`. That is the
stronger matcher, and it is the same axis on which run 1 beat run 2. Recorded, not corrected.

### Invariants — all mechanically verified

| Check | Expected | Actual |
|---|---|---|
| `grep -c 'p-2 shrink-0' kanban-view.tsx` | 0 | 0 |
| `grep -c 'p-2 shrink-0' public-column-header.tsx` | 1 | 1 |
| `grep -c getColumnIcon kanban-view.tsx` | 2 | 2 |
| `grep -c '<PublicColumnHeader column={column} />'` | 1 | 1 |
| `grep -c 'ProjectWithTasks["columns"][number]'` | ≥1 | 1 |

### Verification

- `pnpm --filter @kaneo/web test` — **pass**, 37 files / 113 tests (baseline 36/112; the delta is this
  run's own test).
- `pnpm --filter @kaneo/web typecheck` — **pass**, exit 0.
- `pnpm exec biome ci` on the three changed paths only — **pass**, "Checked 3 files. No fixes applied."
  Never root `pnpm lint` (Biome `--write` rewrites unrelated files); never root `pnpm test` (turbo
  `dependsOn ^build`).

### Reviews

- Senior: **approve**, `dom_identical: true`, 0 blockers, 0 majors, 0 refinement packets. Emitted both
  tokenized `(tag, className)` sequences; they are element-for-element identical.
- Security: **pass**, 0 findings, highest severity `none`. Both of its externally-checkable citations
  were verified against the repo rather than trusted: `apps/api/src/column/index.ts:60` really is
  `icon: v.optional(v.string())`, and the `Object.prototype` lookup behaviour it describes was
  reproduced directly. Not fabricated.

---

## 5. Gate 1 operator override — disclosed

The dispatched requirements phase independently proposed that the unit test assert exact Tailwind
class strings (FR-7, AC-12). The operator overruled this at Gate 1 and the amendment was applied
in place, attributed, with rationale recorded in `requirements.md` — not silently.

Rationale: class assertions duplicate the senior reviewer's tokenized comparison, degrade into
styling change-detectors after the refactor lands, and would have diverged run 3's test file from
runs 1 and 2. Leaving AC-12 standing would also have guaranteed the senior reviewer flagged the
run-1-shaped test as failing an acceptance criterion — a false finding needing explanation.

**Observed behavioural difference, not a defect:** `opus-only-v5`'s requirements phase proposed
class-level assertions where run 1's `opus-plus-flash-v37` did not. A small signal about how the same
model behaves owning every phase versus being one tier of a mixed policy — which is the kind of thing
this four-run set exists to surface.

---

## 6. Known gaps

- **`pnpm --filter @kaneo/web build` was not run, in any of the three runs.** It is outside the frozen
  verification set. Adding it to run 3 alone would have made run 3 better-verified than its
  comparators — contamination that is easy to miss because it looks like extra rigour. Consequence:
  the `@rolldown/plugin-babel` react-compiler preset in `vite.config.ts` is exercised by neither
  `test` nor `typecheck`, so the new component has never been through the compiler. Documented across
  the set rather than silently closed in one run.
- **Composition is untested** (senior review). The leaf test covers `PublicColumnHeader` in isolation;
  nothing asserts `kanban-view.tsx` still renders it. If the call site were dropped, every test in the
  repo would still pass and the header would vanish from the public board. The extraction moved
  coverage to the leaf without adding coverage at the seam it created.
- **Fixture `as` cast** — if the column shape gains a required field the header reads, the cast keeps
  the test compiling and green while production breaks.
- **`provenance.json` schema is under-documented (documentation defect, not a run defect).** An
  orchestrator inspection script read `p.files` and reported "0 files recorded"; the actual field is
  `files_touched`, and the record was complete and correct all along. **Run 2 hit this identically.**
  Two orchestrators making the same wrong assumption about the same schema is a documentation problem
  in the provenance contract, not two independent slips. Fix by naming the field explicitly in the
  provenance contract docs and in the revert reader's schema reference.

---

## 7. Rollback

```bash
/mmo:revert 20260828-050440-refactor-lane-header
```

`provenance.json` is complete: 3 files in `files_touched`, each with `sha_before`, `sha_after`,
`tracked_in_git`, and the packet that wrote it. `git_head_before` and `git_head_after` are both
`5d1fc910` with 0 commits recorded — nothing was committed or pushed, per AGENTS.md.

Manual equivalent:

```bash
git checkout -- apps/web/src/components/public-project/kanban-view.tsx
rm apps/web/src/components/public-project/public-column-header.tsx \
   apps/web/src/components/public-project/public-column-header.test.tsx
```

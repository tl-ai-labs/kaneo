# Run summary — 20260831-083417-docs-board-features

**Mode** brownfield · **Intent** docs · **Policy** `opus-plus-sonnet-max` · **auth_mode** `vendor`
**Base** `5d1fc910`, clean · **Committed** no

## Cost basis — read this before comparing

**$2.837844, CLI-measured.** Every phase was dispatched through the MCP server to the `claude-cli`
adapter; `cost_usd` is the CLI's own `total_cost_usd` verbatim, not a char-count estimate. No phase
ran in-session. This run and the `flash-agsdk` leg are the only two of the four-leg comparison on a
measured basis; the `opus-flash` and `opus-only` legs are estimated, and `opus-only` measured its own
estimator undercounting agentic phases by 2.03-2.64x. **The four totals are not a ranking.** They do
not share a basis, and the estimated pair are known-low by an unquantified factor.

Operator pre-check smoke packet ($0.076889, dispatched before `run.start`) is excluded from the total.

## Per-phase

| Phase | Packet | Model | Rule | Cost | Latency | In | Cached | Out |
|---|---|---|---|---|---|---|---|---|
| requirements_analysis | tp_req_001 | opus | 0 | $0.549637 | 121.5 s | 27,475 | 72,140 | 9,371 |
| architecture_design | — | *skipped* | — | $0 | — | — | — | — |
| plan_task_packets | tp_plan_001 | opus | 2 | $0.337442 | 50.9 s | 20,948 | 38,329 | 4,241 |
| docs (write) | tp_docs_001 | sonnet | 9 | $0.158575 | 57.6 s | 21,108 | 18,534 | 6,704 |
| senior_code_review | tp_review_001 | opus | 3 | $1.038807 | 217.2 s | 47,353 | 268,296 | 17,136 |
| docs (refinement) | tp_docs_002 | sonnet | 9 | $0.104148 | 16.2 s | 20,591 | 18,534 | 1,500 |
| tests | tp_test_001 | none | — | $0 | — | — | — | — |
| security_review | tp_sec_001 | opus | 4 | $0.649235 | 142.9 s | 26,855 | 288,292 | 9,356 |
| **TOTAL** | | | | **$2.837844** | **591.8 s** | 164,330 | 704,125 | 48,308 |

By model: opus 4 packets / $2.575121 / **90.7%**; sonnet 2 packets / $0.262723 / **9.3%**.

## Routing — confirmed from telemetry, not asserted

Both docs packets landed on `rule_index: 9`, `rule_reason: "Volume work"`, `model: claude-sonnet-5`,
matching on phase alone. The codegen rule at index 7 — the one carrying the explicit `task_type`
allowlist that required a bend in the refactor comparison — also requires `phase == "codegen"`, so a
docs packet never reaches it. **No bend was needed and none was applied.**

## Headline finding — review cost scales with repo surface, across adapters

Senior review consumed **268,296 cached input tokens for a 20-line diff** and cost **$1.038807 —
6.5x the writing phase it reviewed**. Security review consumed 288,292. Together the two reviews are
**59% of run cost** against **9%** for both writing passes combined.

The `flash-agsdk` leg showed this same shape on the `antigravity-worker` adapter. This leg shows it on
`claude-cli`, a completely different adapter. **Two adapters, one structural property: when the adapter
can read the repo and the packet asks it to verify against source, review cost scales with repo surface
rather than diff size.** That is a cross-adapter finding, not a per-policy one, and it is the most
portable result the comparison has produced.

**The counterweight belongs in the same breath: that cost is what bought the quality.** All four
senior-review defects required reading beyond the diff — S1 and S2 required grepping the whole
`apps/docs` tree to establish house style, and F2 required opening `toggleLabelGroup`, a function the
diff never touched. A reviewer seeing only the diff could not have found any of them. The 59% is not
overhead.

## Senior review — 4 defects, all verified by the orchestrator before applying

| | Class | Finding |
|---|---|---|
| F1 | factual | Labels row illustrated its "one value selected" cell with `e.g. "3 selected"` — self-contradictory. One label renders `1 selected`; the Labels chip has no `length === 1` branch, unlike the other four. |
| F2 | factual | `toggleLabelGroup` (`:233-247`) toggles every workspace label sharing a name+color while the chip counts raw ids, so one UI selection can add several ids. The original "how many values are selected" framing was quietly wrong. |
| S1 | style | The four em dashes were the **only** em dashes in the entire `apps/docs` tree. Post-fix: zero, tree-wide. |
| S2 | style | The markdown table was the **only** table under `apps/docs/core/functional`; this docs set reserves tables for reference pages. Replaced with a bullet list. |

It also checked contractions and explicitly declined to raise `It's`, citing sibling precedent —
correctly. This reproduces the same-tier "review catches its own writer's style slip" result from the
flash-agsdk leg, here on a cross-tier loop.

## Verification — deliberately absent, and correct

`apps/docs` has no `package.json`. It is a content-only Mintlify directory, so despite
`pnpm-workspace.yaml` globbing `apps/**` it is not a package and has no test, lint or build script.
`biome ci` on the file reports *"These paths were provided but ignored"* — `biome.json` excludes
`.mdx`. **No meaningful automated test exists for this artifact.** Logged as
`task_type: "no_automated_check"` with the reason rather than silently skipped, matching all three
sibling runs.

Manual checks that did run: 18 insertions / 0 deletions / 1 file; zero em dashes in file and tree-wide;
zero table lines; prohibited-topic grep (`wip|work in progress|hours`) no match; `apps/docs/docs.json`
unmodified; artifact sha256 `253b0554…` matches provenance `sha_after`.

## Defects observed

**1. Frozen-brief AC-5 (third sighting).** The brief names
`apps/web/src/hooks/use-task-filters.ts` as the falsifiability anchor; the board route wires
`useTaskFiltersWithLabelsSupport` from `use-task-filters-with-labels-support.ts`. Neutralised in the
requirements packet by declaring the reference inaccurate and anchoring on `board-toolbar.tsx`.
Disclosed rather than silently corrected. **Impact: none.**

**2. Provenance double-write backup gap (fourth sighting, best-evidenced yet).** The sha chain proves
it: record 1 `0eb427e3` (pristine) → `67d77c6d`, `backup_path: null`; record 2 `67d77c6d` →
`253b0554`, `backup_path` **set but capturing record 1's output, not pristine**. Workaround applied:
`git checkout` to HEAD before applying the refinement, so the final state is HEAD plus one clean
application rather than a stack of two writes. **That workaround is only valid for a tracked, clean
target** — for an untracked or already-dirty file, `backup=yes` would be a false assurance and
`/mmo:revert` would restore the wrong state. Four sightings across two job types and three policies:
this is a reproducible defect in the backup contract, not an anecdote.

**3. Write-contract scope gap (new).** *The write contract governs packet writes but not the setup step
that writes the contract.* `.gitignore` (+6) and `biome.json` (+1) carry mtime **08:42:12** — 55 seconds
before `run.start` (08:43:07) and 14 minutes before the first packet write (08:56:37). They are Gate 0
setup edits, both additive and benign, neither on `off_limits`. They are **absent from
`provenance.json` entirely**, which means `/mmo:revert` has never covered them on any of the eight runs
across both comparisons. Recorded as its own finding.

**4. PreToolUse hook cannot block (carried).** `write-contract-check.mjs` denies with exit 1; PreToolUse
blocks only on exit 2, so the hook was advisory for the whole run. Enforcement rested on orchestrator
discipline plus the packet `artifact_path` allowlist check. **Impact: none this run** — provenance and
`git status` agree on one path and the hash matches — but latent for a non-docs intent with a wider
blast radius.

## Security review

**pass-with-notes.** No information disclosure: the added text describes only what an authenticated user
already sees, quotes only public i18n strings, and names no internal symbol, path or endpoint. The
label-grouping sentence was assessed specifically rather than generically — the grouping is a
client-side dedupe over a `workspaceAccess`-gated, workspace-scoped fetch, so it reveals nothing
cross-workspace, and the word "workspace" in it is the protective reading. Board filtering has **no
permission precondition at all** (client-side predicates, no guard in the component), so omitting a
permissions note — unlike sibling `manage-workspace-labels.mdx`, which documents gated mutations — is
correct rather than an omission. No dependency, script, build step, MDX import, component or JSX added.

## Artifacts

`requirements.md` · `packets.json` · `review.md` · `security_review.md` · `provenance.json` ·
`telemetry.jsonl` · `manifest.json` · `intent_brief.md` · `discovery.md` · `baseline.json`

Changed: `apps/docs/core/functional/plan-and-execute-tasks.mdx` (+18 / -0). Not committed.

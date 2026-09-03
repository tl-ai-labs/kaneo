# Public Column Header Refactor Audit

**Verification of the `refactor-public-column-header` brief across four model policies.**

Four model policies each performed the same extraction. All four produced **byte-identical
production source**. Everything green: tests, typecheck, and lint on every branch. The only
meaningful variation is in the tests, and the only defect found is in observability, not code.

| | |
|---|---|
| **Brief** | `refactor-public-column-header` |
| **Target** | `apps/web/src/components/public-project/` |
| **Base** | `5d1fc910` (merge-base for all four branches) |
| **Verified** | 3 Sep 2026 |

---

## Verdict

| Metric | Result | |
|---|---|---|
| Runs that shipped the code | **4 / 4** | Exactly the three in-scope files |
| Distinct production source variants | **1** | Component and call site identical across all four |
| Branches fully green | **4 / 4** | Test suite, typecheck, and `biome ci` |
| Acceptance criteria met | **6 / 6** | By every run |
| Defects found | **1** | Observability — a 15-hour phase reported as success |

---

## What each run generated

Every branch is a single squashed commit off `5d1fc910` containing three source files — exactly
the three the brief put in scope, no more:

| File | Status | Blob (all four branches) |
|---|---|---|
| `public-column-header.tsx` | new | `0629e6c5` — **identical** |
| `kanban-view.tsx` | modified | `91fdb4fc` — **identical** |
| `public-column-header.test.tsx` | new | four **distinct** blobs |

Each run's own `provenance.json` records exactly these three paths and nothing else, with
matching content hashes (`sha256:b2913c8a…` for the component, `sha256:36346b77…` for the call
site) across all four runs. The pipeline's self-accounting agrees with what is on disk.

### One caveat on the branch diffs

Every commit also carries `.gitignore` and `biome.json` changes — plugin scaffolding that ignores
`.sdlc/**/*.db` and excludes `.sdlc` from Biome. Two things are worth knowing:

- **`.gitignore` is named off-limits in this brief.** It appears in the "Files off-limits" list
  under AI configs.
- **It is not in any run's provenance.** No run's write contract recorded touching it, so this
  was session-level setup squashed into the same commit rather than codegen output. The
  per-branch comment wording also differs (`~18MB`, `~20MB`, none), so it was authored per
  session, not by a fixed installer.

The write contract held. The **branch diff overstates what the run actually wrote**, which is a
commit-hygiene issue for this comparison, not a scope violation by the pipeline.

---

## Verification run

Executed in a detached worktree with the repo's own toolchain, leaving the working tree untouched.

| Branch | Test files | Tests | Δ tests | `typecheck` | `biome ci` |
|---|:-:|:-:|:-:|:-:|:-:|
| `main` (baseline) | 36 | 112 | — | PASS | PASS |
| `refactor/opus-only` | 37 | 113 | +1 | PASS | PASS |
| `refactor/opus-flash` | 37 | 113 | +1 | PASS | PASS |
| `refactor/opus-sonnet` | 37 | 113 | +1 | PASS | PASS |
| `refactor/flash-only` | 37 | 115 | +3 | PASS | PASS |

No failures, no new warnings, no regressions against baseline anywhere.

### Acceptance criterion 2, proven rather than asserted

The brief demands the rendered DOM and Tailwind classes be **byte-identical** to before the
change. Reading the diff suggests this; it does not prove it, because JSX whitespace handling
differs between the inline and extracted forms.

So it was measured: `PublicKanbanView` was rendered on `main` and on the refactor branch with the
same fixture, and `container.innerHTML` was captured from each.

```
3204 bytes  dom-main.html
3204 bytes  dom-refactor.html
diff → no output.  Byte-identical.
```

Because the component and call site are identical across all four branches, this proof covers all
four runs.

---

## Acceptance criteria

| # | Criterion | opus-flash | opus-only | opus-sonnet | flash-only |
|---|---|:-:|:-:|:-:|:-:|
| 1 | Inline header gone, renders `<PublicColumnHeader>` | ✓ | ✓ | ✓ | ✓ |
| 2 | Rendered DOM and classes byte-identical | ✓ | ✓ | ✓ | ✓ |
| 3 | Column typed from `ProjectWithTasks["columns"][number]` | ✓ | ✓ | ✓ | ✓ |
| 4 | `typecheck` passes | ✓ | ✓ | ✓ | ✓ |
| 5 | `test` passes with no new failures | ✓ | ✓ | ✓ | ✓ |
| 6 | `biome ci` clean on changed paths | ✓ | ✓ | ✓ | ✓ |

All four non-goals were also respected: no `Column` → `Lane` rename, no shared component with the
private board, `kanban-board/**` untouched, no container extraction, and neither oversized
list-view file was split.

---

## Where the runs actually differ: the tests

Production code is one artifact. The test file is the only place the four policies diverge.

| | opus-flash | opus-only | opus-sonnet | flash-only |
|---|---|---|---|---|
| Test cases | 1 | 1 | 1 | 3 |
| Assertions | 3 | 3 | 3 | 3 |
| Fixture scope | in-test | module | in-test | describe |
| Fixture tasks | 3 named | 2 named | 2 named | `[{}, {}]` |
| Type cast | `as` | `as` | `as` | `as unknown as` |
| Assertion style | mixed | `toBeVisible` | `toBeVisible` | `toBeTruthy` |

Two observations that matter more than the counts:

**`flash-only` has the most tests and the weakest assertions.** All three use `toBeTruthy()` on
the result of `screen.getByText(...)`, but `getByText` already throws when nothing matches — so
the assertion adds nothing the query has not already done. The other three use `toBeVisible()`,
which actually checks something further. Test count went up; proof strength went down.

**That third test was not the model's idea.** `flash-only`'s manifest records Gate 2 as
`"revise -> test packet added by coordinator instruction"`. The extra coverage came from an
operator, which makes its `+3` non-comparable with the other runs' `+1`.

**A gap shared by all four:** every test asserts *content* — the name, the count, an icon is
present. None asserts the class names or DOM structure that acceptance criterion 2 is actually
about. A regression that changed `p-2 shrink-0` would pass all four test suites. The DOM proof
above had to be written by hand.

---

## The one defect

**Observability · `refactor/flash-only` · A 15-hour phase reported as success**

The `change_plan` phase logged `latency_ms: 54415269` — **906.9 minutes, or 15.1 hours** — against
a hard worker cap of 540 seconds (`gemini_worker.py:208`, `--timeout` default 540). The event
records `"success": true` and `"retry_count": 0`, and the manifest carries it straight through to
`pipeline_wall_clock_hours: 15.428`.

Nothing failed and nothing retried. The phase produced a usable change plan and the run was
accepted at every gate. But a hard timeout was exceeded by **100×** and the pipeline reported
health throughout, so no signal reached the operator. Every other phase in that run finished
between 0.3 and 7.9 minutes.

Two consequences worth naming:

- The overview's "18.9 min" for this run is the total *minus* this phase. The wall-clock truth is
  15.4 hours.
- Any policy comparison on latency is unreliable while a phase can overrun its cap silently.

---

## What we take from this

**Recommendation: ship the source from any branch — it is one artifact — and take
`opus-sonnet`'s test file.** It uses an in-test fixture, a single type cast, and consistent
`toBeVisible()` assertions. Before merge, add one assertion for the header's class structure,
since no run wrote the test that acceptance criterion 2 actually calls for.

On cost, the cheapest run bought exactly the same production code as the most expensive:

| Policy | Cost | Production source |
|---|---:|---|
| `opus-plus-flash-v37` | $0.97 | identical |
| `flash-agsdk-only` | $1.03 | identical |
| `opus-plus-sonnet-max` | $2.04 | identical |
| `opus-only-v5` | $2.58 | identical |

- **A 2.7× spend spread bought nothing.** For a well-specified structural refactor, the brief did
  the work; the model choice did not change the output at all.
- **Test count is a poor quality proxy.** The run with the most tests has the weakest assertions,
  and its extra test was operator-prompted rather than model-generated.
- **The write contract held under audit.** Provenance matched disk on all four runs. The
  `.gitignore` noise is commit hygiene at the session level, not the pipeline exceeding scope.
- **Silent timeout overrun is the real finding.** A phase ran 100× over its hard cap and reported
  success. That is a bug in the harness, not in any model's output, and it invalidates latency
  comparisons until fixed.

---

## Method

Each branch was checked out in a detached `git worktree` with `node_modules` symlinked from the
primary checkout, so the working tree was never modified. For every branch: full
`vitest run` on `@kaneo/web`, `tsc --noEmit` against both `tsconfig.app.json` and
`tsconfig.node.json`, and `biome ci` scoped to `apps/web/src/components/public-project/`.
Criterion 2 was proven by rendering `PublicKanbanView` on `main` and on the refactor branch with
an identical fixture and diffing `container.innerHTML`. Scope was audited against each run's
`provenance.json` rather than the branch diff alone. The worktree was removed afterwards.

**Not covered here.** No browser pass on the live public board — the DOM equality proof makes one
largely redundant, but it has not been done. The three feature-extend briefs remain unverified.

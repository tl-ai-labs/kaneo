# Gate 2 decision record — test packet added by coordinator instruction

**Outcome:** `revise: add the test packet`. Everything else in `change_plan.md` approved as
written (boundary at the outer `p-2 shrink-0` div, removal range 27-39, retained `getColumnIcon`
import, component text verbatim).

## What the plan said

`tp_plan_001` returned `unit_test_recommended: false`, reasoning that `PublicColumnHeader` is a
pure presentational leaf with no state, no conditional branches and no side effects, so the
`column` shape is already verified by TypeScript at compile time.

## Why the test was added anyway

By coordinator instruction, for artifact-matched comparability with run 1 — NOT because the plan
was judged wrong.

The correction that matters: run 1's test does not exist because Opus autonomously chose it. Run
1's orchestrator raised the same question at its Gate 1 as an open item, recommended adding it,
and the coordinator agreed and directed it. Treating the test's absence from run 2's plan as
"Flash decided differently from Opus" would compare the coordinator's decision against Flash's,
which measures nothing.

Tie-breaks, all pointing the same way: the four-run set exists to isolate policy; scope decisions
were frozen in `gate0-answers.json` so runs differ only by policy; two further runs follow. An
artifact-matched set is worth more than one unclean judgment datapoint.

## Recorded judgment divergence — the floor policy's reasoning held up

The plan's reasoning is sound, and arguably sounder than run 1's. Run 1's own test asserts
`container.querySelector("svg")`, which is truthy on every branch of `getColumnIcon` including
both fallbacks — it proves *an* icon renders, not the *right* icon. That weakness was noted at
run 1's Gate 3.

**The final report must state that run 2 shipped this test on coordinator instruction, overriding
its own plan. It must not imply run 2 chose to ship it.**

## Test spec (frozen, matching run 1 as closely as the brief allows)

- vitest + `@testing-library/react`
- fixture `id: "in-progress"` — maps to `CircleDot` in `constants/column-icons.ts`, so the
  unmocked `getColumnIcon` takes its primary branch
- `@/lib/column` left UNMOCKED
- icon presence asserted via `container.querySelector("svg")`
- name and count asserted via `screen` queries
- NO assertions on Tailwind class strings

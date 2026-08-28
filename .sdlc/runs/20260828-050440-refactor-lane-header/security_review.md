# Security review — public board column header extraction

Run: `20260828-050440-refactor-lane-header`
Module: `apps/web/src/components/public-project`
Change class: structural extraction of presentational JSX (brownfield refactor)

## Scope

Reviewed, complete set of files changed by this run (confirmed against `git status`; no other
modified or untracked source file):

1. `apps/web/src/components/public-project/public-column-header.tsx` — new; the extracted component.
2. `apps/web/src/components/public-project/kanban-view.tsx` — edited; 2 insertions, 13 deletions
   (13 lines of inline JSX replaced by `<PublicColumnHeader column={column} />` plus its import).
3. `apps/web/src/components/public-project/public-column-header.test.tsx` — new; one render test.

Read as supporting context but **not** changed and **not** in scope to fix:
`apps/web/src/lib/column.tsx` (`getColumnIcon`), `apps/web/src/constants/column-icons.ts` and its
`projectIcons` spread, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`,
`apps/web/package.json`.

Explicitly excluded, with reasons:

- **The public API endpoint's payload shape.** The public board's response body is unchanged by this
  run — no API route, validator, controller, serializer or permission definition was touched.
  Whether that endpoint over-returns is a pre-existing question about server code, not a delta this
  diff can create or fix.
- **`apps/web/src/components/kanban-board/**` (private board).** An off-limits path for this run;
  `git status` confirms it is unmodified.
- **`pnpm-lock.yaml`.** Off-limits and unmodified.

## Findings

None. No finding of any severity (none/low/medium/high/critical) is attributable to this change.
The five checks below are the evidence for that statement, not findings.

### Check 1 — Data exposure delta: none

The extracted component receives the whole `column` object as one prop and renders exactly the same
fields as the pre-change inline JSX:

| Field | Use | Before | After |
| --- | --- | --- | --- |
| `column.id` | argument to `getColumnIcon` (key lookup, not rendered) | yes | yes |
| `column.isFinal` | argument to `getColumnIcon` (icon fallback branch) | yes | yes |
| `column.icon` | argument to `getColumnIcon` (key lookup, not rendered) | yes | yes |
| `column.name` | JSX text child of `<h3>` | yes | yes |
| `column.tasks.length` | JSX text child of `<span>` | yes | yes |

**No previously-unrendered field is now rendered.** The rendered content is identical; only the
module the DOM originates from changed. There is no new field access, no spread of `column` into DOM
attributes, no `JSON.stringify`, no logging.

Passing a wider object as a prop does not by itself expose anything. Exposure is a function of
(a) what is serialized to the client and (b) what is rendered. Both are unchanged here: this is
client-side code operating on data the public endpoint had **already** returned to the browser
before this diff existed. `kanban-view.tsx` held the same full `column` object in scope prior to the
extraction; moving it one component deeper crosses no trust boundary, because a React prop is not a
boundary — it is an in-process reference inside a bundle the client already has.

### Check 2 — XSS / injection: no vector introduced

- `column.name` and `column.tasks.length` are rendered as JSX **text children**. React escapes text
  children; neither can produce markup.
- No `dangerouslySetInnerHTML` anywhere in the new file or the diff.
- No `href`, `src`, `style`, `srcset`, or event-handler attribute receives interpolated data. Every
  attribute in the extracted component is a static `className` string literal.
- No template string is injected into an attribute; no `eval`, `Function`, `innerHTML`, or
  `document.write`.

**Can `column.icon` escape the fixed icon map?** Resolved from the supplied source. In
`apps/web/src/lib/column.tsx` the flow is `columnIcons[resolvedIconName as keyof typeof columnIcons]`
— a property read on the object literal in `apps/web/src/constants/column-icons.ts`, *not* a
component reference, URL, or dynamic import. For **own** properties the answer is no: the value can
only be one of the lucide-react components in `columnIcons` (its own keys plus the `projectIcons`
spread). The string is never used as a URL, a path, an import specifier, or a `React.createElement`
type derived from user text — so no script-loading or HTML-injection primitive exists on this path.

For completeness: an object-literal property read does consult `Object.prototype`, so a non-map
string such as `"toString"` or `"valueOf"` resolves to a prototype method rather than `undefined`
and passes the truthy `if (Icon)` gate. That behavior lives entirely in the unchanged
`getColumnIcon` and predates this run; it is not an injection vector (the worst outcome is a broken
render — no markup is produced). It is recorded under residual risks below, not as a finding here,
because this diff neither introduced nor altered it.

### Check 3 — Supply chain: no dependency added, test cannot ship

- No dependency added. `pnpm-lock.yaml` is unmodified (and was off-limits for this run).
- The test file imports `@testing-library/react` and `vitest`, both already present in
  `apps/web/package.json` `devDependencies` (alongside `@testing-library/jest-dom` and `jsdom`).
  No new package, no new transitive tree, no new install-time script.
- **The test file cannot reach the production bundle**, for three independent reasons:
  1. `vite build` bundles by reachability from the app entry (`index.html` → src entry). A module is
     included only if transitively imported from that entry. Nothing imports
     `public-column-header.test.tsx` — the import edge runs the other way (test → component).
  2. `apps/web/vitest.config.ts` scopes tests via `test.include = ["src/**/*.test.{ts,tsx}"]` under
     the `jsdom` environment. That config governs the test runner only and is not part of the build
     graph.
  3. The TanStack Router plugin is configured with `routeFileIgnorePattern: "\\.test\\.tsx?$"`, so a
     co-located test cannot be pulled into the generated route tree — closing the one path by which
     a `.test.tsx` file could otherwise become reachable from the entry without an explicit import.

### Check 4 — Secrets: none introduced

No environment variable, credential, token, API key, hostname or URL appears in any of the three
changed files. The extracted component performs no I/O: no `fetch`, no query hook, no mutation, no
WebSocket subscription, no `import.meta.env` read. The test constructs a literal fixture object and
renders it; it contacts nothing.

### Check 5 — Workspace / authorization boundary: intact

- The extracted component's only two imports are `getColumnIcon` from `@/lib/column` and a
  `type`-only import of `ProjectWithTasks`. The type import is erased at compile time and adds no
  runtime code. `@/lib/column` was **already** imported by `kanban-view.tsx` before this change (and
  still is), so the public bundle's runtime module set is unchanged.
- **No auth-only import entered the public bundle.** Nothing from `@/components/kanban-board/**`,
  no permission hook, no session/user context, no mutation hook, no i18n or modal dependency of the
  private `ColumnHeader` is referenced.
- **No component is shared across the auth boundary.** The stated non-goal is respected: the private
  board keeps its own permission-gated `ColumnHeader`, and `apps/web/src/components/kanban-board/**`
  is unmodified per `git status`. The new component is a sibling under `public-project/`, not a
  shared abstraction.
- This run changed no API route, validator, controller, or permission definition, so the API remains
  the sole authority for authorization exactly as before. The extracted header renders no action
  control, so there is nothing here whose visibility could be mistaken for an authorization check.

## Threat-model delta

**Nothing.** Justification, rather than assertion:

- **Entry points** — unchanged. No new route, no new network call, no new message/event listener,
  no new user-supplied input reaches new code. The data flowing through `PublicColumnHeader` is the
  same object, from the same already-completed public fetch, as before the diff.
- **Trust boundaries** — unchanged. The one boundary that matters (browser ← public API response)
  is on the server side of the wire and untouched. A React prop hand-off between two modules of the
  same client bundle is not a trust boundary; both modules run with identical privilege in the same
  origin and JS context.
- **Sinks** — unchanged, and identical line-for-line: two escaped text children and one key lookup
  into a static map. No sink was added, widened, or given a new source.
- **Code reachable in production** — net unchanged. One module was added and its exact body removed
  from another; the test module is unreachable from the build entry (Check 3).
- **Attacker capability** — unchanged. Any attacker model that could influence `column.name`,
  `column.icon`, or the task count before this diff can influence them to precisely the same extent
  after it, with the same rendered outcome.

The correct summary is that this is a no-op with respect to the attack surface: same inputs, same
sinks, same escaping, same bundle contents, different file boundary.

## Residual risks not introduced by this change

Pre-existing properties of the public board. Listed so a reader is not surprised; **none is caused
by this run and none is in scope to fix here.** No action is proposed against this diff.

1. **`getColumnIcon` prototype-chain lookup (pre-existing, low).** `columnIcons[resolvedIconName]`
   is an unguarded property read on an object literal, so prototype keys (`"toString"`, `"valueOf"`,
   `"constructor"`) resolve to `Object.prototype` members instead of `undefined` and satisfy the
   `if (Icon)` check. The API stores `icon` as `v.optional(v.string())`
   (`apps/api/src/column/index.ts`) with no enum constraint, so a workspace member with column-edit
   rights can persist such a value, and it would render on the shared public board. Impact is a
   degraded or failed client-side render of that column header, not injection — no markup or script
   results. Lives in unchanged `apps/web/src/lib/column.tsx`; affects the private board identically.
2. **The public board is unauthenticated by design (pre-existing, informational).** Anyone holding
   the share slug sees column names, task counts, and task cards. Confidentiality therefore rests
   entirely on the server-side share model and on what the public endpoint chooses to serialize —
   both outside this run's changed files.
3. **Shape of the public payload (pre-existing, informational, unassessed).** Whether the public
   endpoint returns column or task fields beyond what the UI renders is a server-side question this
   review did not examine, because this run changed no server code and could not alter the answer.
   Worth a separate, API-scoped review if it has never had one — not a consequence of this diff.

## Verdict

**pass** — no findings, no attack-surface delta; the only notes concern pre-existing code listed
under residual risks.

---

## Orchestrator verification of this review's citations

Both externally-checkable claims in this document were verified against the repo after the review
was produced, because a reviewer citing a file it was not given is a fabrication risk:

- `apps/api/src/column/index.ts:60` is exactly `icon: v.optional(v.string())`. Confirmed present.
  (Line 136 additionally has `icon: v.optional(v.nullable(v.string()))`.) The citation is accurate.
- The prototype-chain behaviour was reproduced directly: on an object literal of the same shape,
  `toString`, `valueOf` and `constructor` all return truthy functions, while an unknown key returns
  `undefined`. The described mechanism is real.

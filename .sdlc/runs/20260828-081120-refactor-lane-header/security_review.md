# Security Review — public-project column header extraction

## Scope

Changed files only, all under `apps/web/src/components/public-project/` (the unauthenticated public read-only board):

- `public-column-header.tsx` — new component
- `public-column-header.test.tsx` — new test
- `kanban-view.tsx` — one edit: header JSX replaced by `<PublicColumnHeader column={column} />`

Refactor intent. Reviewed against the six requested checks plus the relevant AGENTS.md boundaries.

## Findings

**1. New field exposure on the public board — severity: none**

The extracted component reads exactly five values: `column.id`, `column.isFinal`, `column.icon` (all three passed to `getColumnIcon`), `column.name`, and `column.tasks.length`. The diff of `kanban-view.tsx` shows the removed block reading the identical five and nothing else. Byte-for-byte the same rendered output; no field reaches the public DOM that was not already there. `column.id` and `column.icon` remain non-rendered — they only select an icon from a static whitelist.

**2. Whole-object prop as a future-leak path — severity: info**

Direct answer: it does create a narrow future-leak path, but not an automatic one, and the type does not make the field list visible at review time.

- Not automatic: React renders nothing it is not told to render. A newly added column field cannot appear on the public board unless someone edits the JSX inside `PublicColumnHeader`. The prop widening moves the *opportunity* from the call site into the component; it does not create leakage on its own. Had the component taken five scalars, adding a field to the public board would have required touching both the component and the call site — two review surfaces instead of one.
- Visibility is the real cost: the prop type is `ProjectWithTasks["columns"][number]`, and `ProjectWithTasks` is derived from `InferResponseType` of the tasks endpoint. A reviewer reading either the component signature or the call site sees no enumerated field list, so they cannot tell from the diff what else is in scope. Today the column record carries only `id`, `projectId`, `name`, `slug`, `position`, `icon`, `color`, `isFinal`, timestamps, and `tasks` — nothing sensitive — so the present exposure is zero.
- Worth noting for orientation, not as a finding: because the type is inferred from the API response, the actual control on public field exposure lives in the API serializer for the public project route, not in this component. That control is untouched here.

No change requested. If the team wants the tighter contract, destructuring to named scalars in the props type is the cheap version.

**3. XSS surface — severity: none**

No `dangerouslySetInnerHTML`, no `innerHTML`, no `href`/`src`/`style` built from data, no URL or script interpolation. `column.name` goes through JSX text interpolation and is escaped by React. `column.icon` is never rendered as text or markup — `getColumnIcon` uses it only as a lookup key into the static `columnIcons` map, falling back to a hardcoded `CheckCircle2`/`Circle`; an attacker-controlled string yields a fallback icon, not an arbitrary component or element name. No new sink introduced.

**4. Test fixture — severity: none**

Fixture is `{ id: "in-progress", name: "In Progress", isFinal: false, icon: null, tasks: [{ id: "task-1" }, { id: "task-2" }] }`. No credentials, tokens, keys, URLs, hostnames, emails, or real user or workspace data. Entirely synthetic.

**5. Auth, authorization, workspace boundaries, permissions — severity: none (confirmed untouched)**

Confirmed. No API route, controller, middleware, session, or `requireWorkspacePermission` code is in the diff. No import from `@kaneo/permissions` and no permission or capability check added, removed, or relocated. This is presentation-layer JSX movement inside a view that is already unauthenticated by design; the API remains the sole authority for what the public project endpoint returns.

**6. Public bundle import graph — severity: none (confirmed unchanged)**

`public-column-header.tsx` imports `getColumnIcon` from `@/lib/column` (already imported by `kanban-view.tsx` pre-change, and still used there for the non-extracted empty-state call site, so the existing import is not stale) and a type-only import of `ProjectWithTasks`, which is erased at build and adds no runtime edge. `kanban-view.tsx` adds one relative import to a sibling in the same public-project directory. No auth store, session hook, private-board component, or authenticated fetcher was pulled in. The public unauthenticated bundle's runtime module set is unchanged.

## Residual risk

One item, low and non-blocking: the `column` prop's field list is not visible at review time, so a future field added to the public column payload would be renderable from inside `PublicColumnHeader` without a second review surface. This is contingent on both a future API field addition and a future edit to this component. Nothing in the current diff is affected.

## Verdict

**pass** — no new exposure. The rendered output is identical to pre-change, no new XSS sink, no secret-like fixture data, no auth/authz/permissions surface touched, and no widening of the public bundle's imports. The whole-object prop is an information-visibility note (finding 2), not a defect.

# Security Review — brownfield refactor

- **Run:** `20260827-085807-refactor-lane-header`
- **Intent:** `refactor` (brownfield, changed-files scope)
- **Base commit:** `5d1fc9104337786c3ef295ec0dc31656df371d8d`
- **Verdict:** **pass**

## Scope reviewed

Scoped to the three files recorded in
`.sdlc/runs/20260827-085807-refactor-lane-header/provenance.json` (`files_touched`). The whole
codebase was deliberately **not** audited, per the intent matrix for `refactor`.

| # | File | State |
|---|---|---|
| 1 | `apps/web/src/components/public-project/public-column-header.tsx` | new (untracked) |
| 2 | `apps/web/src/components/public-project/kanban-view.tsx` | edited (tracked) |
| 3 | `apps/web/src/components/public-project/public-column-header.test.tsx` | new (untracked) |

Commands used to establish the pre-change baseline:

```
git -C /home/sangeetha/projects/kaneo diff HEAD -- apps/web/src/components/public-project/
git -C /home/sangeetha/projects/kaneo show HEAD:apps/web/src/components/public-project/kanban-view.tsx
```

Supporting reads (unchanged files, read to resolve the import graph, not audited as targets):
`apps/web/src/lib/column.tsx`, `apps/web/src/types/project/index.ts`.

Surface context: `public-project/` is the **public, unauthenticated, read-only** board. The
private authenticated board (`apps/web/src/components/kanban-board/`) was confirmed present on
disk and confirmed untouched.

## Risk delta vs pre-change

**None.** This is a pure structural extraction with no security-relevant change.

The strongest single piece of evidence: the removed inline block and the new component body are
**byte-identical once whitespace is normalized**. Extracting the exact 13-line JSX block from
both sides and stripping spaces and newlines yields the same string:

```
<divclassName="p-2shrink-0"><divclassName="flexitems-centerjustify-between"><divclassName="flex
items-centergap-2">{getColumnIcon(column.id,column.isFinal,column.icon)}<h3className="font-medium
text-foreground">{column.name}</h3><spanclassName="text-smtext-muted-foreground">
{column.tasks.length}</span></div></div></div>
```

Same rendered fields, same escaping semantics, same component boundary from the browser's point
of view. No new data is read, no new dependency is added, no authorization decision moves.

## Findings

*No findings. The table is intentionally empty.*

| id | severity | file | issue | recommendation |
|---|---|---|---|---|
| — | — | — | — | — |

## Checks performed

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | **Data exposure delta** | **pass** | The set of `column.*` expressions is identical on both sides: `column.icon`, `column.id`, `column.isFinal`, `column.name`, `column.tasks.length`. Only `column.name` and `column.tasks.length` reach the DOM as text; `id`/`isFinal`/`icon` are arguments to the icon resolver and are never rendered. No assignee, email, description, or internal id was introduced. |
| 2 | **Bundle / import graph** | **pass** | `public-column-header.tsx` imports exactly two modules: `getColumnIcon` from `@/lib/column` (value) and `ProjectWithTasks` from `@/types/project` (**`import type`**, fully erased at build — zero runtime weight, no bundle contribution). `apps/web/src/lib/column.tsx` was read in full: it is a pure icon lookup over `@/constants/column-icons` plus two `lucide-react` icons. Grep for `useSession`, `useAuth`, `permission`, `useMutation`, `useQuery`, `fetch(`, `zustand`, `store`, `process.env` across the changed files and `lib/column.tsx` returned no matches. `@/types/project/index.ts` is type-only throughout (`import type` / `export type`). No auth-only, store, mutation, or modal code enters the public bundle. |
| 3 | **XSS surface** | **pass** | Grep for `dangerouslySetInnerHTML`, `innerHTML`, `createElement`, `href=`, `src=`, `eval(`, `new Function` across all three changed files: no matches. Every dynamic value (`column.name`, `column.tasks.length`) is a JSX **text child**, React-escaped. No value is interpolated into a URL or any HTML attribute — `className` values are all static string literals. |
| 4 | **Authorization** | **pass** | No authorization decision was introduced, moved, duplicated, or weakened; there is none in this component, and there was none in the block it replaced. Boundary confirmed intact in both directions: `grep -rn "kanban-board" apps/web/src/components/public-project/` → no matches, and `grep -rn "public-project\|public-column-header" apps/web/src/components/kanban-board/` → no matches. The `kanban-board/` directory was verified to exist (`column`, `index.tsx`, `task-card-context-menu`, `task-card.tsx`, `task-labels.tsx`, `task-labels.test.tsx`), so the empty grep is a genuine pass and not a missing-path artifact. The private board's permission-gated header remains a separate, unshared component. |
| 5 | **Secrets / logging** | **pass** | Grep for `console.`, `api_key`/`api-key`/`apikey`, `secret`, `password`, `token`, `process.env`, `import.meta.env`, `Bearer`, and email-shaped literals across all three changed files: no matches. No logging statement of any kind was introduced. |
| 6 | **Test fixture** | **pass** | The fixture is entirely synthetic: `id: "in-progress"`, `name: "In Progress"`, `isFinal: false`, `icon: null`, and three tasks with ids `"task-1"`, `"task-2"`, `"task-3"`. No real user data, no credential-shaped string, no live endpoint. The test is unmocked by design so the real `getColumnIcon` executes; it asserts on a rendered `svg`, the name, and the count. |
| 7 | **Dependencies** | **pass** | `git status --porcelain` and `git diff HEAD --stat` over `package.json`, `apps/web/package.json`, and `pnpm-lock.yaml` return empty — all unchanged. No new supply-chain surface. |

### Check not run, and why

`npm audit --omit=dev` was **not** executed. This run introduces no dependency delta (check 7),
so an audit would report only pre-existing whole-repo advisories, which are out of scope for a
changed-files `refactor` review and cannot be actioned from this run. Per the checklist, the
audit is a gating step for `deps` intents. Treat the repo's dependency posture as **unassessed by
this review** rather than as clean.

## Residual risk / notes

- **Prop surface is wider than consumption (informational, not a finding).** The component
  receives the whole `column` object, including the full `tasks` array, while consuming only four
  fields plus `tasks.length`. This is not an exposure: the parent already holds and renders that
  same array via `PublicTaskCard`, and this is client-side code where the data has already
  reached the browser. Nothing extra is rendered. Narrowing the prop would be a readability
  choice, not a security fix.
- **`kanban-view.tsx` still imports `getColumnIcon`** and legitimately so — it is used in the
  empty-state block that was not extracted. Not a dead import.

## Noted (pre-existing, out of scope — non-blocking)

These are outside the three changed files and must not gate this run.

- `apps/web/src/lib/column.tsx` resolves icons via bracket lookup on plain object literals
  (`DEFAULT_COLUMN_ICON_NAMES[columnId]`, `columnIcons[resolvedIconName]`). A key that collides
  with an inherited `Object.prototype` member could yield a non-component value. Unchanged by
  this run, on the same code path as before, and it requires a workspace-controlled column icon
  name. Advisory only.
- `.gitignore` was modified outside this run's `files_touched` (adds `.sdlc/` and `.hook-logs/`).
  This is security-**positive**: run artifacts, whose backups echo source content, are kept out
  of git.
- `.claude/settings.local.json` is untracked and **not** covered by `.gitignore`
  (`git check-ignore` returns non-zero), so a `git add -A` would stage it. It currently contains
  no secret-shaped values (zero matches for `key|secret|token|password`). Consider ignoring it.

## Required fixes before sign-off

None. No finding from this run blocks Gate 3.

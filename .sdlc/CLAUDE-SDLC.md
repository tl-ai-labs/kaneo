# Project fingerprint — kaneo

Facts established by AI-SDLC runs that cost real effort to derive. **Read this before planning a
web-side change**, so a future run does not re-derive them — or, worse, plan against an assumption
that was already disproved here.

Run history: [`ledger.md`](./ledger.md) · [`ledger.json`](./ledger.json)
Last updated: 2026-08-26, after run `20260826-064633-feature-extend-board-filter-chips`.

---

## Stack

- pnpm 10.32.1 monorepo. Web is `apps/web` — React 19 + Vite + TanStack Router/Query, Zustand
  stores, Biome (tab indent for files, **space** indent for JS/TS, default 80-col line width).
- Web tests: `pnpm --filter @kaneo/web test` (vitest, jsdom, `src/test/setup.ts` loads
  `@testing-library/jest-dom/vitest` and nothing else). Typecheck:
  `pnpm --filter @kaneo/web typecheck` (two projects: `tsconfig.app.json`, `tsconfig.node.json`).
- `@tanstack/react-router@1.170.24` resolving `@tanstack/router-core@1.171.20`.

## Hard-won facts about this codebase

### 1. zod IS available on the web side — but the project-view routes do not use it

`zod@^4.4.3` is a dependency of `apps/web` and **is** used as `validateSearch` on six routes
(`auth/sign-in`, `auth/sign-up`, `auth/verify-otp`, `device/index`, `device/approve`,
`mcp.authorize`). The project-view routes — **board, backlog, gantt** — instead use hand-written
`(search: Record<string, unknown>) => ({ ... typeof narrowing ... })`.

Both styles are house style. For a route whose validator must **never throw** (a throwing
`validateSearch` takes the whole route down on a hostile URL), prefer the hand-written form: a bare
zod schema throws on malformed input.

> Do not repeat the 2026-08-26 error of asserting "there is no schema library on the web side".
> There is one; it is simply not what the project-view routes use.

### 2. The router JSON-encodes array search values, app-wide

`apps/web/src/main.tsx` calls `createRouter({ routeTree, defaultPreload: "intent", ... })` with
**no `stringifySearch` / `parseSearch` override**, so TanStack's
`stringifySearchWith(JSON.stringify, JSON.parse)` default applies everywhere. Verified empirically:

| input | result |
|---|---|
| write `{ status: ["todo","done"] }` | `?status=%5B%22todo%22%2C%22done%22%5D` |
| read `?status=todo&status=done` | `{ status: ["todo","done"] }` |
| read `?status=todo` | `{ status: "todo" }` — a **bare string** |
| write all-undefined filters | no params emitted at all |

Consequences: URLs carrying arrays are **not** hand-editable repeated params; and any parser of
array-valued search params must accept a **bare string** as well as an array, because that is what
a hand-typed or JSON-unparseable param degrades to. Changing this is an app-wide decision, not a
per-route one.

### 3. `search: (prev) => ...` needs an explicit annotation at `to: "."` call sites

`ParamsReducerFn`'s `current` resolves via `ResolveFromParams`, which for `TFrom = string` (i.e. no
`from` option) widens to the router-wide `FullSearchSchema`. In practice TypeScript does **not**
contextually type the parameter at these sites and you get:

```
error TS7006: Parameter 'prev' implicitly has an 'any' type.
```

Write `search: (prev: Record<string, unknown>) => ({ ...prev, taskId })`. This matches the repo's
own `validateSearch` signature, and the route's `validateSearch` re-validates the merged object on
every navigation, so the real type contract is still enforced at the route boundary. Adding `from`
is **not** the fix for shared components — it would hard-code a route path into
`kanban-board/*` and `list-view/*`, which render under more than one route.

### 4. `bulk-selection` store: narrowing does not survive into closures

`apps/web/src/store/bulk-selection.ts` declares `focusedTaskId: string | null` as a **mutable
interface property**. TypeScript's `isConstantReference` rule therefore does not carry an
`if (state.focusedTaskId)` narrowing into an arrow function created after the guard. This:

```ts
if (state.focusedTaskId) {
  navigate({ search: (prev) => ({ ...prev, taskId: state.focusedTaskId }) }); // string | null
}
```

fails to assign. Hoist first: `const nextFocusedTaskId = useBulkSelectionStore.getState().focusedTaskId;`
Narrowing of a `const` identifier *is* preserved into closures.

### 5. `exactOptionalPropertyTypes` is not enabled anywhere

Not in `apps/web/tsconfig.app.json`, `tsconfig.node.json`, or `packages/typescript-config`. So a
`Partial<Record<K, T>>` may legally carry keys whose value is explicitly `undefined` — which is the
mechanism by which a cleared search param is removed from the URL (an *omitted* key would leave the
stale value in place under `{ ...prev, ...next }`).

Also on: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. An unused
local — such as a destructured `useState` setter you do not call — is a compile error.

### 6. The board route renders BOTH KanbanBoard and ListView

`board.tsx` renders `KanbanBoard` **or** `ListView` behind a `viewMode` toggle, plus
`TaskDetailsSheet`. Any change to board-route search state must therefore be applied across
**five** files, not two:

`components/kanban-board/index.tsx` · `components/kanban-board/task-card.tsx` ·
`components/list-view/index.tsx` · `components/list-view/task-row.tsx` · the route's own `board.tsx`

Verified non-hazards: `components/task/task-details-sheet.tsx` navigates to the task **full-page**
route with `params`, not `search`; `components/backlog-list-view/**` belongs to the backlog route.
Both contain similar-looking `search:` literals — do not "helpfully" convert them.

### 7. Testing gotchas

- **`import.meta.url` is an `http://` URL under Vitest's Vite transform**, not `file://`.
  `readFileSync(new URL(..., import.meta.url))` throws *"The URL must be of scheme file"* before any
  test runs. Anchor on `resolve(process.cwd(), "src", ...)` — Vitest's root is `apps/web`.
- **`vi.mock` factories are hoisted above module-scope consts.** To capture mock call arguments use
  `const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))`. The pre-existing
  `useNavigate: () => vi.fn()` pattern returns a fresh, unreachable spy per call and cannot assert
  anything.
- **Do not import a route module into a test** — `createFileRoute(...)({...})` executes at module
  load and needs a router. Put route-level pure logic (e.g. a `validateSearch`) in `src/lib/` and
  unit-test it there.

## Tooling rules

- **Never** run root or package `lint` — both are `biome check --write .` and rewrite unrelated
  files. Use targeted `npx biome check <paths>` while iterating.
- **Never** run `pnpm i18n:check:fix`.
- `i18n/en-US.json` is the source of truth for copy; the other locale files are generated/managed.
- Known pre-existing lint warning: `useOptionalChain` at
  `apps/web/src/components/kanban-board/index.tsx` (`if (!project || !project?.columns)`). Not
  introduced by any run; leave it unless the ticket is about it.

## Known-and-deliberately-left

These are **not** defects to fix opportunistically. Each was surfaced and explicitly left:

- `normalizeFilters` / `DEFAULT_FILTERS` are duplicated across `use-task-filters.ts` and
  `use-task-filters-with-labels-support.ts`. De-duplicating drags the non-label hook (which has
  other callers) into the blast radius.
- Assignee filtering matches `task.userId`, **not** `task.assigneeId`. A likely latent bug, left
  alone by explicit decision. URL-persisting the assignee filter made it consistently wrong rather
  than newly wrong.

## Web-side security notes

- Board filter values (assignee `userId`s, label IDs) now travel in the **URL**, so they reach
  browser history, `Referer`, and proxy logs. Both shipped nginx configs set
  `Referrer-Policy: strict-origin-when-cross-origin`, so clicking an external PR link from a
  filtered board sends only the origin.
- Accepted Lows from 2026-08-26: no vocabulary validation on closed-set filter values (a crafted URL
  renders ≤128 chars of attacker text into a chip — UI spoofing, React escapes so not XSS); and
  unguarded `localStorage.setItem` where the URL dictates value size and key.
- `pnpm audit --prod`: 2 high, both pre-existing transitives under `better-auth`.

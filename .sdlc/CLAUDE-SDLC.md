# Kaneo — SDLC project fingerprint

Durable facts established by `/mmo:*` runs. **Read this before starting a run; do not re-derive
anything below.** Run history and per-run detail: [`ledger.md`](./ledger.md) · [`ledger.json`](./ledger.json).

Last updated: 2026-08-26 by run `20260826-132654-feature-extend-board-filter-chips`
(branch `feature-extend-3/opus-sonnet`, anchor `5d1fc910`).

---

## Stack

pnpm 10.32.1 + Turborepo monorepo, TypeScript throughout, Node >= 20.19.
`apps/api` (Hono + Drizzle + Better Auth + Valibot) · `apps/web` (React 19 + Vite + TanStack
Router/Query + Zustand + Tailwind) · `apps/site` (Next.js) · `apps/docs` · `packages/*` · `charts/`.

**Verification commands** (scoped; prefer these over root `pnpm test`):
```
pnpm --filter @kaneo/web test
pnpm --filter @kaneo/web typecheck
```
**Never run root or package `lint`** — it is `biome check --write .` and rewrites unrelated files.
Use `biome ci <changed paths>` and **read the exit code**. Path-scoped `biome check --write <one file>`
is safe for formatting a file the run just authored.

---

## Security facts — established 2026-08-26, do not re-derive

- **Anything placed in a URL is passively exported to Sentry.** `apps/web/src/instrument.ts`
  initialises Sentry with `browserTracingIntegration()` + `replayIntegration()` at
  `replaysSessionSampleRate: 0.1` and has **no `beforeSend` and no `beforeBreadcrumb`** (grep count 0).
  **`sendDefaultPii: false` does NOT strip query strings** — it governs IP, headers and user context.
  So ~10% of sessions ship query params off-site with no user action. **Any future work that puts
  identifiers into a URL inherits this exposure.** Open follow-up; `instrument.ts` was outside the
  2026-08-26 run's allowlist.
- **`Referer` is NOT the leak vector.** `apps/web/nginx.conf:9` already sets
  `Referrer-Policy: strict-origin-when-cross-origin`. Do not spend a security review re-finding this.
- **`task.userId` is a cuid2** (`apps/api/src/database/schema.ts:24-26`, `:415`) — opaque, not an
  email, not enumerable.
- **The assignee filter never crosses the network.** The API *does* accept an `assigneeId` query
  filter (`apps/api/src/task/index.ts:76`), but `apps/web/src/fetchers/task/get-tasks.ts:4-6` sends
  only `{ projectId }`. Filtering is client-side over already-authorized data, so a filter value in a
  URL cannot be injected into a request — IDOR is foreclosed structurally, not merely unlikely.

## Frontend facts

- **`@testing-library/react` is 16.3.2. `RenderHookResult` exposes only `rerender`, `result`
  (`{ current }`) and `unmount`. There is NO `result.all`, and `@testing-library/react-hooks` is not
  installed.** To assert on renders before the latest, push values into an array from inside the
  `renderHook` callback. A generated test reaching for `result.all` will not compile.
- **`RouteComponent` does NOT remount when a route param such as `$projectId` changes.** TanStack
  matches are keyed by static `routeId`, and no route here sets `remountDeps`. Any per-project state
  keyed off `projectId` must handle the switch explicitly — a `useState` initializer alone resolves
  only the first project.
- **`validateSearch` must never throw.** It runs on every navigation; a throw takes the route down
  with no user-recoverable path. Two idioms coexist (~5 routes pass a `zod/v4` schema, ~5 hand-roll a
  validator). A bare `schema.parse()` throws — use `safeParse` + fallback or total coercion.
- TanStack `navigate({ search })` accepts an updater: `search: (prev) => ({ ...prev, x })`. Passing a
  literal object **replaces the whole search object** and silently drops unrelated params. The board
  route's nine sites were fixed on 2026-08-26; **`backlog.tsx:77`, `gantt.tsx:404` and
  `backlog-task-row.tsx:105` still have this bug** (KD-2, deliberately out of scope). A shared helper
  `withTaskId` exists at `apps/web/src/lib/search-params.ts`.
- `viewMode` (board vs list) is Zustand state, not routing state — switching views does not navigate.
- Biome: double quotes, 2-space indent, `organizeImports` on (externals alphabetically, then `@/…`,
  then relative). `Object.hasOwn`, never `Object.prototype.hasOwnProperty`.
- Generated / never hand-edit: `apps/web/src/routeTree.gen.ts`.

## Repo conventions

`AGENTS.md` is canonical and binding (`CLAUDE.md` just `@`-includes it). Three overlapping skill
trees (`.claude/skills/`, `.agents/skills/`, `skills/`) carry the same names — all off-limits, do not
reconcile. `.cursor/rules/` holds 7 `.mdc` files — off-limits. `.gitignore` does **not** cover
`.sdlc/`.

---

## Plugin / tooling facts — cost these into planning

- **Routing bug, reproduced three times independently.** `pipeline/SKILL.md` tells brownfield runs to
  use task_types `new_file_add` / `existing_file_edit` / `patch_apply`. These match **no** codegen
  rule in the shipped policies and fall through to `{ default: opus }`, silently making a mixed-policy
  run mostly premium while appearing to succeed. **Set `task_type` to a policy-recognised value**
  (`frontend_util`, `react_component`, `react_page`, …), carry the brownfield primitive in `subtype`,
  and **simulate routing before dispatching.** With that mapping the 2026-08-26 run achieved
  0 opus / 21 sonnet where the documented task_types would have sent 9 packets to opus.
- **The write-contract PreToolUse hook does not fire**, and `artifact_path` has no reader in
  `server.ts`, so the dispatcher's allowlist check is documentation-only. **Treat the allowlist as
  policy to self-enforce**: an explicit may-write / must-not-touch list in every packet instruction,
  a path check against the frozen contract, and `git status --porcelain` after every dispatch.
- **The `chars/3.8` token estimator undercounts by ~2.17×** because it does not model multi-turn
  context re-send (measured against a ground-truth harness token count; two review subagents showed
  2.9× and 2.6×). **Treat every estimated direct-tier cost as a floor, and never compare an estimated
  figure against a vendor-measured one.**
- **Each `claude -p` spawn reloads session context.** The 2026-08-26 run logged 838,682 cached input
  tokens against 316,928 fresh across 18 calls. Per-call overhead dominates for small packets, so
  **the cheap tier can cost more than the premium tier** — it did, $2.50 vs a $2.20 floor. Prefer
  fewer, larger mechanical packets over many small ones.
- **Derive mutation-check backup filenames from the full repo-relative path, not `basename`.** Two
  different `index.tsx` files collide otherwise; this corrupted a file on 2026-08-26 and the same
  class of bug hit the `opus-plus-flash` arm.

# Security Review — brownfield, feature-extend — Board filters to URL search params

Run: `20260904-061318-feature-extend-board-filter-chips`
Scope: the 12 files listed in `provenance.json` (client-side only; no `apps/api`, `packages/`, or schema changes).
Method: `Glob`/`Grep` were absent from this build, so all enumeration was done with `Bash` (`git diff`, `grep -rn`, `find`, `node`). Every claim below is backed by a command that actually ran; nothing is asserted from a search I could not perform.

## RISK VERDICT: LOW

Purely presentational client-side filtering of data the browser already holds; the one non-obvious risk (prototype pollution) was empirically disproven against the real TanStack parser, and no authz, network, or secret-handling path was touched.

---

## Findings

### Critical
None.

### High
None.

### Medium
None.

### Low

**L-1 — Reflected attacker-controlled text in the status/priority filter chips**

- `apps/web/src/components/board/board-toolbar.tsx:152-154` — `getStatusDisplayName()` returns `column?.name || statusId`, i.e. it **echoes the raw search-param value** when the id matches no column.
- `apps/web/src/lib/i18n/domain.ts:26-30` — `getPriorityLabel()` falls back to `toDisplayCase(priority)`, likewise echoing the raw value.
- Reached from `board-toolbar.tsx:551` and `:578`, but only when exactly one segment is selected (two or more render a `{{count}} selected` string instead).

Exploit scenario: an attacker sends a workspace member a link such as `…/board?status=Your%20session%20expired%20-%20sign%20in%20at%20evil.example`. The board renders that string inside a legitimate-looking filter chip. This is **text-only injection, not XSS** — the value is passed as a React text child, so React escapes it; there is no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `javascript:` URL, or attribute sink anywhere in the changed files (verified by grep across all six changed source files). Impact is limited to minor UI spoofing / social engineering; the chip is visually bounded and sits next to a clear button.

Note on origin: the echo logic is **pre-existing** and unmodified. What this run changed is its *reachability* — the value used to come from `localStorage` (same-origin, only ever written by the user themselves) and now comes from the URL (suppliable by anyone who can get the victim to click a link). That is a genuine, if small, marginal increase in exploitability introduced by this change.

Remediation (optional, not a blocker): render an "Unknown" placeholder rather than the raw id when the id resolves to no known column/priority, e.g. `return column?.name ?? t("common:people.unknown")` — mirroring what `getAssigneeDisplayName()` (line 164-167) already does correctly.

**L-2 — Unbounded segment count in `decodeFilterValue` (no guard required — see verdict)**

- `apps/web/src/lib/board-filter-search-params.ts:37-48` — `raw.split(",")` with no cap on segment count or length.

Measured cost (benchmarked with `node`, simulating the real code paths):

| tasks | segments | URL size | decode | filter |
|---|---|---|---|---|
| 200 | 1,000 | 11 KB | 0.17 ms | 0.15 ms |
| 200 | 100,000 | 1.1 MB | 24 ms | 27 ms |
| 1,000 | 100,000 | 1.1 MB | 20 ms | 129 ms |

A secondary cost exists in `board-toolbar.tsx:549` / `StackedIcons` (line 109-119), which `.map()`s over **all** selected ids — calling `project.columns.find()` per id — and only then `.slice(0, 3)`. That map-before-slice is pre-existing.

Verdict, stated plainly: **not a meaningful DoS, and no input guard is required before sign-off.** Reaching even ~130 ms of jank needs a ~1.1 MB URL; the cost is O(tasks x segments) with a small constant, it is entirely self-inflicted in the victim's own tab, there is no server-side, cross-user, or amplification component, and any web page can hang its own tab far more cheaply. Deduplication via `Set` also collapses repeated segments, so the attacker must pay full URL length for every distinct segment.

Remediation (defense-in-depth only, cheap): cap segments in `decodeFilterValue` (`if (seen.size >= 50) break;`) and move `.slice(0, 3)` before `.map()` in `StackedIcons`. Both are one-liners and would also bound the render cost, but neither should gate this run.

### Informational

**I-1 — No `__proto__` regression test in the codec suite.** `apps/web/src/lib/board-filter-search-params.test.ts:171-215` covers arrays, objects, numbers, booleans, null/undefined and 10,000-char strings, but not a `__proto__`/`constructor` key. Pollution is not currently possible (see verdict 7), but that safety rests on TanStack internals and on object-spread semantics, both of which are outside this repo's control. A three-line test asserting `({}).polluted === undefined` after decoding a hostile search object would lock in the property. Suggested, not required.

**I-2 — Prototype-chain lookup with an attacker-controlled key.** `apps/web/src/lib/column.tsx:11-18` indexes `DEFAULT_COLUMN_ICON_NAMES[columnId]` and then `columnIcons[resolvedIconName]` where `columnId` now originates from the URL. I traced the exploitable cases: `?status=constructor` makes `resolvedIconName` the `Object` constructor (truthy), but the subsequent `columnIcons[...]` lookup stringifies it to `"function Object() { [native code] }"`, which is not a key, so `Icon` is `undefined` and the code falls through to the safe `<Circle />` branch. Same for `toString`/`valueOf`. **No exploit exists**, but the pattern would become one if `columnIcons` ever gained a key colliding with a stringified intrinsic. Pre-existing file, not modified by this run.

**I-3 — Filter values appear in reverse-proxy access logs.** nginx's default `combined` log format records `$request`, which includes the query string, so `assignee=<uuid>` is now written to server logs alongside the `taskId` that was already there. Opaque UUIDs only, on a self-hosted deployment whose operator is already the data controller. Negligible.

---

## Verdicts on the eight threat-model points

**1. Data exposure through URLs — INFORMATIONAL, marginal exposure is essentially nil.**
The values placed in the URL are opaque UUIDs (assignee `userId`, label ids) and short slugs (`status`, `priority`, `dueDate`). `taskId` — an identically opaque UUID — was already in the URL before this change, so the *marginal* delta is "a few more opaque UUIDs of the same class". A recipient who is not a workspace member gains nothing: the board route sits under `_layout/_authenticated`, and the API independently scopes every task/user/label query by workspace membership, so a non-member who opens the link is authenticated-denied and sees no data. The UUIDs disclose no names, emails, or role information and are not enumerable. The one vector that would have mattered — full URLs leaking to third-party hosts via `Referer`, which is realistic here because avatars render from `member.user.image` (potentially an external CDN) — is closed: `apps/web/nginx.conf:9` and `apps/web/nginx.kaneo.conf:8` both set `Referrer-Policy: strict-origin-when-cross-origin`, which strips path and query on cross-origin requests, and that is also the modern browser default for deployments not using the bundled nginx. Net: acceptable, and inherent to the "shareable filtered board" feature that was explicitly requested.

**2. Injection / XSS — PASS, no sink reached.**
I traced `location.search` -> `defaultParseSearch` -> `validateSearch` -> `readRawFilterParam` -> `decodeBoardFilters` -> `filterTasks` / chip rendering. A grep across all six changed source files for `dangerouslySetInnerHTML|innerHTML|eval(|new Function|javascript:|document.write|location.href|.setAttribute|href={|src={` returned only pre-existing `src={assignee?.user?.image ?? ""}` (server-supplied, not search-derived) and two pre-existing `new URLSearchParams(window.location.search)` reads used solely to extract `taskId`. Chip values are React text children and `ReactNode` props, so React's escaping applies. The one construct that looked risky — the template-literal i18n key at `board-toolbar.tsx:626` — resolves through a ternary to one of three hardcoded literals (`dueThisWeek`/`dueNextWeek`/`noDueDate`) and is not attacker-controlled. `getPriorityLabel` does interpolate the raw value into an i18next key (`tasks:priority.${priority}`), which at worst lets an attacker surface a different legitimate translated string; no code execution, no sink.

**3. DoS / resource abuse — ACCEPTABLE AS-IS, guard not required.** See L-2 for measured numbers and the reasoning. Clear verdict: do not block on this.

**4. Authorization — PASS, confirmed untouched.**
This is purely presentational filtering of data the client already holds. `useGetTasks(projectId)` (board route line 93) fetches the task set; a grep for `fetch(|useQuery|useMutation|client.|axios` across all six changed source files returned **zero matches**, proving no filter value reaches any request — the server is never told what the user is filtering by. Filtering by an arbitrary assignee id therefore cannot reveal a task the user could not already see: `filterTasks` can only ever *remove* items from an already-authorized array (every branch returns `false` to exclude; nothing adds). No workspace-boundary or permission logic was touched — no file under `apps/api/**` or `packages/permissions/**` is in the changed set. Consistent with AGENTS.md: this change adds no UI-level "authorization", it only hides rows the user is already entitled to see.

**5. Open redirect / navigation — PASS.**
All four navigation call sites use the literal `to: "."` — `board.tsx:107`, `task-card.tsx:148` and `:157`, `task-row.tsx:147` and `:156`. No user-controlled value reaches a navigation target, and no `href` is constructed from search params anywhere in the diff. The `search` argument changed from an object literal to a functional updater, which affects only query params, never the destination.

**6. Secret leakage — PASS.**
A case-insensitive grep for `api[_-]?key|secret|token|password|credential|bearer` across all six changed source files returned nothing. The same grep across the four test files returned nothing — no real credentials in fixtures. Only the five whitelisted filter keys are ever written to the URL: `encodeBoardFilters` (`board-filter-search-params.ts:80-89`) emits a fixed 5-key object, so no adjacent state can leak into the query string. No new logging or event publication was added.

**7. Prototype pollution — PASS, empirically disproven.**
This deserved the scrutiny; it is safe for three independent reasons, each verified rather than assumed.
  - **The parser produces a null-prototype object.** `@tanstack/router-core@1.171.20/src/qss.ts` `decode()` builds its result with `Object.create(null)`. Assigning `result["__proto__"]` on a null-prototype object creates an ordinary own data property — there is no inherited `__proto__` setter to invoke. `parseSearchWith` (`searchParams.ts`) then does `query[key] = parser(value)` onto that same null-prototype object. I confirmed the app uses the default parser: `createRouter` in `apps/web/src/main.tsx:43-51` passes no `parseSearch`/`stringifySearch` override.
  - **Object spread cannot pollute.** `{ ...prev }` in the four updaters uses `CreateDataPropertyOrThrow` semantics, which define own properties and never trigger setters. (This is precisely where `Object.assign` — which uses `[[Set]]` and *would* invoke the `__proto__` setter — differs. See the remediation note below.)
  - **`validateSearch` whitelists.** `board.tsx:35-42` returns a fresh 6-key object literal (`taskId` plus the five filters), so any exotic key is stripped before it can reach an updater's `prev`. And `decodeBoardFilters` reads only five fixed keys and rejects anything that is not `typeof === "string"`, so an inherited or non-string value degrades to `null`.

  Empirical confirmation, run against the real installed parser:
  ```
  decode("__proto__={"polluted":true}&constructor=x&status=a,b")
  own keys:                 [ '__proto__', 'constructor', 'status' ]
  getPrototypeOf(q):        null
  Object.prototype.polluted: undefined
  global pollution?          no
  ```
  **Standing recommendation:** do not refactor any of these four spread sites to `Object.assign(prev, ...)`. That single change would convert this from safe to a real pollution sink. Worth a comment at `use-task-filters-with-labels-support.ts:69` and adding test I-1.

**8. Dependency risk — PASS, zero new dependencies.**
`git diff --stat -- '*package.json' '*lock*'` returned empty output: no runtime dependency was added, and no lockfile changed. No zod or valibot import appears in the new codec or the hook (grep-verified) — the implementation is hand-rolled `typeof x === "string"` checks, matching the repo precedent and acceptance criterion 6. `pnpm audit --prod` reports 7 high / 4 moderate, but all are pre-existing transitive advisories in dependencies this run did not touch (see Noted section).

---

## Passing checks

- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, or `javascript:` sink in any changed file.
- No user-controlled value reaches a navigation target, `href`, or `src`.
- No filter value reaches any network request; zero `fetch`/`useQuery`/`useMutation` calls in changed files.
- No secrets, tokens, or credentials in source or test fixtures.
- No prototype pollution reachable (parser uses `Object.create(null)`; updaters use spread; `validateSearch` whitelists).
- `validateSearch` whitelists exactly six keys and coerces every non-string to `undefined`.
- Malformed and hostile input degrades to the unfiltered default without throwing (acceptance criterion 5) — 21/21 tests pass in `board-filter-search-params.test.ts`, including a hostile-input suite.
- `Referrer-Policy: strict-origin-when-cross-origin` set in both bundled nginx configs, closing the cross-origin URL-leak vector.
- Route remains under `_layout/_authenticated`; API-side authorization untouched.
- Zero new runtime dependencies; no schema library introduced.
- `.gitignore` addition of `.sdlc/` and `.hook-logs/` is a net security positive — it prevents run artifacts (which embed source excerpts and tool output) from being swept into a commit by `git add -A`. Confirmed nothing under `.sdlc/` is currently tracked (`git ls-files .sdlc` is empty), so the ignore rule is not masking already-tracked files.

## Required fixes before sign-off

**None.** No finding in this run blocks Gate 3.

Optional hardening, in priority order, none gating:
1. L-1 — return a placeholder instead of echoing the raw id in `getStatusDisplayName` / `getPriorityLabel`.
2. I-1 — add a `__proto__` regression test to the codec suite.
3. L-2 — cap segments in `decodeFilterValue` and slice-before-map in `StackedIcons`.

## Accepted risks

- **Opaque UUIDs in shareable URLs (L-1 context / point 1).** Deliberately not fixed: putting filter state in the URL *is* the requested feature, and the ids are opaque, non-enumerable, and useless to a non-member because the API enforces workspace membership independently. Reverting would defeat the change.
- **Unbounded comma-segment input (L-2).** Deliberately not fixed: measured worst case is ~130 ms of jank in the attacker-victim's own tab from a 1.1 MB URL, with no server or cross-user impact. Adding a cap is cheap but is hardening, not a defect.
- **Reflected chip text (L-1).** Left as-is for this run: React escaping makes it text-only, the echo logic is pre-existing and shared with other views, and changing the display fallback touches behaviour beyond this run's scope. Flagged for a follow-up.
- **Pre-existing dependency advisories.** Out of scope: this run changed no dependencies; fixing them requires upgrades that belong in a `deps` intent.

## Noted (pre-existing, out of scope)

These are advisory only and do **not** gate this run — no dependency manifest or lockfile was modified.

`pnpm audit --prod`: 7 high, 4 moderate, 0 critical across 1,220 production dependencies.

| Severity | Package | Affected | Advisory | Fix |
|---|---|---|---|---|
| HIGH | `nanoid` | `<3.3.18` | Custom generators can loop indefinitely when size is zero | upgrade to 3.3.18+ |
| HIGH | `deepmerge-ts` | `<8.0.0` | Stack exhaustion merging recursive object graphs | upgrade to 8.0.0+ |
| HIGH | `mysql2` | `<3.22.0` | Auth plugin downgrade to `mysql_clear_password` leaks plaintext | upgrade to 3.22.0+ |
| HIGH | `fast-uri` | `>=3.1.3 <3.1.6` | Host confusion via skipped IDN canonicalisation | upgrade to 3.1.6+ |
| MODERATE | `mysql2` | `<=3.23.0` | Unbounded zlib inflate — decompression-bomb DoS | upgrade to 3.23.1+ |

All are transitive and unrelated to this client-side change. Note that Kaneo targets PostgreSQL, so the `mysql2` advisories are very likely reachable only through a tooling/ORM transitive path rather than any live code path — worth confirming in a dedicated `deps` run.

Other pre-existing items already covered above: I-2 (`apps/web/src/lib/column.tsx` prototype-chain lookup, no exploit) and the map-before-slice in `StackedIcons`.

---

## Checklist items not applicable to this run

The standard checklist targets a server-side PII/audit-log codebase. This run is client-side only and touched no such surface, so the following were **not evaluated against the changed files** because no changed file implements them — they are neither passed nor failed here, and the API-side posture is unchanged by this run:

- PII encryption at rest (`government_id`, `bank_account`, `salary_base`) — no such entity or field exists in Kaneo; no `apps/api` file was touched.
- Role-based response masking in serializer/interceptor/DTO — no serializer or DTO changed.
- Audit-log write ordering, append-only enforcement, and auditor-only read — no audit-log code exists in the changed set.
- Controller route guards, `reports_to` relationship checks, JWT secret loading, password hashing cost factor — no controller, guard, or auth code changed. The board route's `_authenticated` guard is intact and unmodified.
- Helmet, auth-endpoint rate limiting, global error filter — no server middleware changed. (`Referrer-Policy` and the other nginx headers were checked and are present.)
- `.env.example` / `.env` gitignore posture — unchanged by this run; the only `.gitignore` edit adds `.sdlc/` and `.hook-logs/`.

# Security Review — brownfield, feature-extend

- **Run:** `20260826-132654-feature-extend-board-filter-chips`
- **Scope:** the 18 files in `provenance.json` only. `apps/api/**` and `packages/**` read for
  *verification of claims*, never audited.
- **Reviewed at:** working tree on branch `feature-extend-3/opus-sonnet`, `git_head_before` `5d1fc910`.

---

## 1. Verdict

**Ship with conditions.**

The codec is genuinely well built. Totality, prototype safety, and injection-freedom are not
merely asserted here — I transpiled `board-filter-search-params.ts` with `esbuild` and executed it
against 32 hostile inputs; it threw zero times and polluted nothing. There is no XSS, no IDOR, no
enumeration oracle, no new authorization surface, and no dependency change.

The conditions are three, and only the first is about confidentiality:

1. **C-1 (medium)** — Sentry is initialized with `browserTracingIntegration()` and
   `replayIntegration()` and **no `beforeSend`, no `beforeSendTransaction`, no `beforeBreadcrumb`,
   and no URL scrubbing**. Board URLs now carry `assignee=<user cuid2>`. Those URLs are captured
   in Sentry event `request.url`, navigation breadcrumbs, transaction names, and replay navigation
   entries, at `replaysSessionSampleRate: 0.1` — i.e. 10% of *all* sessions, not just erroring
   ones. This is a real new egress of a pseudonymous personal identifier to an external error
   sink. Either scrub the param or accept it explicitly and on the record.
2. **C-2 (low)** — Read-path bounds are applied *after* the `Set`, not before, making
   `validateSearch` do 44ms of blocking work at 50k values and 222ms at 200k, on every navigation.
   One-line fix.
3. **C-3 (low)** — Bounds are asymmetric. The read path caps at 50/128; the write path
   (`localStorage` → filters → URL) caps at nothing, so `MAX_FILTER_VALUES` is not actually an
   invariant on filter state.

None of these are exploitable by an unauthenticated party. None block on correctness grounds.

---

## 2. Answer to the headline PII question

**Requirements §6 stands on its central claim and is materially correct, but it is incomplete in
one specific and consequential way: it does not account for Sentry.**

Taking the sub-questions in order, with the evidence.

### What `task.userId` actually is

It is an opaque, non-enumerable, non-guessable identifier. Not an email, not a username.

- `apps/web/src/types/task/index.ts:30` — `userId: string | null`, and separately
  `assigneeId`, `assigneeName`, `assigneeImage` at :31-33.
- The value that lands in `filters.assignee` comes from
  `apps/web/src/components/board/board-toolbar.tsx:216-224` (`toggleAssigneeFilter(userId)`),
  sourced from `useGetActiveWorkspaceUsers` members' `userId`.
- Server-side, `apps/api/src/database/schema.ts:415` — `userId: text("assignee_id").references(() => userTable.id)`.
- `apps/api/src/database/schema.ts:24-26` — `userTable.id` is `$defaultFn(() => createId())`, i.e.
  **cuid2**. Random, collision-resistant, not sequential, not derived from the email at :28.

So §6's "opaque user ids, not a name or email" is accurate, and the distinction matters: a cuid2
is not enumerable, so possession of one does not let you walk the user table.

**`assigneeName` and `assigneeImage` are not in the URL.** Confirmed: `BOARD_FILTER_KEYS`
(`board-filter-search-params.ts:7-13`) is a five-element literal and
`toBoardFilterSearchParams` (:75-80) iterates only that array. Nothing else can be written to
the search object by this code. §6 is correct here.

### Does a filtered URL grant the recipient anything? — verified, not repeated

I checked this rather than taking the document's word, as §6 itself requested.

- `apps/web/src/routes/_layout/_authenticated.tsx:6-24` — `beforeLoad` calls
  `authClient.getSession()` and `throw redirect({ to: "/auth/sign-in" })` when there is no
  session. The guard is real and it is a `beforeLoad` throw, not a render-time check.
- `apps/web/src/fetchers/task/get-tasks.ts:4-6` — the fetcher sends **only** `param: { projectId }`.
  It sends no query string at all.
- `apps/api/src/task/index.ts:95` — `workspaceAccess.fromProject("projectId")` sits in the
  middleware chain of `GET /tasks/:projectId`, before the handler at :96.

The decisive point: the API route *does* accept an `assigneeId` query filter
(`apps/api/src/task/index.ts:76`) — but the web fetcher never passes it. **The board filter is
applied purely client-side, in `filterTasks`
(`use-task-filters-with-labels-support.ts:147-153`), over a task list the server already
authorized in full.** The filter value never crosses the network. That structurally forecloses
IDOR: there is no request into which a URL-supplied id can be injected.

### Is it an enumeration oracle? — no

Two candidate oracles, both closed:

- *"Does this user id exist?"* — A crafted `?assignee=<arbitrary cuid>` filters the
  already-fetched list. A non-existent id and a real-but-unassigned id both yield zero tasks.
  Indistinguishable. No oracle.
- *"Does this label id exist?"* — Same shape via
  `use-task-filters-with-labels-support.ts:200-206`, which intersects against
  `task.labels[].id` from data already in hand. Zero results either way.

The chip-rendering path is the one place a lookup could leak, and it does not:
`getAssigneeDisplayName` (`board-toolbar.tsx:164-167`) resolves against `users?.members` — the
viewer's own authorized workspace member list — and falls back to `t("common:people.unknown")`.
A foreign user's id renders as "Unknown". It does **not** resolve a name across a workspace
boundary.

### New disclosure to an already-authorized member? — none

For a viewer who is a workspace member, `useGetActiveWorkspaceUsers(workspaceId)`
(`board.tsx:95`) already hands them every member's `userId` *and* name *and* avatar. Seeing a
userId in a URL tells them nothing they could not read out of the member dropdown. Confirmed no
new disclosure inside the trust boundary.

### Where the URLs actually go — and where §6 is incomplete

§6 names "a referrer header" as the leak vector. That is the *weakest* of the vectors and is
already mitigated; the vector it omits is the strongest.

| Vector | Status | Evidence |
|---|---|---|
| **Sentry** | **Live, unscrubbed, and omitted from §6** | `instrument.ts:20-26` — `browserTracingIntegration()` + `replayIntegration()`, `replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0`. No `beforeSend`/`beforeSendTransaction`/`beforeBreadcrumb` anywhere in the file. `sendDefaultPii: false` (:11) governs IP/cookies/headers — **it does not scrub the query string**. |
| `Referer` to third parties | Mitigated | `apps/web/nginx.conf:9` and `apps/web/nginx.kaneo.conf:9` set `Referrer-Policy "strict-origin-when-cross-origin"`, so cross-origin requests send origin only, no query string. |
| Plausible analytics | Narrow | `apps/web/index.html:35-51` loads it only when hostname is `demo.kaneo.app` or `cloud.kaneo.app`, to Kaneo's own `plausible.kaneo.app`. Self-hosted instances never load it. First-party infra. |
| Browser history / cross-device sync | Inherent | Unavoidable consequence of URL state. Not engineerable away. |
| Chat unfurls (Slack etc.) | Identifier-only | The SPA serves `index.html` to an unfurl bot with no session; no task data is rendered. What persists in Slack is the cuid2 itself, not board content. |
| Server access logs | Inherent | Any reverse proxy in front of the SPA logs the query string. |
| Sign-in redirect | Newly widened | `_authenticated.tsx:19` puts `location.href` into `?redirect=`, so an **unauthenticated** recipient's `/auth/sign-in` URL now carries the assignee cuid2 — and that page is also in Sentry's scope. Pre-existing code, new exposure profile. |

### Verdict on §6

- "Opaque user ids, not a name or email" — **correct**, verified to cuid2 at the schema.
- "Ids only, never names/emails/avatars" — **correct**, structurally enforced by `BOARD_FILTER_KEYS`.
- "Authorization is unaffected" — **correct and independently verified**. Client-side filter over
  server-authorized data; no IDOR, no oracle, no new intra-workspace disclosure.
- "Bounded exposure change" — **overstated in one respect.** §6 frames the exposure as
  human-mediated (paste into Slack, referrer header) and therefore discretionary. It is not
  purely discretionary: `replaysSessionSampleRate: 0.1` means roughly one in ten sessions ships
  these URLs to an external error sink **automatically, with no user action**, and 100% of
  erroring sessions do. A cuid2 tied to a natural person is pseudonymous personal data under
  GDPR Art. 4(1). That is a defensible risk to accept, but §6 does not describe it, so it was
  not what Gate 0 actually accepted.

The gap is in the **inventory**, not in the **design**. The feature is sound; the disclosure
document is missing a row.

---

## 3. Findings

### C-1 · Medium · New egress of pseudonymous user identifiers to Sentry, unscrubbed

**Location:** `apps/web/src/instrument.ts:7-27` (unchanged by this run) in combination with
`apps/web/src/lib/board-filter-search-params.ts:7-13` and `board.tsx:35`.

**Impact.** After this change, board URLs carry `assignee=<cuid2>`, one per selected member. The
Sentry browser SDK attaches the full `document.location.href` to event `request.url`, records
`navigation` breadcrumbs containing from/to URLs, names browser-tracing transactions by URL, and
`replayIntegration` records URL changes in the replay timeline. With `replaysSessionSampleRate:
0.1` this happens on ~10% of all sessions regardless of errors, and on 100% of erroring sessions
(`replaysOnErrorSampleRate: 1.0`). There is no `beforeSend`, `beforeSendTransaction`, or
`beforeBreadcrumb` hook, and Sentry's server-side default data scrubbing keys on field names like
`password`/`token` — it will not match `assignee`. The most common use of an assignee filter is
"my tasks", so the identifier most often exported is the *sharer's own*.

This is gated on `VITE_SENTRY_DSN` being set (`instrument.ts:3-6`), so self-hosted instances
without a DSN are unaffected. Kaneo cloud/demo presumably set it.

**Remediation.** Add a URL scrubber to `Sentry.init`. Something on the order of:

```ts
beforeSend(event) { /* rewrite event.request.url query, drop `assignee` */ return event; },
beforeSendTransaction(tx) { /* same for tx.request?.url and tx.transaction */ return tx; },
beforeBreadcrumb(bc) { /* scrub bc.data.from / bc.data.to for category "navigation" */ return bc; },
```

Scrubbing only `assignee` is sufficient — `status`, `priority`, `dueDate` are enum slugs and
`labels` are workspace-scoped object ids, neither of which is personal data. Note this touches
`instrument.ts`, which is **outside this run's write allowlist**, so it is a follow-up ticket, not
an in-run fix. If it is not done, record the acceptance in §6 rather than leaving it undescribed.

---

### C-2 · Low · Read-path bounds applied after `Set` construction, not before

**Location:** `apps/web/src/lib/board-filter-search-params.ts:38-43`

```ts
const nonEmpty = values.filter((value) => value !== "");
const withinLength = nonEmpty.filter((v) => v.length <= MAX_FILTER_VALUE_LENGTH);
const deduped = Array.from(new Set(withinLength));   // <- unbounded input reaches here
const limited = deduped.slice(0, MAX_FILTER_VALUES); // <- bound applied only now
```

**Impact.** Answering the question as posed: yes, `Array.from(new Set(...))` **is** reached with an
unbounded input. Measured on the real transpiled module:

| Input | `readBoardSearchParams` wall time |
|---|---|
| 5 facets × 1,000 values | 1.4 ms |
| 5 facets × 10,000 values | 7.5 ms |
| 5 facets × 50,000 values | 44.3 ms |
| 5 facets × 200,000 values | 222.1 ms |
| 1 facet × 200,000 distinct | 166.0 ms |
| 1 facet × 200,000 duplicates | 41.4 ms |

The work is **O(n), not O(n²)** — I checked for a quadratic path and there is none. The
per-value length cap at :39-41 runs *before* the `Set`, so each hashed string is ≤128 chars,
which is what keeps this linear. `validateSearch` runs on every navigation to the route, so this
is repeated blocking main-thread work, not a one-shot cost. Ceiling is browser URL length
(~2 MB in Chromium via `pushState`), so ~200k values is the realistic worst case. Self-inflicted:
the victim must open a hostile link. Not remotely triggerable.

**Remediation.** Move the bound ahead of the dedupe. `withinLength.slice(0, MAX_FILTER_VALUES * 4)`
before `new Set`, then `.slice(0, MAX_FILTER_VALUES)` after, preserves dedupe semantics for any
realistic input while capping the hash work. Cheap and low-risk.

---

### C-3 · Low · Bounds are read-path only; `localStorage` → URL is unbounded

**Location:** `apps/web/src/hooks/use-task-filters-with-labels-support.ts:25-42` (`normalizeFilters`)
and `apps/web/src/lib/board-filter-search-params.ts:70-83` (`toBoardFilterSearchParams`).

**Impact.** `normalizeFilters` constrains stored values to *string arrays* but applies **no count
or length bound** — it has no equivalent of `MAX_FILTER_VALUES`/`MAX_FILTER_VALUE_LENGTH`.
`toBoardFilterSearchParams` applies no bound either; I confirmed empirically that it serializes a
200,000-value filter state to 200,000 URL values. So the path
`localStorage` → `readStoredFilters` (:44-60) → state → `useBoardFilterUrlSync` →
`applyBoardFiltersToSearch` → `navigate` is unbounded, and can push a multi-megabyte URL into the
victim's history — which then feeds C-1's Sentry pipe. It self-heals on the next reload, because
the read path *does* bound to 50, but that self-heal is itself a silent filter drop.

`MAX_FILTER_VALUES = 50` is therefore **not an invariant on filter state**; it is a property of one
entry point. Requires attacker control of `localStorage` (XSS or devtools) to weaponize, at which
point better attacks exist — hence low.

There is also a benign-but-real correctness edge with no attacker: a workspace with >50 labels
where a user selects 51+ will silently lose filters on reload. The failure mode is **fail-open**
(more tasks shown than intended) — but every task shown was already authorized and already
rendered before the filter existed, so there is no confidentiality consequence. Worth knowing;
not a security defect.

**Remediation.** Apply the same bounds inside `normalizeFilters`, or bound centrally in
`toBoardFilterSearchParams` so every write path inherits it.

---

### C-4 · Low · Unrecognized `status`/`priority` values render as attacker-chosen text in trusted chrome

**Location:** `apps/web/src/components/board/board-toolbar.tsx:153-156` and `:548`;
`apps/web/src/lib/i18n/domain.ts:26-30`.

```ts
const getStatusDisplayName = (statusId: string) => {
  const column = project?.columns?.find((col) => col.id === statusId);
  return column?.name || statusId;          // <- raw URL value
};
```

and `getPriorityLabel` falls back to `toDisplayCase(priority)` — also the raw value.

**Impact.** `?status=<128 chars of anything>` renders that text inside an `ActiveFilterChip` in the
toolbar. **This is not XSS** — it is a JSX text child, React escapes it, and I confirmed there is
no `dangerouslySetInnerHTML` or `innerHTML` anywhere in `board-toolbar.tsx` or in any changed
file. It is a UI text-injection / phishing-assist surface: a link can place attacker-chosen copy
(e.g. "Session expired — re-verify at …") into trusted application chrome. Newly reachable
because status/priority values previously came only from clicks and `localStorage`; they now come
from the URL. Capped at 128 chars by `MAX_FILTER_VALUE_LENGTH`. Low, and arguably accepted as the
cost of a shareable URL.

**Remediation.** Optional. If desired, render the i18n "unknown" fallback instead of the raw id
when no matching column exists — mirroring what `getAssigneeDisplayName` already does correctly
at `board-toolbar.tsx:164-167`.

---

### C-5 · Info · Two exported codec entrypoints are not total; only `readBoardSearchParams` is

**Location:** `board-filter-search-params.ts:55-68` (`parseBoardFilterSearch`) and `:85-89`
(`searchCarriesBoardFilters`), consumed at `board.tsx:163-164` and
`use-board-filter-url-sync.ts:21`.

**Impact.** Verified empirically: `parseBoardFilterSearch` and `searchCarriesBoardFilters` **throw**
on an object with a throwing getter, because `readFacetProperty` (:48-53) does `source[key]` with
no guard. Only `readBoardSearchParams`'s `try/catch` (:126-135) contains it.

This is **not currently reachable** — both are only ever fed `Route.useSearch()`, which is the
post-`validateSearch` plain object. But it is an undocumented precondition on an exported
function, and `board.tsx:163` calls it inside a `useMemo` during render, where a throw would take
out the subtree. It is a latent trap for the next caller.

**Remediation.** A comment stating the precondition, or fold the `try/catch` down into
`parseBoardFilterSearch` so totality is a property of the module rather than of one wrapper.

---

### Checks that found nothing — stated as "none found" because that is the truth

**`validateSearch` totality (item 1) — guarantee is real and load-bearing, not accidental.**
I transpiled the module with `esbuild` and ran `readBoardSearchParams` against 32 hostile inputs:
`null`, `undefined`, number, `NaN`, string, boolean, `BigInt`, `Symbol`, `{}`, arrays, nested
arrays, function, `Date`, `RegExp`, nested-object facet, array-of-objects, array with
`null`/`undefined`/number/object members, **throwing getter on `status`**, **throwing getter on
`taskId`**, **`Symbol.toPrimitive` that throws**, **a Proxy whose `has`/`get`/`getOwnPropertyDescriptor`
all throw**, **a revoked Proxy**, a cyclic object, a `__proto__` payload, a null-prototype object,
200k-element arrays, a 1,000,000-char string, and non-string/throwing-`toString` `taskId`.

**Result: 0 throws out of 32.** The `try/catch` is genuinely reachable and genuinely necessary —
`null`/`undefined` hit it via `source.taskId` (`:130`) raising a `TypeError`, and the throwing
getters and revoked Proxy hit it via `readFacetProperty`. Malformed input degrades to `{}` or to
the well-formed subset (e.g. `{status:[null,undefined,"todo",5,{}]}` → `{"status":["todo"]}`).
IS-6 / FR-9 / NFR-3 hold under adversarial input, not just under the table-driven test.

**Prototype pollution (item 2) — none found.** `Object.prototype.polluted` remained `undefined`
across every payload. The parser writes into a fresh object literal (`:61-67`) keyed by the frozen
`BOARD_FILTER_KEYS`, and reads via `Object.hasOwn` (`:52`). `applyBoardFiltersToSearch` (`:111-123`)
uses `{...prev}` + `delete` + spread: spread copies `__proto__` as an *own data property* rather
than invoking the setter, so `{"__proto__":{"polluted":"yes"}}` produced an output object with an
own `__proto__` key and **no** pollution of `Object.prototype`. Confirmed by direct assertion.
No path copies attacker-controlled keys into a filter facet.

`normalizeFilters` in the hook (`use-task-filters-with-labels-support.ts:25-42`) is equally safe:
it spreads `DEFAULT_FILTERS` into a fresh literal (`:31`) and indexes only with keys from the
fixed `FILTER_KEYS` array (`:33-34`). A stored `__proto__` key is never read.

**Injection sinks (item 4) — none found.** Grepped all nine changed source files for
`dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function`, `document.write`, `.src =`, and
`href =`: zero hits. Filter values reach only `Array.prototype.includes` comparisons
(`use-task-filters-with-labels-support.ts:134, 142, 150, 204-206`), `===` comparisons in
`areBoardFiltersEqual` (`:107`), JSX text children, and TanStack Router's own search encoder. No
network URL is built by string concatenation — `get-tasks.ts:4-6` uses the typed `@kaneo/libs`
client with a structured `param` object. One info-grade note: `getPriorityLabel`
(`lib/i18n/domain.ts:27`) interpolates the value into an i18next *key*
(`` `tasks:priority.${priority}` ``). Worst realistic case is resolving an unintended existing
translation string; i18next splits the namespace on the first `:`, so the reachable key space is
confined to the `tasks` namespace. Not a vulnerability.

**Storage trust boundary (item 5) — constrained as claimed.** `readStoredFilters` (`:44-60`) is
called from the `useState` lazy initializer (`:75-77`), so the `JSON.parse` is now render-phase.
It is wrapped in `try/catch` (`:49-59`), so a malformed blob degrades to `DEFAULT_FILTERS` rather
than throwing during render. `normalizeFilters` accepts a key's value only if `Array.isArray`
(`:35`) and filters members to `typeof v === "string"` (`:36`) — a hostile payload cannot inject
non-string values, extra keys, or objects into filter state. **Escalation ceiling from a hostile
`localStorage` blob is: wrong filters shown, arbitrary ≤128-char text in a chip (C-4), and —
newly — those values pushed into the victim's URL (C-3, feeding C-1).** That last step is a small
genuine escalation over the pre-change state, where a hostile blob stayed local. Still requires
XSS or console access first. The render-phase `JSON.parse` of a large blob is real synchronous
work, as flagged, but is bounded by the ~5 MB `localStorage` quota and happens once per mount.

**Dependencies (item 6) — NFR-1 verified, none added.**
`git status --porcelain -- apps/web/package.json package.json pnpm-lock.yaml` returns **empty**.
`git diff --stat` lists exactly eight tracked files, all `apps/web/src/**`. No manifest, no
lockfile.

**Secrets (item 7) — none found.** The checklist regex plus `token` across all nine changed source
files returns zero hits. Zero `console.*` calls and zero `Sentry.*` calls in changed files —
nothing in this run logs filter values directly. Only the five facet id lists and the pre-existing
`taskId` are ever written to the search object, structurally enforced by `BOARD_FILTER_KEYS`
(`:7-13`) being the sole iteration source in `toBoardFilterSearchParams` (`:75-80`).

**FR-17/FR-18 cross-route compatibility — verified safe.** All nine `navigate()` sites now use
`withTaskId`. I checked the widening concern directly: `applyBoardFiltersToSearch` and
`withTaskId` do preserve arbitrary unrelated keys from `prev` (confirmed:
`{evil:"<script>", taskId:"t1", status:"old"}` → `{"evil":"<script>","taskId":"t1","status":["new"]}`).
This is harmless because (a) `prev` is always the *post-validation* search object, and (b) each
destination route re-validates — `backlog.tsx:51-53` returns an object literal containing only
`taskId`, discarding everything else. Preserved junk is never rendered and never leaves the URL.
I also checked `public-project.$projectId.tsx`, the one **unauthenticated** route that grepped as
a possible consumer: it imports `PublicListView` from `@/components/public-project/list-view`
(`:10`), a different module. **No changed file is reachable from any unauthenticated route.**

**Authz / role matrix (§7) — verified unchanged.** No changed file touches `@kaneo/permissions`,
API middleware, or any endpoint. The route guard, the workspace-scoped task fetch, and the
permission vocabulary are byte-identical to the baseline.

---

## 4. Threat model delta

| Actor | Before | After | Δ |
|---|---|---|---|
| Unauthenticated recipient of a shared link | Redirected to sign-in; sees `workspaceId`/`projectId`/`taskId` in the URL | Same, plus assignee/label cuid2s — including in `/auth/sign-in?redirect=…` (`_authenticated.tsx:19`) | **New:** opaque ids visible pre-auth. Grants no access; ids are cuid2 and non-enumerable. |
| Authorized workspace member | Already has every member `userId`, name and avatar via `useGetActiveWorkspaceUsers` | Identical | **None.** No new intra-workspace disclosure. |
| Sentry (and anyone with Sentry access) | Received URLs with `workspaceId`/`projectId`/`taskId` — no personal data | Also receives `assignee=<cuid2>` on ~10% of all sessions and 100% of erroring ones | **New, and this is the material one (C-1).** Pipe is pre-existing; the *class* of data is new. |
| Plausible (demo/cloud hostnames only) | Page URLs | Page URLs incl. filter params | **Marginal.** Kaneo's own instance; never loads self-hosted. |
| Third-party site the user navigates to | Origin only (`Referrer-Policy: strict-origin-when-cross-origin`) | Origin only | **None.** Already mitigated — §6's named vector is the one that was already closed. |
| Attacker who can craft a link the victim opens | Could set `taskId` | Can set five facets; can inject ≤128 chars of text into a filter chip (C-4); can cause 44–222 ms of main-thread work per navigation (C-2) | **New but minor.** No XSS, no privilege change, no data access. |
| Attacker with XSS / console access | Could write hostile `localStorage`; effect stayed local | Hostile `localStorage` now propagates into the URL, history, and Sentry (C-3) | **Small escalation**, gated behind an already-catastrophic precondition. |
| Attacker probing for IDOR or enumeration | — | Filter never crosses the network; no request accepts it; existent and non-existent ids are indistinguishable | **None.** Structurally foreclosed. |

---

## 5. Residual risks to accept knowingly

1. **A shareable filtered URL is a shareable identifier.** Cannot be engineered away without
   abandoning the feature or moving to opaque server-side view tokens. Inherent to IS-2.
2. **Browser history, cross-device profile sync, and reverse-proxy access logs** will contain
   assignee cuid2s. Inherent to URL state.
3. **Sentry (C-1), if left unscrubbed.** This one *can* be engineered away and should be a
   follow-up ticket against `instrument.ts`. If the decision is to accept instead, add the row to
   §6 so the acceptance is on the record — it currently is not.
4. **Chat unfurls** persist the identifier in third-party systems (Slack, Teams). No board data
   is exposed to the unfurl bot, but the id outlives the message in their retention.
5. **>50 selected labels silently drop on reload** (C-3). Fail-open, no confidentiality impact,
   but a user-visible surprise in large workspaces.
6. **KD-1/KD-2/KD-3** carry forward as declared out of scope. Security-relevant note on KD-2 only:
   `backlog.tsx` and `gantt.tsx` still replace the whole search object, so if they ever gain URL
   filter state the preservation seam must be applied there too.

---

## 6. Things I could not verify

- **That Sentry actually transmits the query string in this SDK version.** C-1 is derived from
  config inspection — the presence of `browserTracingIntegration()`/`replayIntegration()` and the
  *absence* of any `beforeSend`/`beforeSendTransaction`/`beforeBreadcrumb`/URL scrubber in
  `instrument.ts` — plus documented `@sentry/react` v10 default behavior. I did **not** observe a
  live Sentry payload. The absence of scrubbing is certain; the exact captured field set is
  inferred. Confirm against one real event before deciding to accept rather than fix.
- **Whether `VITE_SENTRY_DSN` is set in the deployments that matter.** `instrument.ts:3-6` gates on
  it, so C-1's blast radius is deployment-dependent and I cannot see deployment config.
- **Plausible's server-side query-param retention.** The client sends `location.href`; whether
  `plausible.kaneo.app` stores or discards the query string is an instance-config question
  outside this repo.
- **Real browser Back/bfcache behavior (AC-9).** Not a security check, but I note the run's own
  honesty caveat is correct — I did not exercise a real browser either.
- **I did not run the test suite.** Correctness verification is the test phase's job; I reviewed
  the code and ran my own adversarial harness against the transpiled codec instead.
- **`pnpm audit --prod` reports 2 high, both pre-existing and out of scope.** `nanoid` <3.3.18 via
  `apps__api > better-auth > vitest > vite > postcss > nanoid`, and `deepmerge-ts` <8.0.0 via
  `apps__api > better-auth > prisma > @prisma/config > deepmerge-ts`. Both are transitive under
  `apps/api`'s `better-auth`, both traverse into that package's own dev-tooling chain, neither is
  in the `apps/web` bundle, and no dependency changed in this run (verified: lockfile untouched).
  **Advisory only — does not gate this run.**

---

## Noted (pre-existing, out of scope)

- `apps/web/src/instrument.ts` has no URL/PII scrubbing hooks at all. Pre-existing, but this run
  is what makes it matter (C-1).
- `apps/web/src/routes/_layout/_authenticated.tsx:19` reflects the full `location.href` into a
  `?redirect=` param on an unauthenticated page. Pre-existing; exposure profile widened by this run.
- `apps/web/index.html:35-51` hardcodes a third-party analytics script gated on hostname string
  equality. Pre-existing; correct as written.
- KD-1 (duplicated filter hooks), KD-2 (same navigate bug on backlog/gantt), KD-3 (unconditional
  `localStorage` write) — declared known and deliberately unfixed. Not re-litigated here.

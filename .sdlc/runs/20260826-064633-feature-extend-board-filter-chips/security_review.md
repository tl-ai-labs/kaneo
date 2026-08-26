# Security Review — brownfield, feature-extend

Run: `20260826-064633-feature-extend-board-filter-chips`
Verdict: **pass_with_recommendations**

## Scope

Changed-files-only, per the brownfield/feature-extend intent scoping. File list taken from
`.sdlc/runs/20260826-064633-feature-extend-board-filter-chips/provenance.json` (11 distinct paths,
all under `apps/web/`):

| Path | New? |
|---|---|
| `apps/web/src/lib/board-filter-search-params.ts` | new |
| `apps/web/src/lib/board-filter-search-params.test.ts` | new |
| `apps/web/src/components/board/board-search-preservation.test.tsx` | new |
| `apps/web/src/hooks/use-task-filters-with-labels-support.ts` | edited |
| `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` | edited |
| `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx` | edited |
| `apps/web/src/components/kanban-board/index.tsx` | edited |
| `apps/web/src/components/kanban-board/task-card.tsx` | edited |
| `apps/web/src/components/list-view/index.tsx` | edited |
| `apps/web/src/components/list-view/task-row.tsx` | edited |
| `apps/web/src/components/list-view/task-row.test.tsx` | edited |

`apps/web/src/components/board/board-toolbar.tsx` is **not** in provenance, but it is the render
sink for the values this run newly admits from the URL, so it was read as a consumer to trace the
data flow. No finding is filed against it as a changed file.

Enumeration method: `Glob`/`Grep` were unavailable on this build, so all searching was done with
Bash (`grep -rn`, `find`, `git status --porcelain`). Every negative claim below ("no secrets",
"no `dangerouslySetInnerHTML`", "no dependency change") is backed by a command that ran and
returned; none is inferred from a listing that could not be obtained.

## Threat model delta

Before this run, board filter state (`status`, `priority`, `assignee`, `dueDate`, `labels`) lived
only in origin-scoped `localStorage`. After it, that state round-trips through TanStack Router
search params. Two things change:

1. **Outbound.** Assignee values are workspace member `userId`s and label values are label IDs.
   They now appear in the URL, and therefore in browser history, bookmark sync, reverse-proxy and
   CDN access logs, screenshots, and anywhere a user pastes the link — which the feature actively
   encourages. Assessed below and accepted; see *Residual accepted risk*.
2. **Inbound — this is the larger delta.** `parseBoardFilterSearch` is a new parser of fully
   attacker-controlled input. A crafted URL can, for the first time, dictate the contents of an
   authenticated victim's filter chips and of their `localStorage`. This direction was not called
   out as the primary risk in requirements §7 (which frames the change as outbound-only), and it is
   where both real findings sit.

No server-side surface moved: `apps/api/**` appears nowhere in provenance, no endpoint, schema,
permission or authorization decision changed, and no authorization moved to the client.

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Low | Reflected content / UI spoofing | `apps/web/src/lib/board-filter-search-params.ts:41-55`; sink at `apps/web/src/components/board/board-toolbar.tsx:154-157, 165, 540-556, 566-580` | Closed-vocabulary filter keys are not validated against their vocabulary | Validate `priority` and `dueDate` in the parser; drop or genericise unresolved `status` IDs |
| Low | Client DoS / storage abuse | `apps/web/src/hooks/use-task-filters-with-labels-support.ts:92-95` | Unguarded `localStorage.setItem`, now writing URL-dictated content under a URL-dictated key | Wrap the write in `try/catch`; persist only for a loaded project |
| Low (pre-existing code, changed file) | Reverse tabnabbing | `apps/web/src/components/kanban-board/task-card.tsx:295, 373`; `apps/web/src/components/list-view/task-row.tsx:237, 316` | `window.open(url, "_blank")` omits `noopener` | Pass `"noopener,noreferrer"` as the third argument |
| Info | Data propagation | `apps/web/src/routes/_layout/_authenticated.tsx:16-21` | Filter params flow into the sign-in `redirect` param | None — same origin, same data |
| Info | Resource use | `apps/web/src/lib/board-filter-search-params.ts:41-54` | Cap applied after accumulation, not during | None — bounded upstream |

---

### 1. Low — Unvalidated closed-vocabulary values are reflected verbatim into the board toolbar

`parseBoardFilterSearch` applies only three constraints to every key uniformly: `typeof === "string"`,
non-empty, and `length <= 128`. It never checks membership in a vocabulary, even for the three keys
that *have* a closed vocabulary:

```ts
// board-filter-search-params.ts:45-51
if (
  typeof item === "string" &&
  item !== "" &&
  item.length <= MAX_BOARD_FILTER_VALUE_LENGTH
) {
  validValues.push(item);
}
```

Two render paths then fall back to echoing the raw value:

```ts
// board-toolbar.tsx:154-157
const getStatusDisplayName = (statusId: string) => {
  const column = project?.columns?.find((col) => col.id === statusId);
  return column?.name || statusId;          // unresolved id rendered verbatim
};
```

```ts
// lib/i18n/domain.ts:26-30 — reached via getPriorityLabel at board-toolbar.tsx:165
return i18n.t(`tasks:priority.${priority}`, { defaultValue: toDisplayCase(priority) });
```

So `?status=<128 chars>` or `?priority=<128 chars>` renders attacker-chosen text inside the status
or priority chip of an authenticated victim's board.

**Impact.** This is *not* XSS. The values are rendered as React children inside `<span>` elements
(`board-toolbar.tsx:96`), React escapes them, and a repo-wide grep confirms no
`dangerouslySetInnerHTML` on this path and no `href`/`src` constructed from a filter value. What it
is, is a UI-spoofing and social-engineering primitive: 128 characters of attacker-controlled text
rendered inside trusted application chrome on a page the victim is authenticated to. It is new,
because before this run chip values could only originate from filters the victim had themselves
selected. Severity stays Low: text-only, no markup, no privilege change, and the victim must open a
crafted link.

Note the asymmetry that makes this look like an oversight rather than a decision — `assignee`
already does the right thing (`getAssigneeDisplayName` returns `t("common:people.unknown")` for an
unresolved ID, `board-toolbar.tsx:166-168`) and `dueDate` is structurally safe (its ternary at
`board-toolbar.tsx:614-627` funnels anything unrecognised to the `noDueDate` i18n key). Only
`status` and `priority` echo.

**Recommendation.** In `parseBoardFilterSearch`, add a per-key allowlist for the closed
vocabularies: `priority` against the set already enumerated at `board-toolbar.tsx:339`
(`urgent | high | medium | low`, plus `no-priority` which `getPriorityIcon` handles), and `dueDate`
against `DUE_DATE_FILTER_VALUES`. `status` and `labels` are open sets of server-issued IDs and
cannot be allowlisted in the parser — for `status`, prefer changing `getStatusDisplayName` to return
an i18n unknown-value string rather than `|| statusId`, mirroring assignee.

---

### 2. Low — Crafted URL amplifies `localStorage` writes ~450x against an unguarded `setItem`

The persist effect has no error handling, unlike its sibling read at lines 78-89 which is wrapped:

```ts
// use-task-filters-with-labels-support.ts:92-95
useEffect(() => {
  if (!storageKey || typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(filters));   // can throw
}, [filters, storageKey]);
```

The `setItem` line itself is pre-existing and unmodified. What this run changes is what reaches it.
Two inputs are now attacker-chosen in a single URL:

- **the value** — up to 5 keys x `MAX_BOARD_FILTER_VALUES` (50) x `MAX_BOARD_FILTER_VALUE_LENGTH`
  (128) ~= 32 KB of JSON, versus roughly 70 bytes (`{"status":null,...}`) before this run;
- **the key** — `storageKey` is `` `kaneo:board-filters:${projectId}` `` (line 55) and `projectId`
  is the route path param, equally attacker-chosen. `board.tsx` declares no `loader` or
  `beforeLoad`, so `RouteComponent` mounts and both effects run for a `projectId` that does not
  exist or that the user cannot access; the API failure of `useGetTasks` does not prevent the write.

An attacker can therefore drive ~160 navigations to distinct synthetic `projectId`s to approach the
typical ~5 MB origin quota, after which the next `setItem` throws `QuotaExceededError` out of a
`useEffect` with no handler, breaking the board for legitimate projects.

**Impact.** Low. The victim must be authenticated (the route sits under `_layout/_authenticated`,
whose `beforeLoad` redirects otherwise) and must follow many attacker-supplied links; the damage is
recoverable by clearing site data. But the amplification factor is genuinely introduced here, and
the crash mode is a single missing `try/catch`.

**Recommendation.** Wrap the write in `try/catch` and ignore the failure — this also fixes the
unrelated pre-existing case of storage being unavailable (Safari private browsing, blocked storage),
where the board currently throws on mount. Optionally, gate persistence on the project having
loaded, so an unknown `projectId` never allocates a key.

---

### 3. Low — `window.open(url, "_blank")` without `noopener` (pre-existing, advisory)

The brief asked specifically whether external-link rendering on board/task views could leak a
filtered board URL to a third party. Traced in source rather than reasoned about:

- `task-card.tsx:295` and `:373`, `task-row.tsx:237` and `:316` all call
  `window.open(pr.url, "_blank")` for GitHub/Gitea pull-request links.

**Referer leakage is not a real concern here.** Both shipped nginx configs set
`Referrer-Policy: strict-origin-when-cross-origin` (`apps/web/nginx.conf:9`,
`apps/web/nginx.kaneo.conf:8`), which also matches the modern browser default. For a cross-origin
destination such as github.com the browser sends only the origin — path and query, and therefore all
filter values, are stripped. This clears the headline outbound question.

**The residual issue is reverse tabnabbing.** Unlike anchor elements, `window.open()` does *not* get
an implied `noopener`, so the opened page retains a live `window.opener` and can navigate the
victim's Kaneo tab to a phishing page. External-link URLs are user-supplied via the integrations.
Every anchor-based external link in the app already carries `rel="noopener noreferrer"`
(`external-links-accordion.tsx:129`, `comment-card.tsx:160` and `:194`, `attachment-card.tsx:28`,
`version-display.tsx:11`, `public-project/task-detail-modal.tsx:205/240/268`), so these four
`window.open` calls are the outliers.

**Origin: pre-existing.** Per brownfield rules this does not gate the run. It is filed rather than
merely noted because both files are in this run's changed set and the fix is one argument:
`window.open(pr.url, "_blank", "noopener,noreferrer")`.

---

### 4. Info — Filter params propagate into the sign-in redirect

`_authenticated.tsx:16-21` redirects unauthenticated visitors with `search: { redirect: location.href }`,
so a shared filtered board URL carries its assignee/label IDs into the sign-in page URL. Same origin,
same data already present in the link the user clicked, no new exposure. No action.

### 5. Info — Cap applied after accumulation

`validValues` accumulates every conforming item and only then applies `.slice(0, 50)`
(`board-filter-search-params.ts:41-54`), so a hostile URL with tens of thousands of repeated params
allocates a transient array proportional to the URL length. Not exploitable: the router has already
materialised that array before the function is called, the work is linear, and URL length is bounded
by the browser and any intervening proxy. Noted only so the reasoning is on record.

## Explicitly-cleared items

Each of the following was checked by reading the source or running a command, not assumed.

- **Parser cannot throw.** `parseBoardFilterSearch` builds its result first, guards
  `if (!search || typeof search !== "object")` at line 27, and thereafter uses only property reads,
  `typeof`, `Array.isArray` and `slice` — no `JSON.parse`, no `decodeURIComponent`, no regex, no
  user-supplied callback. A throwing `validateSearch` would crash the route; this one cannot.
  Confirmed by test against `null`, `undefined`, `"string"`, `42`, `{ labels: {} }`
  (`board-filter-search-params.test.ts:91-109`).
- **Prototype pollution is structurally impossible.** The loop iterates the fixed literal
  `BOARD_FILTER_SEARCH_KEYS` (line 31), never `Object.keys(search)`, and assigns only into a
  locally-constructed `result` (line 55). An attacker key such as `__proto__` or `constructor` is
  never used as an assignment target. Verified by reading, and covered by the
  `JSON.parse('{"__proto__":["x"]}')` case plus the `({}).polluted` assertion in the test.
- **No XSS sink.** No `dangerouslySetInnerHTML` anywhere on the chip render path. No filter value is
  used to build an `href`, `src`, `style` or `srcdoc`. `AvatarImage src={member?.user?.image ?? ""}`
  (`board-toolbar.tsx:173`) — for an unresolved assignee ID the member lookup yields `undefined`, so
  `src` is the empty string, not the attacker's value.
- **No crash from unknown vocabulary values.** `getColumnIcon` (`lib/column.tsx:6-28`) indexes two
  object maps with the raw ID; `__proto__`, `constructor` and `toString` all degrade to the `Circle`
  fallback rather than returning a non-renderable value. `getPriorityIcon` (`lib/priority.tsx`) has a
  `default` branch. `i18n.t` returns a string for an unresolved key — `returnObjects` is not enabled
  anywhere in `apps/web/src` (grep returned nothing), so the "Objects are not valid as a React child"
  crash mode is unreachable.
- **No open redirect, no SSRF.** No filter value reaches a `fetch` URL or a navigation target. Every
  `navigate` call added by this run uses `to: "."` with a functional `search` updater; the values are
  only ever placed into query params of the current route.
- **Authorization unchanged, and a shared link confers nothing.** No `apps/api/**` path appears in
  provenance. The route remains under `/_layout/_authenticated`, whose `beforeLoad` redirects
  unauthenticated visitors to sign-in. Filtering is a pure client-side view over `useGetTasks`, which
  is still API-authorized and workspace-scoped; an authenticated non-member who opens a shared
  filtered URL receives no task data, and the filter params are inert without it. No authorization
  decision was moved to the client.
- **No secrets introduced.** Targeted grep for
  `(api[_-]?key|secret|token|password|credential)\s*[:=]\s*['"][a-zA-Z0-9]` across all 11 changed
  files returned no match. No `console.*` in the new lib or the modified hook, so no filter value is
  logged. Test fixtures use synthetic identifiers (`task-1`, `project-1`, `workspace-1`,
  `userId: null`) — no real credentials, tokens or user data.
- **No dependency change.** `git status --porcelain -- '*package.json' '*pnpm-lock.yaml'
  'pnpm-workspace.yaml'` returned empty. NFR-3 (no new runtime dependency) holds; the parser is
  hand-written `typeof`/`Array.isArray` narrowing with no `zod`.
- **Template PII fields are absent from the repo entirely.** `government_id`, `bank_account` and
  `salary_base` return no matches across `apps/` and `packages/`. The checklist's encryption-at-rest,
  response-masking, audit-log, JWT-secret, password-hashing and rate-limiting items are not
  applicable: this run touches no persistence, no serializer, no auth path and no server code.

## Residual accepted risk

- **Workspace member `userId`s and label IDs now appear in URLs**, and thus in browser history,
  bookmark sync, and reverse-proxy/CDN access logs. They are opaque, workspace-scoped, non-sequential
  IDs — not emails or names — already visible to any authenticated client rendering the board, and a
  recipient without workspace membership resolves nothing from them. Referer propagation to third
  parties is blocked by `Referrer-Policy: strict-origin-when-cross-origin` (finding 3). Accepted per
  requirements §7 and change_plan §9 item 10, which flagged this surface in advance and planned no
  mitigation. Recorded here as accepted, not waved through: the one operational consequence worth
  noting is that self-hosters who front Kaneo with a logging proxy will now retain member IDs in
  access logs, which may matter for log-retention policy.
- **A shared link silently replaces the recipient's own saved filters** for that project
  (`use-task-filters-with-labels-support.ts:60-67, 92-95`). Intentional and approved. As a privacy
  matter it is one-directional — the link writes to the recipient's storage and never reads from it,
  so no state leaks back to the sender. Only a usability cost.
- **Assignee matching uses `task.userId` rather than `assigneeId`** — known and deliberate. Assessed
  for security consequence: none. It affects which tasks are displayed, not which tasks the API is
  willing to return, and the API-side authorization boundary is untouched. Not a finding.

## Noted (pre-existing, out of scope)

- `pnpm audit --prod` reports **2 high** severity advisories, both transitive under
  `apps/api > better-auth` and both unrelated to this run (no dependency changed):
  - `nanoid` `<3.3.18` — GHSA-2v37-7h3g-55p8, via `better-auth > vitest > vite > postcss > nanoid`.
  - `deepmerge-ts` `<8.0.0` — GHSA-ggr8-5vv4-36mx, via `better-auth > prisma > @prisma/config`.

  Both reach production only through a dev-tooling chain hoisted under a runtime dependency. They do
  not gate this run; they should be picked up by a `deps`-intent run.
  (Tooling note: the checklist's `npm audit --omit=dev` fails with `ENOLOCK` here — this is a pnpm
  workspace with `pnpm-lock.yaml` and no `package-lock.json`. `pnpm audit --prod` was used instead.
  The checklist command should be updated for this repo.)
- `apps/web/nginx.kaneo.conf:7` sets `X-XSS-Protection "0"` while `apps/web/nginx.conf:8` sets
  `"1; mode=block"`. The `0` value is the modern correct choice and the inconsistency is harmless,
  but the divergence between the two shipped configs is worth reconciling.

## Required fixes before sign-off

None. No finding introduced by this run rises to a gating severity.

Recommended before merge, in priority order:

1. Wrap the `localStorage.setItem` at `use-task-filters-with-labels-support.ts:92-95` in `try/catch`
   (finding 2). One-line change; also fixes a pre-existing crash when storage is unavailable.
2. Validate `priority` and `dueDate` against their closed vocabularies in `parseBoardFilterSearch`,
   and stop echoing unresolved `status` IDs in `getStatusDisplayName` (finding 1).
3. Add `"noopener,noreferrer"` to the four `window.open` calls in `task-card.tsx` and `task-row.tsx`
   (finding 3, pre-existing).

# Security Review — pass1

Run: `20260831-060942-docs-board-features` · Mode: brownfield · Intent: docs
Scope: files written by this run only, per provenance.json.

## Summary

This run made a single documentation-only edit: 6 added lines in one hunk of
`apps/docs/core/functional/plan-and-execute-tasks.mdx`, section "## 5. Use filters to focus".
No source, config, dependency, or environment file was touched — confirmed at the filesystem
level, not merely by `git status`. The added prose describes board filter chips using
user-visible English UI copy only; it discloses no internal identifiers, paths, keys, endpoints,
credentials, workspace data, or real member names. It makes no claim that a reader could mistake
for an access-control or privacy guarantee, and it instructs no action that weakens posture.
No gating findings. Two advisory notes are recorded below, both pre-existing code behavior
outside this run's scope.

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| — | — | — | No gating findings in this run's changed files | — |

## Passing checks

**1. Disclosure — pass.**
Every literal string quoted in the added prose is rendered end-user copy, verified against
`/home/sangeetha/projects/kaneo/i18n/en-US.json`, not an internal i18n key:
- "is any of" → `boardFilters.operators.isAnyOf` (line 1849)
- "include any of" → `boardFilters.operators.includeAnyOf` (line 1850)
- "{{count}} selected" → `boardFilters.selectedCount` (line 1840)
- "Clear all filters" → `actions.clearAllFilters` (line 14)

The diff contains no file paths, component names (`ActiveFilterChip`, `board-toolbar.tsx`, and
`use-task-filters.ts` are all absent from the prose), line numbers, API endpoints, storage keys,
secrets, credentials, workspace IDs, project IDs, or real user/member names. The illustrative
value "3 selected" is a generic count, not sample data. No violation of the AGENTS.md rule
against exposing internal fields or private workspace data.

**2. Security-relevant misstatement — pass.**
The added text is confined to chip rendering and chip clearing semantics. It states what a chip
displays and what its clear control removes. It never asserts that filtering controls who can
see a task, hides tasks from other users, or restricts access. There is no language a reader
could reasonably read as an authorization or privacy guarantee, so the AGENTS.md principle that
"hiding an action in the UI is not an authorization check" is not contradicted.

Factual accuracy was independently verified against
`/home/sangeetha/projects/kaneo/apps/web/src/components/board/board-toolbar.tsx`, since an
inaccurate behavioral claim is itself a potential misstatement vector:
- Status, Priority, Assignee, Due date chips render the named selection at length 1 and fall
  back to `selectedCount` above 1 — matches the prose.
- The Labels chip unconditionally renders `selectedCount` with no length-1 special case — matches
  the prose's "always shows a count".
- Each chip's `onClear` calls `updateFilter(<key>, null)` (labels via `clearLabelFilters`),
  nulling the entire filter rather than one value — matches "clears that whole filter".
The prose is accurate.

**3. Instructional safety — pass.**
The added lines give no instruction at all; they are descriptive. Nothing directs a user to
disable a control, share state, widen access, or bypass a check.

**4. Scope containment — pass, independently verified.**
`provenance.json` lists exactly one `files_touched` entry. Its `sha_after`
(`099bba5e…c0f52`) matches a live `sha256sum` of the file, so the recorded provenance is not
stale. A filesystem sweep for anything modified inside the run window and outside `.sdlc/`
returned exactly one path:

```
find . -newermt "2026-08-31 06:16:57" ! -newermt "2026-08-31 06:35:00" -type f \
  -not -path "./.git/*" -not -path "*/node_modules/*" -not -path "./.sdlc/*"
→ ./apps/docs/core/functional/plan-and-execute-tasks.mdx
```

Confirmed untouched: all `package.json` / `pnpm-lock.yaml`, `apps/web/src/**`, `apps/api/**`,
all `.env*`, `README.md` (mtime 2026-08-20), and `apps/docs/docs.json` (mtime 2026-08-20).

**Gate-0 housekeeping claim — verified independently, and it holds.** I did not take the
briefing's assertion on trust. `.gitignore` (mtime 06:15:53.004) and `biome.json`
(mtime 06:15:53.049) both predate `preflight` at 06:16:43.119 and `run.start` at 06:16:57.999
in `orchestrator.log`, and predate this run's only write at 06:23:23.531 by roughly seven and a
half minutes. Their content is also unrelated to the docs edit: `.gitignore` adds ignores for
`.sdlc/**/*.db`, `.sdlc/local/`, `.hook-logs/`, and `.claude/settings.local.json`; `biome.json`
adds a single `!**/.sdlc` exclusion. Both are plugin-artifact housekeeping. They are correctly
attributed outside this run and are not gated here.

**Checklist items not applicable to a docs intent.**
Per the brownfield intent matrix, PII encryption tracing, route guards, JWT/password storage,
audit-log integrity, Helmet, rate limiting, and the global error filter are skipped: this run
changed no runtime code and cannot have introduced or removed any of them. `npm audit
--omit=dev` was not run and no dependency claim is made — no manifest or lockfile was modified,
so there is no dep delta attributable to this run. This is recorded as "not run", not as "pass".

## Persisted-state note — verdict: immaterial as a security finding for this run

`apps/web/src/hooks/use-task-filters.ts` persists the filter object to
`window.localStorage` under `kaneo:board-filters:<projectId>` on every change, and rehydrates it
on mount. The added prose does not mention this.

Verdict: **immaterial** — this is not a privacy-relevant documentation gap, and it does not gate
the run. Reasoning, stated plainly rather than hedged:

1. The persisted payload is arrays of status IDs, priority strings, assignee user IDs, a
   due-date enum, and label IDs — all identifiers the viewer already held while authenticated,
   for a project they already had access to. No task titles, descriptions, or member names are
   stored.
2. Documenting persistence would not remediate anything. The only genuinely security-adjacent
   property here is *residue after sign-out*, and that is a code property, not a docs property.
3. This page is a task-execution how-to. No reader makes a privacy or access decision on the
   basis of it, so the omission creates no false assurance.

At most this is a docs-completeness nit ("filters are remembered per project on this device"),
worth queuing as a future authoring improvement. It is not a security finding.

## Noted (pre-existing, out of scope — advisory, non-gating)

- **`apps/web/src/hooks/mutations/use-sign-out.ts` does not clear `localStorage` on sign-out.**
  Verified: the mutation calls `authClient.signOut` and navigates, with no `localStorage.clear()`
  or targeted `removeItem`. Consequently `kaneo:board-filters:<projectId>` entries (and the
  analogous board-sort state) survive logout, leaving project IDs and assignee user IDs readable
  in the browser profile by the next user of a shared or kiosk machine. Low severity — these are
  opaque identifiers, not content — but it is the real issue that the persistence question points
  at. Introduced by earlier runs, not this one. Suggest clearing `kaneo:*` view-state keys on
  sign-out.
- **Section 5 never states that board filters are view-only state.** Neither the pre-existing
  text nor the addition claims otherwise, so there is no misstatement to correct. Still, an
  explicit "filters change what you see, not what you can access" line would harden the page
  against future edits drifting toward an implied guarantee. Informational.

## Required fixes before sign-off

- None. No gating findings were introduced by this run.

VERDICT: pass — 0 critical, 0 high, 0 medium, 0 low; 2 advisory (pre-existing, non-gating)

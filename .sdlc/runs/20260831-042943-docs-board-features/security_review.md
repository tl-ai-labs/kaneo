# Security Review — pass1 (brownfield, intent: docs)

**Verdict: PASS** — the one file this run wrote (`apps/docs/core/functional/plan-and-execute-tasks.mdx`, +4/-0) introduces no security finding. Nothing requires action before sign-off. Two operator notes below concern files this run did **not** write but that will ride along in the same commit.

Scope: `apps/docs/core/functional/plan-and-execute-tasks.mdx` only, per `provenance.json`. Enumeration was done with `Bash` (`git diff`, `git status`, `stat`, `grep -rn`, `find`) — no listing failed, so every "absent" claim below rests on a search that actually ran.

---

## 1. Information disclosure — PASS

The added text is entirely user-visible UI vocabulary:

```
+Each applied filter appears as a chip in the board toolbar showing the field, match operator, and selected values. A chip covers one filter field, and clearing it drops every value chosen for that field.
+Once a filter is active, **Clear all filters** appears at the bottom of the filter dropdown menu.
```

Targeted grep over the added lines for `localStorage|kaneo:|userId|projectId|workspaceId|/api/|endpoint|schema|token` returned nothing. No internal field name, DB column, API shape, route, storage key, or permission-model detail appears. "field", "match operator", "chip", and "Clear all filters" all describe rendered UI; the operator label is the translated string `tasks:boardFilters.operators.isAnyOf` and the menu item is `common:actions.clearAllFilters` (`apps/web/src/components/board/board-toolbar.tsx:517-525`, chips at `:78-90`, `:534+`).

**Authorization/data model leakage: none.** The text says nothing about who can see what, nor about how tasks are fetched or scoped. It does not reveal that filtering happens client-side, which is the only implementation fact here with any security valence — and describing it either way would not be a disclosure, since the behavior is observable in the browser.

**On the omitted `kaneo:board-filters:<projectId>` key** (`apps/web/src/hooks/use-task-filters.ts:61`, `use-task-filters-with-labels-support.ts:49`): omitting it was **scope discipline, not a security control**, and that is the correct read. The key name is not a secret — it is present in the shipped client bundle and visible in any devtools session, so publishing it discloses nothing an attacker cannot trivially obtain. Its contents are the user's own filter selections (including assignee user IDs they already see) held in their own browser. The only real argument for keeping it out is editorial: end-user docs should not teach users to hand-edit persistence internals, and documenting a key creates a compatibility expectation. Recommendation: keep it undocumented, but do not record this as a security requirement.

## 2. Accuracy-as-security — PASS (no misleading framing)

The concern is real in principle: `useTaskFilters.filterTasks()` filters an already-fetched `Task[]` in the browser (`use-task-filters.ts:84+`) over `project.tasks`. Every task the filter hides has already been delivered to the client. Filtering is a **view** convenience with zero access-control weight.

The added wording does not claim otherwise. It uses "appears", "covers", "clearing it drops every value chosen for that field" — all mechanical descriptions of chip lifecycle. It contains no visibility, privacy, restriction, or hiding language ("hidden from", "only visible to", "restrict", "private"), so there is no sentence a reader could reasonably reinterpret as an access boundary. The surrounding pre-existing copy ("Use filters to focus", "Use filters aggressively during standups, planning, and triage") is likewise framed as personal workflow, not confidentiality.

No rewording is required. If the docs owner later wants belt-and-braces framing, an accurate optional sentence for the section is:

> Filters only change what you see on your own board. They do not change who can open or access a task — project and workspace permissions control that.

Recorded as optional; it is not a fix for a defect in this diff.

**Factual accuracy (verified against source, since inaccurate docs are the vector here):** chips do render subject + operator + values (`ActiveFilterChip`, `board-toolbar.tsx:78-90`); each chip maps to exactly one `BoardFilters` key and clearing sets that key to `null`, dropping all its values (`use-task-filters.ts:7-13, 21-27`); **Clear all filters** is rendered after a `DropdownMenuSeparator` at the end of the dropdown, gated on `hasActiveFilters` (`board-toolbar.tsx:517-525`). All three claims check out.

## 3. Write-contract compliance — PASS (with a config nit)

`.sdlc/local/write-contract.json` is `active: true`, `strict: true`, `mode: brownfield`, run-scoped, with a single-entry allowlist:

- `apps/docs/core/functional/plan-and-execute-tasks.mdx` — **allowlisted**, and it is the only entry in `provenance.json.files_touched` (packet `tp_docs_002`, written `2026-08-31T04:44:38.639Z`). Contract honored.
- Nothing on the `off_limits` list was written. `apps/web/src/**`, `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `apps/docs/docs.json`, `.env*` are all clean — `git status --porcelain` reports exactly three modified paths and none of them are off-limits entries.

**`.gitignore` and `biome.json` are neither allowlisted nor off-limits.** Under `strict: true` a write to either during execution would be an allowlist violation. **I independently verified they are not this run's output** rather than accepting the assertion:

| Evidence | Result |
|---|---|
| `stat` mtimes | `.gitignore` 04:37:00.803, `biome.json` 04:37:00.823, `write-contract.json` 04:37:00.718 — all three within 105 ms of each other |
| `run.start` in `orchestrator.log` | `04:37:47.314` — **47 s after** those writes |
| `execute_packets` phase | starts `04:41:14.812`, ends `04:44:38.685` |
| `plan-and-execute-tasks.mdx` mtime | `04:44:27.792`, inside the execute window and matching provenance `written_at` |
| `provenance.json` | lists **only** the `.mdx`; `commits: []`, `git_head_after: null` |

The config files were written in the same sub-second batch as the write contract itself, i.e. as Gate 0 setup, before the contract governed anything. **The claim holds; I found no contradicting evidence.**

Config nit (not a violation): `off_limits` contains `.sdlc/**` with no carve-out for the run directory, yet the run directory is where phase artifacts including this report are required to be written. The contract's literal text conflicts with its intended use. Worth adding an explicit exception such as `.sdlc/runs/<run-id>/**` so the enforcement rule is unambiguous.

## 4. Secrets / PII — PASS

Grep over the added lines for `api[_-]?key|secret|token|password|bearer|passwd|credential` followed by `=`/`:` → no match. Email-pattern grep → no match. The diff contains two English sentences and two blank lines; no credential, key, token, personal name, email, or user data. Repo-level sanity: `.env` is ignored (`.gitignore:9`), no `.env` is tracked (`.env.sample` and `apps/api/.env.test.example` are templates), and `apps/web/.env.development` / `.env.production` are tracked but pre-existing and untouched by this run.

## 5. Supply chain — PASS

No `package.json`, `pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock` appears in `git diff --name-only`. Grep over the added lines for `https?://`, markdown links `](`, images `![`, `<script`, `<img`, `import `, `require(` → **no match**. **No URL was introduced.** No new dependency, script, executable content, external link, or remote image. The only formatting construct added is `**Clear all filters**` (bold), which MDX renders inertly.

Dependency audit, reported honestly: `npm audit --omit=dev` **could not run** — this is a pnpm workspace with no `package-lock.json` (`npm error code ENOLOCK`). I do not report that as "clean". The equivalent `pnpm audit --prod` ran and found **2 high, 0 critical**, both transitive and both pre-existing:

- `nanoid` <5.0.9 — GHSA-2v37-7h3g-55p8 (infinite loop with custom generators)
- `deepmerge-ts` <8.0.0 via `better-auth > prisma > @prisma/config` — GHSA-ggr8-5vv4-36mx (stack exhaustion)

Neither is attributable to this run (no manifest change), so neither gates Gate 3.

---

## Findings requiring action

None. No finding is attributable to `apps/docs/core/functional/plan-and-execute-tasks.mdx`.

## Notes for the operator

1. **`.sdlc/` is untracked but only partially ignored — review the commit's file list.** The new `.gitignore` rules cover `.sdlc/**/*.db`, `.sdlc/local/`, `.hook-logs/`, and `.claude/settings.local.json`, but **not** `.sdlc/runs/**` or `.sdlc/baseline/**`. `git add -An .sdlc` shows 14 files would be staged by a `git add -A`, across this run and six earlier run directories. Kaneo is a public repository, and those artifacts contain operational metadata: `orchestrator.log` and `.sdlc/pre-check-status.json` include the GCP project name `ai-studies-console`, the Vertex backend/ADC configuration, absolute paths under `/home/sangeetha/...`, internal routing-policy names (`opus-plus-flash-v37`), and per-packet token/cost telemetry. No credentials are present (checked: no secret-like assignments anywhere under `.sdlc/`), so this is low severity, but it is avoidable disclosure. Either stage explicitly (`git add apps/docs/... .gitignore biome.json`) or extend `.gitignore` with `.sdlc/` plus a negation for any artifact you deliberately want tracked.
2. **The two Gate 0 config edits are benign and mildly security-positive.** `.gitignore` newly excludes `.claude/settings.local.json` and `.hook-logs/`, both of which can capture local prompts, paths, and tool invocations — good to keep out of a public repo. `biome.json` adds one linter-ignore entry, `"!**/.sdlc"`, matching the existing `.claude` / `.pi` entries; it changes no lint rule and has no runtime effect. Both are unrelated to the docs change, so mention them separately in the commit message rather than folding them into a docs commit.
3. **Two pre-existing high-severity transitive advisories** (`nanoid`, `deepmerge-ts`) are open on the production dependency tree. Out of scope for a docs run; worth a follow-up `deps` run.
4. **`npm audit --omit=dev` is not usable in this repo.** Any checklist or automation that treats its exit status as a gate signal will silently pass on `ENOLOCK`. Switch that step to `pnpm audit --prod`.

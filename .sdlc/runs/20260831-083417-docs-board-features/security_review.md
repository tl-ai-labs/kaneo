# Security review — run 20260831-083417-docs-board-features

**Scope:** changed files only. One user-source file changed: `apps/docs/core/functional/plan-and-execute-tasks.mdx` (+18, −0). Intent: docs.
**Base:** clean at HEAD `5d1fc910`. **Verdict: pass-with-notes.**

All claims below were verified against the repository at `/home/sangeetha/projects/kaneo`, not inferred from the diff text alone.

---

## 1. Information disclosure

**No finding.** The added text describes only what an authenticated user already sees rendered on their own board toolbar.

Judged claim by claim, the added text contains: chip placement and wrap behaviour, one-chip-per-field, chip order (Status, Priority, Assignee, Due date, Labels), the four chip segments, the two operator strings, per-field value rendering, the three-icon preview cap, X-clears-the-field semantics, and the **Clear all filters** menu item. Every one of these is a visual property of the rendered UI. None of them is an internal identifier, endpoint, query parameter, header, flag, file path, component name, environment variable, or credential.

Specific checks:

- **No non-public surface.** No URL, route, endpoint path, or parameter name appears in the added lines. No `import`, no code fence, no inline code span naming an internal symbol.
- **No internal component or file names.** The implementation lives in `apps/web/src/components/board/board-toolbar.tsx`; the prose never names it, nor `useTaskFiltersWithLabelsSupport`, nor any store or hook.
- **User-visible strings only.** The two operator strings the text quotes resolve to public i18n values — `i18n/en-US.json` `"isAnyOf": "is any of"` and `"includeAnyOf": "include any of"`. The count form is `selectedCount: "{{count}} selected"` and `clearAllFilters: "Clear all filters"`. Documenting a string the user reads on screen discloses nothing.
- **No search-space narrowing.** Nothing in the text tells an attacker where to send a request or what to send. Filtering is applied client-side over tasks the user has already been served; the prose adds no server-side detail to probe.

### The label-grouping sentence, specifically

The sentence under review:

> "A single entry in the Labels list covers every workspace label that shares its name and color, so selecting one entry can produce a count higher than one."

This is safe, and the reason is that the grouping is *intra*-workspace by construction, at three independent layers:

1. **Data fetch is workspace-scoped and access-gated.** The list comes from `useGetLabelsByWorkspace`, backed by `GET /label/workspace/:workspaceId` (`apps/api/src/label/index.ts`), which sits behind `workspaceAccess.fromParam()`. The controller is `getLabelsByWorkspaceId`, a single query with `where(eq(labelTable.workspaceId, workspaceId))`. A caller can only ever receive labels belonging to one workspace they already have access to.
2. **Grouping is a client-side dedupe over that already-scoped array.** `board-toolbar.tsx:185-198` reduces `WorkspaceLabel[]` to unique `(name, color)` pairs and `toggleLabelGroup` (`:233-242`) selects the matching ids from that same array. The grouping key is `name === name && color === color` — it never reaches across the array it was given, and the array never contains another workspace's rows.
3. **The disclosed fact is the user's own data shape.** The count a reader sees ("3 selected" for one clicked entry) is derived entirely from labels in their own workspace. It tells them nothing about the existence, names, or cardinality of labels in any workspace they cannot see.

The word "workspace" in the sentence is in fact the *protective* reading: it scopes the claim rather than widening it. Documenting the grouping rule is a usability necessity — without it, a user who selects one entry and sees "3 selected" would reasonably suspect a bug. There is no authorization inference available from it.

## 2. Authorization surface

**No finding.** The added text describes no capability that has a permission precondition, so the absence of a permissions note is correct rather than an omission.

The comparison holds up but does not transfer. `apps/docs/core/functional/manage-workspace-labels.mdx` carries an explicit permissions note — "Managing workspace labels requires the **Manage settings** permission" — because the page documents create/edit/delete of workspace labels, which are genuine mutations gated by `requireWorkspacePermission` on the API side. Stating the precondition there prevents a reader from concluding that missing controls are a defect.

Board filtering has no equivalent precondition:

- **It is not a mutation.** The five filters are client-side predicates over tasks already delivered to the browser (`apps/web/src/hooks/use-task-filters-with-labels-support.ts`). Selecting, clearing, or grouping filter values writes nothing to the server and changes no shared state.
- **There is no permission gate to document.** `board-toolbar.tsx` contains no permission check, no capability guard — grep returns nothing. The only gate is authentication plus workspace membership, enforced upstream: the board route sits under `_authenticated`, and the label list behind `workspaceAccess`.
- **Therefore the text cannot mislead.** It promises no control that some readers will not see. Every reader who can reach the board can use every behaviour described. Adding a permissions section here would be inaccurate — it would imply a role distinction that does not exist and invite users to ask an admin for a permission that is not defined.

The underlying visibility guarantee is unaffected either way: a filter cannot reveal a task the API did not already return to that user.

## 3. Supply chain / build

**No finding.** Confirmed from the diff and the worktree.

- **No dependency change.** No `package.json`, no `pnpm-lock.yaml` in the changed set.
- **No script or build step.** No shell, CI, Docker, or Helm file touched. `apps/docs/docs.json` (the docs navigation manifest, and an off-limits path) is unchanged.
- **No MDX import, component, or JSX.** All 18 added lines are prose, a five-item bullet list, and `**bold**` emphasis. There is no `import`/`export` statement, no `<Component>` tag, no code fence, and no URL of any kind — so no new remote fetch, no new render-time evaluation, and no new MDX compilation surface. The page's build behaviour is byte-for-byte the same class of content it already contained.
- **Content integrity.** The file on disk hashes to `sha256:253b0554f23cf4555c4e521f98d8229dc162393f5f07fa633dfe4789214c0f72`, exactly matching `sha_after` for the second write in `provenance.json`. Nothing modified it after the run.

**Files outside the allowlist — one note, not a violation of the authoring phase.** `git status` shows two additional modified tracked files: `.gitignore` (+6: ignore entries for `.sdlc/**/*.db`, `.sdlc/local/`, `.hook-logs/`, `.claude/settings.local.json`) and `biome.json` (+1: `"!**/.sdlc"` in the ignore list). Neither is on the run's allowlist. Both were written at **08:42:12**, alongside `write-contract.json` itself — that is plugin setup, before the first packet write at **08:56:37** and the refinement at **09:03:18**. `provenance.json` correctly records only the single mdx path as touched by the run's authoring phase.

Assessed on content: both edits are tooling hygiene, both are additive, both are inspectable in two lines, and both are arguably desirable (they keep run artifacts out of git and out of the formatter). Neither is on the `off_limits` list. The real observation is that the write contract's allowlist governs packet writes but not the setup step that creates the contract, so setup-phase repo edits land unrecorded. Worth knowing before a commit; not a security defect in this diff.

## 4. Write-contract and provenance integrity

Both observations are real. Neither caused harm in this run. Assessed for actual blast radius:

### (a) PreToolUse hook cannot block

The deny path exits 1; PreToolUse only treats exit 2 as a block. So the hook was advisory for the entire run — a logging shim, not a control. Enforcement rested on orchestrator discipline plus the packet `artifact_path` allowlist check.

**Blast radius in this run: zero realized, and bounded even in the failure case.** The realized outcome is verifiable: `provenance.json` records exactly one path, `git status` shows exactly one changed tracked file inside the authoring window, and its hash matches. Had discipline failed, the containment properties still hold — the repo was clean at `5d1fc910`, the file is git-tracked, and the intent was docs-only with no execution surface, so any stray write would be visible in `git status` and reversible with `git checkout`. The correct characterization is: **the control was absent and the outcome was correct anyway**, which is a latent risk for a future run with a broader blast radius (a code intent touching `apps/api/src` or a migration), not a defect in this one. Fixing the exit code is cheap and should happen before the plugin is used on a non-docs intent.

### (b) Double write and the stale `--before` backup

The file was written twice — `tp_docs_001` at 08:56:37, then the post-review refinement `tp_docs_002` at 09:03:18. The second write's provenance recorded `backup=yes`, but the backup captured the *post-first-write* content, not pristine HEAD content. `sha_before` on the second record confirms this: it is the first write's `sha_after`, not the pristine hash.

**Blast radius in this run: zero.** Three independent facts collapse it:

1. The file is **git-tracked and was clean at `5d1fc910`**, so the pristine content is recoverable from git regardless of what the backup holds. The backup is redundant for tracked-clean files; it only matters for untracked or dirty ones.
2. The orchestrator **reverted to HEAD before applying the refinement**, so the final on-disk state is HEAD plus one clean application of the refined content — not a stack of two writes. The 18-line diff is the whole delta, and `sha_after` matches disk.
3. `sha_before` on record 2 is recorded honestly, so the chain is auditable even though the backup file is misleading. Provenance is not corrupt; the backup artifact is just useless.

The genuine risk is narrower than it looks: if a future run's second write targets an **untracked or already-dirty** file, `backup=yes` would be a false assurance and `/mmo:revert` would restore the wrong state. Two candidate hardenings, both out of scope here: skip the backup when a prior write in the same run already backed the path up, or key the backup to the run's pre-run state rather than the per-write state.

## 5. Verdict

**pass-with-notes.**

The documentation change itself has **no security impact**, established by these checks:

| Check | Result |
|---|---|
| Added lines contain internal identifiers, paths, endpoints, or credentials | No — prose only, no code spans, no URLs |
| Label-grouping text implies cross-workspace visibility | No — grouping is a client-side dedupe over a workspace-scoped, `workspaceAccess`-gated fetch |
| Capability described without its permission precondition | No — board filtering is a client-side view predicate with no permission gate to state |
| Dependency, script, build step, MDX import, component, or JSX added | No — none in the diff |
| File outside the packet allowlist written during authoring | No — provenance and `git status` agree on one path; hash matches |
| Final on-disk content matches what the run recorded | Yes — `sha256:253b0554…` |

The notes are process, not content:

1. The PreToolUse write-contract hook was non-blocking for the whole run (exit 1 vs. required exit 2). No realized impact; fix before running a non-docs intent.
2. The second write's backup captured post-first-write content while reporting `backup=yes`. No realized impact — the file is tracked and was clean at HEAD, and the orchestrator reverted before refining. Would matter for an untracked or dirty target.
3. `.gitignore` and `biome.json` were modified at setup time (08:42), outside both the allowlist and the authoring window, and are therefore absent from `provenance.json`. Both edits are additive tooling hygiene and benign; flagged so they are a deliberate decision at commit time rather than an accidental inclusion.

No finding was invented to pad this review. The three notes above are the complete set.

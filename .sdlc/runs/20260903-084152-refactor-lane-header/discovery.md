# Discovery — 20260903-084152-refactor-lane-header

First-time discovery at Git `5d1fc9104337786c3ef295ec0dc31656df371d8d` on branch `test-refactor-codex`.

## Git state

- Worktree is dirty only from generated `.agents/skills/` links and `.sdlc/` setup/run metadata.
- Remote: `origin` → `https://github.com/tl-ai-labs/kaneo.git`.

## Detected stacks

- Node.js/TypeScript pnpm monorepo using React, Vite, Hono, and Turborepo.
- Affected package: `@kaneo/web`.
- Proposed test command: `pnpm --filter @kaneo/web test`.

## Relevant source

- No `Lane` or `LaneHeader` identifiers exist under `apps/web/src`; Kaneo calls this concept `Column`.
- `apps/web/src/components/kanban-board/column/index.tsx` already composes `ColumnHeader` and retains container/dropzone state.
- `apps/web/src/components/kanban-board/column/column-header.tsx` already owns header rendering and actions.

## Detected AI/agent setup

- `AGENTS.md`, `CLAUDE.md`, `.agents/skills/`, `.claude/`, `.codex/`, and `.cursor/rules/` are present and off-limits by default.

## Coexistence risks

- Cursor rules are present and remain untouched.
- `.sdlc/` is not covered by `.gitignore`, so run artifacts are visible to `git add -A`.

## Repo-state risks

- No Git submodules or Git-LFS patterns detected.
- `SECURITY.md` is a regulated-repository signal requiring policy/scope confirmation at Gate 0.

## Proposed off-limits

- Environment files, AI configuration, generated/build directories, dependencies, `.sdlc/`, and `.git/`.

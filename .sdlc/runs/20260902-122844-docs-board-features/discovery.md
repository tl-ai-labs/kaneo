# Discovery — 20260902-122844-docs-board-features

## Git state

Branch `test/codex-plugin` at `5d1fc9104337786c3ef295ec0dc31656df371d8d`. The working tree is heavily dirty (1,546 changed or untracked paths), all treated as pre-existing user work.

## Detected stacks

Node.js/TypeScript pnpm monorepo using Turborepo, React/Vite for `apps/web`, and Hono for `apps/api`. Proposed test command: `pnpm test`.

## Documentation

The root `README.md` is the requested target. It currently moves from “Why Kaneo?” directly to “Sponsors”; a “Board features” section can be added between them without changing other docs.

## Detected AI/agent setup

`AGENTS.md`, `CLAUDE.md`, `.agents/skills/`, `.claude/`, `.codex/`, and `.cursor/rules/` are present and off-limits by default.

## Environment metadata

Environment files were detected by name. No environment values were read or recorded.

## Repository features

No submodules or Git LFS patterns were detected. Docker/Compose and GitHub Actions are present.

## Regulated-repo signals

`SECURITY.md` is present; Gate 0 must surface the policy/off-limits confirmation.

## Coexistence risks

- You have Cursor rules at `.cursor/rules/`. The pipeline will never touch them, but if Cursor's auto-lint runs on save, changes made here may trigger it.
- The working tree already has extensive changes; this run must touch only the explicitly approved README.
- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts there will be untracked but visible to `git add -A`.

## Proposed off-limits

All detected AI configuration, environment files, generated/build directories, `.git/`, and every product file except `README.md`.

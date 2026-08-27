# SDLC state — kaneo

Project fingerprint (last updated 2026-08-27):

- **Stack:** TypeScript/Node ESM pnpm monorepo (pnpm 10.32.1, Node >=20.19), Turborepo, 9 workspace members.
- **Default policy:** `opus-plus-flash-v37` (`.sdlc/project.json`)
- **Verification:** `pnpm --filter @kaneo/web test` · `pnpm --filter @kaneo/web typecheck` · `pnpm exec biome ci <changed paths>`
  Never root `pnpm test` (turbo `dependsOn: ["^build"]`, `cache: false`) or root `pnpm lint` (Biome `--write`, rewrites unrelated files).
- **Baseline:** `.sdlc/baseline/current.json`

## Ledger

[ledger.md](./ledger.md) · [ledger.json](./ledger.json)

## Reusable briefs

- [`briefs/refactor-public-column-header.md`](./briefs/refactor-public-column-header.md) — extract
  `PublicColumnHeader` from the public kanban column. Frozen Gate 0 answers in
  [`gate0-answers.json`](./gate0-answers.json). Three further runs planned under different
  policies; reuse with:

  ```
  /mmo:pass --mode brownfield --intent refactor \
    --brief .sdlc/briefs/refactor-public-column-header.md \
    --policy <policy>
  ```

## Open issues

1. **`task_type` routing gap** — `opus-plus-flash-v37`'s codegen rule matches an explicit
   `task_type` allowlist (`react_component` et al.) that omits every brownfield primitive
   (`new_file_add`, `existing_file_edit`, `patch_apply`, `refactor_extract`). Packets typed as the
   pipeline's brownfield table specifies fall through to `default: opus` and run mechanical codegen
   at premium rates. **Silent** — the run succeeds and telemetry flags nothing. Workaround recorded
   in `gate0-answers.json.known_policy_gap`; the real fix belongs in the policy YAML.
2. **Write contract unproven on this repo** — run 1 never triggered a refusal, so the strict
   PreToolUse hook's block path has not executed here. `.hook-logs/hook.jsonl` holds only
   `mcp_tool_postuse` events. Treat "only allowlisted files changed" as evidenced by `git status`,
   not by the hook.

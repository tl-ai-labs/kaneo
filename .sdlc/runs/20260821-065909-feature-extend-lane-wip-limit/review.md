# Senior review — column-wip-limit

**Verdict: APPROVE WITH NITS · 0 blockers**

## 1. Correctness

The null-vs-undefined clear path is right end to end:
- Validator: `v.optional(v.nullable(...))` accepts `undefined | null | int[1..2^31-1]`.
- Create controller normalizes `wipLimit ?? null`, so both absent and explicit `null` persist as `null`.
- Update controller's `data.wipLimit !== undefined && { wipLimit: data.wipLimit }` correctly distinguishes "not sent" (no-op) from `null` (clear).
- Editor `onBlur` maps `""` -> `null` and no-ops when unchanged, and reverts the DOM value on client-side invalid input before firing the mutation.

Int4 boundary is exactly right: max 2147483647, min 1 in both the validator and the editor guard. `Number.isInteger` in the editor rejects `2.5`, and `9007199254740992` / `Number.MAX_VALUE` are rejected by the validator's `maxValue`. `Number("0x10")` would sneak past the client guard as 16, but that's within range and harmless — Nit at worst.

- **Nit — column-editor.tsx**: on a failed `updateColumn`, the input keeps the typed value while the toast reports failure, so the field silently disagrees with server state. This matches the sibling name input's pattern (also unrecovered on error), so it's arguably deliberate. Fix if you want stricter parity: in the `catch`, reset the input node to `col.wipLimit ?? ""` and refetch.
- **Nit — column-editor.tsx**: no `Escape` handler to abandon an in-progress edit. The sibling name input has the same gap, so consistent.

## 2. Follow-through surfaces

- **API OpenAPI (`describeRoute`) — Minor**: unchanged for both routes. They already use `resolver(v.any())`, so there is no schema drift, but the human-readable description no longer matches the accepted body. Add a one-line mention of `wipLimit`.
- **Board projection (`get-tasks.ts`) — Correct**: `wipLimit` added to the hand-written whitelist. (The pre-existing `color` omission is unrelated and out of scope.)
- **Web fetchers, mutation hooks, invalidation — Correct**: `use-update-column` still invalidates `["columns", projectId]` and `["tasks", projectId]`; both are the surfaces that read `wipLimit`.
- **`useGetColumns` shape — Correct**: unqualified row select propagates the new column automatically.
- **Events / WebSocket / Redis fan-out — Verify**: the diff adds no `publishEvent`. If `updateColumn` already publishes, other clients see the change on refetch; if not, teammates' WIP-limit edits won't appear until a manual refresh. Pre-existing behavior either way; belongs in its own ticket if it is a gap.
- **Schema, migration, cascades, indexes — Correct**: nullable `integer`, purely additive generated migration. No index warranted for an advisory display field; no cascade implications.
- **Permissions — Correct**: reuses `project:update`; no new vocabulary.
- **i18n — Correct scope**: en-US only per Gate 2. Content nit in §5.
- **MCP, API keys, webhooks, Docker, Helm, docs — Correctly out of scope**: no MCP tool exposes column config; storage-only field, so containers and charts don't move.
- **Repaired inline fixtures** in the two web test files are the mechanical typecheck follow-through and are appropriate.

## 3. Local-idiom consistency

- Controller `wipLimit ?? null` vs the neighbouring `icon: icon || null` is a deliberate correctness choice (`??` matches nullable-int semantics). Fine.
- Conditional spread in `update-column` mirrors the other fields.
- Hook/fetcher inline data types extended in place — matches the file's existing shape.
- Column-header still reads `column.tasks.length` in three unrelated places (archive condition, toast, `ArchiveTasksModal` prop). Correct — not WIP-limit concerns.

## 4. Test quality

**API unit tests (DB stubbed)** — the honest read: they prove *validator* behavior (all 7 reject cases, and the shape of accept cases) and that the handler doesn't throw before hitting the stub. Because the DB module is fully mocked, `expect(res.status).not.toBe(400)` **cannot** prove `wipLimit` was forwarded to the controller — a controller that dropped the field would still pass. That gap is covered by the integration tests (POST 5 -> payload 5 -> row 5; PUT null -> row null; PUT 0 -> row still 7; GET -> board carries `wipLimit: 4`), which is the right layering. The unit tests are load-bearing for boundary rejection only, and that is fine given the integration tests exist.

- **Minor — tests/api/column/*.test.ts**: strengthen the accept branch. Rather than `not.toBe(400)`, have the stub's `returning()` echo the inserted row and assert the body contains the value. Closes the "handler dropped the field" hole without a real DB.
- **Integration suite — Good**: create-with-limit, create-without, explicit-null clear, invalid-0 rejection with no-mutation proof, board projection, and the advisory over-limit case (cap 1, 2 tasks).
- **Column-header tests — Good**: null / under / at-limit / over-limit; the 5/5 boundary case explicitly asserts "not over", locking the settled semantic.
- **Column-editor tests — Good**: happy path, clear path, all three client-side rejections, and no-op-on-unchanged-blur.

## 5. Accessibility and i18n

- **Minor — i18next `{{count}}` pluralization**: i18next treats `count` as a magic key and looks for `_one` / `_other` variants. With only a base key, `t("tasks:kanban.taskCountAria", { count: 1 })` renders `"1 tasks"` — grammatically wrong for screen readers. Add sibling keys:
  ```json
  "taskCountAria_one": "{{count}} task",
  "taskCountAria_other": "{{count}} tasks",
  "wipLimitAria_one": "{{count}} of {{limit}} task (WIP limit)",
  "wipLimitAria_other": "{{count}} of {{limit}} tasks (WIP limit)"
  ```
- **Accessibility — Good**: the badge exposes both `aria-label` and `title`; `AlertTriangle` is `aria-hidden` since the label already conveys "over WIP limit". The editor input's `aria-label` interpolates the column name, so multi-column pages stay distinguishable.
- **Nit — column-editor**: the visible "WIP limit" `<span>` is not programmatically associated with the `<input>` (no `<label htmlFor>` / `aria-labelledby`). The `aria-label` covers screen readers; wrap in `<label>` if native click-to-focus is wanted.

## Settled decisions (not re-litigated)

Advisory-only, `count > limit` strictly, at-limit neutral, config in column-editor with column-header display-only, en-US-only i18n, generated migration, no new permission vocabulary — all respected by the diff.

## Verdict

No blockers. The design lands cleanly across schema, API, and web with proportionate integration coverage. The nits are worth doing — particularly the i18next plural keys and the accept-branch assertion — but none are gating.

**APPROVE WITH NITS**

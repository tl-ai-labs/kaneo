# Run summary — advisory per-column WIP limit

- **Run:** `20260821-065909-feature-extend-lane-wip-limit` · brownfield · intent `feature-extend`
- **Policy:** `opus-only-v5` — single tier, `claude-opus-5` via the `claude-cli` adapter, `auth_mode: vendor`
- **Base:** `5d1fc910` on `feature-extend-1/opus-only` · **no commit, no push, no PR** — run stops at the working tree
- **Cost: $3.8845** across **14 dispatches** (cap $50) · 210,763 input + 442,099 cached + 60,308 output tokens

## Cost by phase

| phase | dispatches | input | cached | output | cost |
|---|---:|---:|---:|---:|---:|
| requirements_analysis | 1 | 13,074 | 30,221 | 3,654 | $0.2406 |
| change_plan | 1 | 19,061 | 30,221 | 8,953 | $0.4374 |
| plan_task_packets | 1 | 15,400 | 30,221 | 7,549 | $0.3630 |
| codegen | 7 | 93,563 | 241,300 | 9,655 | $1.3122 |
| tests | 2 | 35,346 | 54,978 | 17,410 | $0.8254 |
| senior_code_review | 1 | 21,500 | 24,424 | 8,217 | $0.4377 |
| security_review | 1 | 12,819 | 30,734 | 4,870 | $0.2683 |
| **TOTAL** | **14** | **210,763** | **442,099** | **60,308** | **$3.8845** |

Every dispatch carries roughly 24k–71k tokens of cached process-spawn context, an artifact of the
`claude-cli` transport: each call spawns a fresh `claude -p`. That overhead is why the run was
deliberately kept to 14 dispatches rather than one per file.

## Verification — all four confirmed gates green

| command | result |
|---|---|
| `pnpm --filter @kaneo/api test` | PASS — 60 files, 398 tests |
| `pnpm --filter @kaneo/web test` | PASS — 38 files, 126 tests |
| `pnpm typecheck` | PASS — 6/6 tasks |
| `pnpm --filter @kaneo/api test:integration` | PASS — 30 files, 187 tests (live PostgreSQL, port 55432) |

## Gates

| gate | outcome |
|---|---|
| 1 — requirements | approved after 1 revision: explicit `v.integer()` + int4 upper bound `2147483647`, exact accept/reject set, AC-9 and AC-10 added |
| 2 — architecture | approved; over-cap threshold fixed at strictly `count > limit` |
| 3 — security | approved; both review fixes applied before the final report |
| 4 — final acceptance | pending |

## Reviews

- **Senior:** APPROVE WITH NITS, 0 blockers.
- **Security:** PASS, highest severity Informational.

## What shipped

22 files: 15 modified, 7 new (5 test files, plus the generated migration and its meta snapshot).

- **Schema/migration** — `wipLimit: integer("wip_limit")` on `columnTable`; generated (never hand-authored) `0043_next_killraven.sql`: `ALTER TABLE "column" ADD COLUMN "wip_limit" integer;` — nullable, no default, no backfill, catalog-only on populated tables.
- **API** — `v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647))))` on **both** create and update; `wipLimit ?? null` on insert; conditional spread on update so `undefined` is a no-op and explicit `null` clears. OpenAPI descriptions updated on both routes.
- **Projection** — `wipLimit: column.wipLimit` added to the hand-written board whitelist in `get-tasks.ts`.
- **Web** — field threaded through both fetchers and both mutation hooks; configuration input in `column-editor.tsx` (min/max/step, blur-commit, empty clears, out-of-range reverts without firing a mutation); display-only badge in `column-header.tsx` rendering `{count} / {limit}` with a destructive tint **plus** an `AlertTriangle` icon and `title`/`aria-label` — deliberately not colour-only.
- **i18n** — 14 en-US keys, using the repo's established `_one`/`_other` convention with no base key.

## Why the plural fix took the shape it did

Two reasoning steps drove this, and both are worth keeping for a future reader:

1. **`newCount_one` and `newCount_other` are identical strings in this repo.** That is the local
   precedent for "define both variants even when the wording does not vary", and it resolved what
   would otherwise have been a judgement call about the three `wipLimit*` keys.
2. **In `wipLimitAria` the noun "tasks" agrees with `limit`, not `count` — but i18next selects the
   plural form on `count`.** So the naive fix (making `_one` singular everywhere) would have
   rendered **"1 of 5 task"** for a column holding one task against a limit of five: a *new* bug
   introduced by a fix for a bug. Following the `newCount` precedent — both variants present,
   identical text — is correct precisely because it decouples the wording from i18next's choice.
   Only `taskCountAria`, whose noun genuinely follows `count`, gets differing singular and plural
   forms.

A third point made the test design non-obvious: **the component suite mocks `react-i18next` so `t`
echoes the key**, which means a plural bug is structurally undetectable there — every assertion
matches a key string, never rendered English. The regression test therefore drives a real i18next
instance (`createInstance()` from `i18next`, which is *not* mocked) against the real `en-US`
bundle from `@i18n/resources`, and asserts `"1 task"`, `"4 tasks"`, `"0 tasks"`, plus that the
limit strings stay stable at `count: 1`.

## Outstanding items and follow-ups

1. **`pnpm i18n:check` fails — this run did not cause it.** It was already failing at baseline: `common:error.*` (15 keys) is missing from `de-DE`, a namespace this diff never touches. Our new keys do add to the missing list across the 16 non-en-US locales, which is *expected* — translating them is an explicit non-goal and the write contract forbids hand-filling other locale files. `i18n:check` is not part of the confirmed four-command gate.
2. **No event or activity row is written for a `wipLimit` mutation.** The security reviewer judged this acceptable **only because the field is advisory**. If `wipLimit` is ever promoted to a hard block, audit/event coverage must ship in the same change. This is a condition, not a clean pass.
3. **Benchmark hazard — shared integration database caused cross-arm contamination.** The first integration run failed 177 tests with `column "wip_limit" of relation "column" already exists`. Root cause: migration row 44 (hash `4e298c82…`) in `kaneo_test` was the **flash arm's** `0043_known_night_thrasher.sql` (run `20260820-123148`). Both arms generated an `0043` with different content, so Drizzle saw ours as unapplied and re-ran the `ADD COLUMN`. Resolved by dropping the database and migrating from zero. **Future arms need their own database, or a drop between arms.**
4. **`/mmo:revert` needs manual help for two files.** `apps/api/drizzle/0043_next_killraven.sql` and `apps/api/drizzle/meta/0043_snapshot.json` were created by `db:generate` *after* provenance init, so they carry no `sha_before` and revert cannot restore them automatically — delete them by hand. `meta/_journal.json` is tracked and git-restorable.
5. **API unit tests are layered, not tautological — but cannot prove field forwarding.** With the database module stubbed, `expect(status).not.toBe(400)` would still pass if a controller dropped `wipLimit`. That is covered for real by the integration tests (POST 5 → row 5; PUT null → row null; PUT 0 → row unchanged at 7). Logged as a follow-up per Gate 3; the fix is to have the stub's `returning()` echo the inserted row.
6. **Realtime propagation unverified.** This change publishes no event. If column mutations already publish, teammates see WIP-limit changes on refetch; if not, they will not until a manual refresh. Pre-existing behavior either way, worth its own ticket.

## Notable finding — the "silent failure" wasn't silent

The change plan flagged `get-tasks.ts`'s hand-written column projection as the single highest-risk
line, on the theory that omitting `wipLimit` there would fail silently in types as well as at
runtime (the sibling field `color` is already dropped there unnoticed). In practice the opposite
happened: because `ProjectWithTasks` is **inferred** from that endpoint via `InferResponseType`,
adding the field immediately broke `pnpm typecheck` at all three call sites that construct a column
literal — two pre-existing web test fixtures. The inferred client type caught the change and forced
the fixtures to be updated. That is NFR-4 working exactly as intended, and a genuine positive
finding about this codebase's type safety.

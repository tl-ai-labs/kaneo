### E5–E8 — the eight component call sites

Purely mechanical: replace the object literal with `withTaskId(...)`, add
`import { withTaskId } from "@/lib/search-params";` in the correct alphabetical position (Biome's
`organizeImports` assist is on). No other change. Per FR-18 these components are shared with other
routes; the updater strictly widens what is preserved, so no other route regresses — verified by the
full web test run and typecheck, not assumed.

**The one typecheck risk in this change.** TanStack types `search` as
`(prev: TFromSearch) => TToSearch`. A generic updater may or may not infer cleanly at sites that call
`useNavigate()` without `from` and navigate with `to: "."`. Escalation ladder, in order:
(i) ship `withTaskId` as written; (ii) if inference fails, narrow the returned updater's parameter to
`(prev: Record<string, unknown>)`; (iii) if it still fails at a specific site, inline
`search: (prev) => ({ ...prev, taskId: … })` at that site only and record it in the final report as a
gap in the shared-helper proof. Run `pnpm --filter @kaneo/web typecheck` immediately after E5 —
before E6–E8 — so the ladder is walked once, not four times.
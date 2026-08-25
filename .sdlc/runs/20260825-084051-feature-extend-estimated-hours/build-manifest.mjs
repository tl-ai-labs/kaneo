import fs from "node:fs";
import { execFileSync } from "node:child_process";

const RUN_ID = "20260825-084051-feature-extend-estimated-hours";
const RUN = `.sdlc/runs/${RUN_ID}`;

const events = fs
  .readFileSync(`${RUN}/telemetry.jsonl`, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

const sorted = [...events].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

const round = (n) => Math.round(n * 10000) / 10000;

const byPhase = {};
const byProvenance = { vendor: { events: 0, cost_usd: 0 }, estimated: { events: 0, cost_usd: 0 } };
const byModel = {};

for (const e of events) {
  const cost = e.cost_usd || 0;
  const p = (byPhase[e.phase] ??= {
    events: 0,
    input_tokens: 0,
    input_tokens_cached: 0,
    output_tokens: 0,
    cost_usd: 0,
  });
  p.events++;
  p.input_tokens += e.input_tokens || 0;
  p.input_tokens_cached += e.input_tokens_cached || 0;
  p.output_tokens += e.output_tokens || 0;
  p.cost_usd = round(p.cost_usd + cost);

  const prov = e.provenance === "estimated" ? "estimated" : "vendor";
  byProvenance[prov].events++;
  byProvenance[prov].cost_usd = round(byProvenance[prov].cost_usd + cost);

  const m = (byModel[e.model] ??= { events: 0, cost_usd: 0 });
  m.events++;
  m.cost_usd = round(m.cost_usd + cost);
}

const total = round(events.reduce((a, e) => a + (e.cost_usd || 0), 0));
const changed = fs
  .readFileSync(`${RUN}/changed-files.txt`, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean);

const gitHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const gitBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
  encoding: "utf8",
}).trim();

const artifacts = fs
  .readdirSync(RUN)
  .filter((f) => fs.statSync(`${RUN}/${f}`).isFile())
  .sort();

const manifest = {
  schema_version: 1,
  run_id: RUN_ID,
  mode: "brownfield",
  intent: "feature-extend",
  policy: "opus-only-v5",
  auth_mode: "estimated",
  git: { branch: gitBranch, head: gitHead, base: "5d1fc910" },
  code_dir: "/home/sangeetha/projects/kaneo",
  output_dir: RUN,
  started_at: sorted[0]?.ts ?? null,
  finished_at: sorted.at(-1)?.ts ?? null,
  totals: {
    events: events.length,
    cost_usd: total,
    input_tokens: events.reduce((a, e) => a + (e.input_tokens || 0), 0),
    input_tokens_cached: events.reduce((a, e) => a + (e.input_tokens_cached || 0), 0),
    output_tokens: events.reduce((a, e) => a + (e.output_tokens || 0), 0),
  },
  by_provenance: byProvenance,
  by_phase: byPhase,
  by_model: byModel,
  hard_cost_cap_usd: 50,
  cap_headroom_usd: round(50 - total),
  files_changed: changed.length,
  changed_files: changed,
  artifacts,
  verification: {
    api_tests: { before: "58 files / 374 tests", after: "60 files / 384 tests", status: "pass" },
    web_tests: { before: "36 files / 112 tests", after: "39 files / 176 tests", status: "pass" },
    typecheck: { before: "6/6", after: "6/6", status: "pass" },
    biome_scoped: { scope: "44 changed files", result: "0 errors, 0 warnings", status: "pass" },
    biome_repo_wide: {
      status: "pre-existing red, NOT run and NOT attributable to this run",
    },
    i18n_check: {
      status: "byte-identical to pre-run baseline",
      pre_existing_missing_keys: 324,
      note: "324 pre-existing gaps neither fixed nor widened; run added no new missing key",
    },
    migration: {
      file: "apps/api/drizzle/0043_adorable_micromacro.sql",
      sql: 'ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;',
      applied_to_populated_table: true,
      pre_existing_rows_after: "all NULL",
      status: "pass",
    },
    live_persistence_check: { checks: 12, passed: 12, database: "kaneo_opus_only" },
  },
  gates: {
    gate_0: { title: "Discovery Confirmation", status: "approved" },
    gate_1: { title: "Requirements Approval", status: "approved", decisions: 5 },
    gate_2: { title: "Architecture Approval", status: "approved", orchestrator_corrections: 3 },
    gate_3: { title: "Security Review", status: "approved" },
    gate_4: { title: "Final Acceptance", status: "pending" },
  },
  finalized: false,
  reviews: {
    senior: { verdict: "approve with nits", blocking: 0, nits: 10, nits_actioned: 9 },
    security: { verdict: "pass", blocking: 0, observations: 3, pre_existing_noted: 2 },
  },
  process_outcomes: [
    "The minutes<->hours round-trip identity parseEstimateHours(toEstimateHoursInput(m)) === m was brute-forced by the senior reviewer over every integer in 1..525600: 0 failures. That is a proof over the whole domain, not an 11-value sample.",
    "N-6 was a genuine defect no other arm found: Number(\"2,5\") is NaN, so users in 9 of the 17 shipped locales typing their own decimal separator were rejected with a message that did not explain why. Fixed by normalising the first comma; \"1,2,3\" still rejects.",
    "The senior reviewer's own N-1 fix was incomplete - swapping the label moved the dead key from noEstimate to estimate rather than removing it. Caught and corrected: the feature ships 9 keys, all live, instead of 10 with one dead.",
    "The migration's _journal.json diff was 7 insertions / 0 deletions on the first attempt, with no correction cycle.",
    "The authorization analysis bounds the untested risk rather than asserting it: intra-workspace escalation only, not cross-tenant, and the chain is self-defending against transposition because requireWorkspacePermission throws 500 when workspaceId is unset.",
  ],
  follow_ups: [
    {
      severity: "high",
      title: "GET /task/export/:projectId has no requireWorkspacePermission",
      detail: "The export route carries workspaceAccess.fromProject(\"projectId\") and no requireWorkspacePermission, so any workspace member can export every task in a project. PRE-EXISTING - it predates this run. This run widens that payload by one field (estimatedMinutes) without changing who can call it. Deliberately not fixed here: mixing an unrelated security fix into a benchmark arm would confound the comparison.",
      owner: "separate ticket",
    },
    {
      severity: "low",
      title: "taskSchema / search response drift (S-2)",
      detail: "search/index.ts documents its response as v.array(taskSchema) while global-search.ts projects an explicit field list omitting estimatedMinutes. Documentation-only (resolver() has no runtime effect). Pre-existing for position, number and description; this run widens it by one field. Recorded, not fixed.",
      owner: "separate ticket",
    },
    {
      severity: "info",
      title: "pnpm i18n:check is red at baseline",
      detail: "324 pre-existing missing keys across all 16 non-default locales, in two clusters: common:error.* absent from vi-VN/zh-CN, and i18next plural-suffix keys the checker demands without regard for per-locale CLDR plural categories. Neither caused nor fixed by this run.",
      owner: "separate ticket",
    },
    {
      severity: "info",
      title: "2 high transitive advisories under better-auth",
      detail: "pnpm audit --prod reports GHSA-2v37-7h3g-55p8 and GHSA-ggr8-5vv4-36mx, both dev-tooling chains. package.json and pnpm-lock.yaml are untouched by this run.",
      owner: "separate ticket",
    },
  ],
  known_gaps: [
    "No executed test covers the middleware chain on PUT /task/estimate/:id. A regression deleting requireWorkspacePermission({ task: ['update'] }) from that route would pass typecheck, scoped biome, API tests and web tests alike. Deliberate: Gate 1 OQ-4 chose benchmark consistency over widening the allowlist to tests/api-integration/**, even though this branch's fresh database could have run a real integration test.",
    "The lane rollup is not realtime for other viewers: no publishEvent is emitted (Gate 1 OQ-5), so a teammate's board shows the old lane total until their next refetch. This diverges from due-date, priority, title and assignee, which all publish.",
    "The 16 non-default locales carry English placeholder strings for the 10 new keys (Gate 1 OQ-3).",
  ],
};

fs.writeFileSync(`${RUN}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${RUN}/manifest.json`);
console.log(`  events ${events.length} | cost $${total} | cap headroom $${manifest.cap_headroom_usd}`);
console.log(`  files changed ${changed.length} | artifacts ${artifacts.length}`);

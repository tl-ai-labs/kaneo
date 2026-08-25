import fs from "node:fs";
const RUN = ".sdlc/runs/20260825-084051-feature-extend-estimated-hours";
const PASS = "20260825-084051-feature-extend-estimated-hours";
const PLAN = `${RUN}/change_plan.md`;
const planLines = fs.readFileSync(PLAN, "utf8").split("\n");
const sec = (a, b, reason) => ({ path: PLAN, reason, content: planLines.slice(a - 1, b).join("\n") });
const src = (p, a, b, reason) => ({ path: p, reason, content: fs.readFileSync(p, "utf8").split("\n").slice(a - 1, b).join("\n") });
const whole = (p, reason) => ({ path: p, reason, content: fs.readFileSync(p, "utf8") });

const RULES = `HARD RULES (brownfield run on an existing repo):
- Follow the change_plan section given to you EXACTLY. It is authoritative and human-approved. Do not redesign.
- Match surrounding repo style precisely: tabs vs spaces, quote style, import ordering, trailing commas. Biome formats this repo.
- Repo conventions (AGENTS.md): fetchers under apps/web/src/fetchers/, server state in TanStack Query hooks, typed client from @kaneo/libs (never a parallel untyped request layer), ALL user-facing copy via static i18n keys (never a hardcoded string), prefer inferred types and 'type' over 'interface'. Comments explain constraints, not narrate code.
- Emit ONLY what the output schema asks for. No prose, no markdown fences inside string fields.
- Never invent an import that does not exist in this repo. Only use imports shown in the provided slices.`;

const fileOut = { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] };
const filesOut = { type: "object", properties: { files: { type: "array", items: fileOut } }, required: ["files"] };
const editsOut = { type: "object", properties: { edits: { type: "array", items: { type: "object", properties: { path: { type: "string" }, anchor: { type: "string", description: "exact unique existing text to insert after" }, insert_after: { type: "string", description: "exact new text, correctly indented" } }, required: ["path", "anchor", "insert_after"] } } }, required: ["edits"] };

const P = (id, phase, task_type, module, artifact_path, instruction, inputs, outputSchema, acceptance, maxOut) => ({
  id, phase, task_type, module, pass_id: PASS, intent: "feature-extend", artifact_path,
  instruction: `${instruction}\n\n${RULES}`, inputs, outputSchema, acceptance,
  budget: { maxInputTokens: 30000, maxOutputTokens: maxOut }, retry_count: 0,
});
const packets = JSON.parse(fs.readFileSync(`${RUN}/packets.part1.json`, "utf8"));

packets.push(P("tp_test_001_api_validator", "tests", "test_add", "api-task",
  "tests/api/task/estimated-minutes.test.ts",
  `Write the complete new test file tests/api/task/estimated-minutes.test.ts.
Runner: vitest, environment node, config apps/api/vitest.config.ts (include: ../../tests/api/**/*.test.ts). This suite is DB-FREE - it must import the module under test directly by relative path, exactly like the sibling test shown.
Import path from tests/api/task/ is "../../../apps/api/src/task/estimated-minutes".
Assert EVERY row of the accept/reject table, the two verbatim messages, that thrown errors are HTTPException with status 400, and that MAX_ESTIMATED_MINUTES === 525600.
Use describe/it/expect from vitest. To assert on the thrown status use a try/catch or expect(() => ...).toThrow() plus a separate check of the caught error's .status.`,
  [sec(311, 393, "the exact contract under test"), sec(854, 862, "what T1 must assert"),
   src("tests/api/utils/assert-public-destination.test.ts", 1, 20, "sibling DB-free test style and relative import depth")],
  fileOut,
  ["imports only vitest and the module under test", "no database import anywhere in the file",
   "covers 150, 1, 525600, null, undefined as accepted",
   "covers 0, -5, 90.5, NaN, Infinity, 525601, 999999999, 'abc', '150', true as rejected",
   "asserts thrown error status is 400", "asserts both verbatim messages"], 3000));

packets.push(P("tp_test_002_api_importexport", "tests", "test_add", "api-task",
  "tests/api/task/estimate-import-export.test.ts",
  `Write the complete new test file tests/api/task/estimate-import-export.test.ts.
DB-free vitest/node suite. Import coerceEstimatedMinutes from "../../../apps/api/src/task/estimated-minutes".
This test guards the round-trip boundary that Gate 1 OQ-1 brought into scope: the coercion step is the only place an estimate can be silently dropped between export and import.
Assert: coerceEstimatedMinutes never throws for any input; [150, null, 90] round-trip to [150, null, 90] with NO warnings; each of 0, -5, 90.5, "abc", 525601 coerces to null WITH a warning string; undefined and null produce no warning.
Also simulate a small export->import cycle: build a fake exported task array carrying [150, null, 90], map it through coerceEstimatedMinutes, and assert the values survive exactly.`,
  [sec(270, 310, "export/import payload delta"), sec(380, 393, "coerceEstimatedMinutes contract"), sec(863, 864, "what T2 must assert")],
  fileOut,
  ["no database import", "asserts the lossless [150, null, 90] cycle",
   "asserts a warning is present for every invalid value", "asserts no warning for null/undefined"], 2500));

packets.push(P("tp_cg_006_web_helpers", "codegen", "new_file_add", "web-task",
  "apps/web/src/components/task/estimate.ts",
  `Write the complete new helper module apps/web/src/components/task/estimate.ts.
It is pure and dependency-free: it must import NOTHING except a 'type Task' import if you need it for sumEstimatedMinutes' parameter type (import type Task from "@/types/task").
Placement note for a future reader: this lives under components/task/ rather than lib/ because apps/web/src/lib/** is outside this run's write contract. Add a brief comment saying so.
Export: MAX_ESTIMATE_MINUTES (= 525600, pinned to the API bound), formatEstimateHours, toEstimateHoursInput, parseEstimateHours, sumEstimatedMinutes.
Implement EVERY row of the tables in the provided sections exactly - these are asserted verbatim in tests. Pay attention to the defensive rows: formatEstimateHours returns null for 0, negative, NaN and Infinity so a stale client never paints a "0h" chip.`,
  [sec(682, 769, "formatting contract and rollup contract - every row is a test assertion"),
   sec(439, 470, "module spec"), sec(413, 438, "why this path")],
  fileOut,
  ["no runtime imports", "MAX_ESTIMATE_MINUTES === 525600",
   "formatEstimateHours(150) === '2.5h', (120) === '2h', (20) === '0.33h', (525600) === '8760h'",
   "formatEstimateHours returns null for null, undefined, 0, negative, NaN, Infinity",
   "parseEstimateHours('') === null and ('0') === 'invalid' and ('2.5') === 150",
   "sumEstimatedMinutes returns null when no task has an estimate, never 0",
   "a comment explains the contract-driven placement"], 3000));

packets.push(P("tp_test_003_web_helpers", "tests", "test_add", "web-task",
  "apps/web/src/components/task/estimate.test.ts",
  `Write the complete new test file apps/web/src/components/task/estimate.test.ts.
Runner: vitest, jsdom (apps/web/vitest.config.ts, include src/**/*.test.{ts,tsx}). No DOM is used here; import { describe, expect, it } from "vitest" and the helpers from "./estimate".
Assert EVERY row of the formatEstimateHours, toEstimateHoursInput and parseEstimateHours tables verbatim, the sumEstimatedMinutes table, MAX_ESTIMATE_MINUTES === 525600, and the round-trip guarantee parseEstimateHours(toEstimateHoursInput(m)) === m over the fixed sample [1, 4, 7, 13, 20, 53, 59, 90, 120, 150, 525600].
For sumEstimatedMinutes, build minimal task-shaped objects; cast with 'as unknown as Task[]' if the full Task shape is inconvenient, so the test stays readable.
Prefer it.each / a table-driven style so each row is a named assertion.`,
  [sec(682, 769, "the exact contract, every row is an assertion"), sec(865, 866, "what T3 must assert"),
   src("apps/web/src/components/kanban-board/task-labels.test.tsx", 1, 12, "sibling web test style")],
  fileOut,
  ["covers every row of all three function tables", "covers the round-trip sample",
   "covers sumEstimatedMinutes at zero, all-null, one, several", "no network or DOM dependency"], 3500));

packets.push(P("tp_cg_007_web_plumbing", "codegen", "new_file_add", "web-task",
  "apps/web/src/fetchers/task/update-task-estimate.ts",
  `Produce THREE web plumbing files/edits as a files array. Return full content for the two new files, and for the type edit return the complete new content of the small types file.
1) apps/web/src/types/task/index.ts (EDIT - return full new content): Task gains 'estimatedMinutes?: number | null;' after dueDate. It MUST be OPTIONAL, not required: bare Task object literals exist in files outside this run's write contract (apps/web/src/components/list-view/task-row.test.tsx), and a required field would fail pnpm typecheck at a file this run cannot legally edit. Add a short comment recording that this is contract-driven, not preferred.
2) apps/web/src/fetchers/task/update-task-estimate.ts (NEW): uses the typed client from @kaneo/libs, calling client.task.estimate[":id"].$put with param { id } and json { estimatedMinutes }. Follow the sibling fetcher's error handling exactly (throw new Error(await response.text()) when !response.ok).
3) apps/web/src/hooks/mutations/task/use-update-task-estimate.ts (NEW): useMutation + invalidateQueries. Invalidate exactly FOUR keys: ["task", id], ["tasks", projectId], ["projects"], ["activities", id]. Deliberately OMIT ["notifications"] - this route publishes no event, so no notification can exist to invalidate. Add a comment saying so.
The mutation variables shape is { taskId, projectId, estimatedMinutes } (NOT a whole Task) since the popover has all three.`,
  [sec(396, 438, "the optional-vs-required deviation and its reason"), sec(471, 518, "fetcher and hook spec"),
   whole("apps/web/src/types/task/index.ts", "target file, return full new content"),
   whole("apps/web/src/fetchers/task/update-task-due-date.ts", "sibling fetcher pattern"),
   whole("apps/web/src/hooks/mutations/task/use-update-task-due-date.ts", "sibling hook pattern")],
  filesOut,
  ["Task.estimatedMinutes is optional with an explanatory comment",
   "fetcher uses client.task.estimate[':id'].$put and the typed @kaneo/libs client",
   "hook invalidates exactly four keys and omits notifications with a comment",
   "no untyped fetch/axios call is introduced"], 3000));

fs.writeFileSync(`${RUN}/packets.part2.json`, JSON.stringify(packets, null, 2));
console.log("cumulative packets:", packets.length);

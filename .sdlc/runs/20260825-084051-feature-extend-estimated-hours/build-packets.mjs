import fs from "node:fs";
const RUN = ".sdlc/runs/20260825-084051-feature-extend-estimated-hours";
const PASS = "20260825-084051-feature-extend-estimated-hours";
const PLAN = `${RUN}/change_plan.md`;
const planLines = fs.readFileSync(PLAN, "utf8").split("\n");

// change_plan.md section by 1-based inclusive line range
const sec = (a, b, reason) => ({
  path: PLAN, reason,
  content: planLines.slice(a - 1, b).join("\n"),
});
// source file slice by 1-based inclusive line range
const src = (p, a, b, reason) => ({
  path: p, reason,
  content: fs.readFileSync(p, "utf8").split("\n").slice(a - 1, b).join("\n"),
});
const whole = (p, reason) => ({ path: p, reason, content: fs.readFileSync(p, "utf8") });

const RULES = `HARD RULES (this is a brownfield run on an existing repo):
- Follow the change_plan section given to you EXACTLY. It is authoritative and was approved by a human. Do not redesign.
- Match the surrounding repo style precisely: tabs vs spaces, quote style, import ordering, trailing commas. Biome formats this repo.
- Repo conventions (AGENTS.md): thin Hono handlers, domain logic in controllers, Valibot validation, HTTPException for expected failures, requireWorkspacePermission for authz, fetchers under apps/web/src/fetchers/, TanStack Query hooks for server state, typed client from @kaneo/libs, prefer inferred types and 'type' over 'interface'. Comments explain constraints, not narrate code.
- Emit ONLY what the output schema asks for. No prose, no markdown fences inside string fields, no explanation.
- Never invent an import that does not exist in this repo. Only use imports shown in the provided slices.`;

const fileOut = {
  type: "object",
  properties: { path: { type: "string" }, content: { type: "string" } },
  required: ["path", "content"],
};
const editsOut = {
  type: "object",
  properties: {
    edits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          anchor: { type: "string", description: "exact unique existing text to insert after" },
          insert_after: { type: "string", description: "exact new text, correctly indented" },
        },
        required: ["path", "anchor", "insert_after"],
      },
    },
  },
  required: ["edits"],
};
const filesOut = {
  type: "object",
  properties: { files: { type: "array", items: fileOut } },
  required: ["files"],
};

const P = (id, task_type, module, artifact_path, instruction, inputs, outputSchema, acceptance, maxOut, subtype) => ({
  id, phase: id.includes("_test") ? "tests" : "codegen",
  task_type, module, subtype,
  pass_id: PASS, intent: "feature-extend", artifact_path,
  instruction: `${instruction}\n\n${RULES}`,
  inputs, outputSchema, acceptance,
  budget: { maxInputTokens: 30000, maxOutputTokens: maxOut },
  retry_count: 0,
});

const packets = [];

packets.push(P("tp_cg_001_api_data", "existing_file_edit", "api-data",
  "apps/api/src/database/schema.ts",
  `Produce FOUR one-line insertions that thread the new nullable column through the API data layer.
1) apps/api/src/database/schema.ts - add the estimatedMinutes column to taskTable, positioned between dueDate and createdAt. 'integer' is already imported in this file. Do NOT touch the index block.
2) apps/api/src/schemas.ts - taskSchema gains estimatedMinutes after dueDate.
3) apps/api/src/task/controllers/get-task.ts - add estimatedMinutes to the db.select projection, after dueDate.
4) apps/api/src/task/controllers/get-tasks.ts - add estimatedMinutes to the taskSelection literal, after dueDate.
For each edit, 'anchor' MUST be a short exact substring that appears EXACTLY ONCE in that file, and 'insert_after' is the new line(s) with correct indentation.`,
  [sec(78, 103, "column definition and placement"), sec(246, 270, "taskSchema + read projections"),
   src("apps/api/src/database/schema.ts", 401, 445, "taskTable definition"),
   src("apps/api/src/schemas.ts", 25, 45, "taskSchema"),
   src("apps/api/src/task/controllers/get-task.ts", 1, 30, "getTask projection"),
   src("apps/api/src/task/controllers/get-tasks.ts", 122, 142, "taskSelection literal")],
  editsOut,
  ["schema.ts insert is exactly: estimatedMinutes: integer(\"estimated_minutes\"),",
   "schemas.ts insert declares estimatedMinutes as nullish number",
   "both projections add estimatedMinutes: taskTable.estimatedMinutes,",
   "every anchor string occurs exactly once in its file"],
  1500));

packets.push(P("tp_cg_002_api_validator", "new_file_add", "api-task",
  "apps/api/src/task/estimated-minutes.ts",
  `Write the complete new DB-free validation module apps/api/src/task/estimated-minutes.ts.
It must import ONLY { HTTPException } from "hono/http-exception" - it must NOT import ../database, because tests/api is a DB-free suite that imports this module directly.
Export exactly: MAX_ESTIMATED_MINUTES, normalizeEstimatedMinutes(value: unknown): number | null, coerceEstimatedMinutes(value: unknown): { estimatedMinutes: number | null; warning?: string }.
Implement the accept/reject table and the two verbatim messages exactly as the plan states. Note Number.isInteger is false for NaN and Infinity, which is why one range check covers them.`,
  [sec(311, 393, "validation design: exports, messages, accept/reject table, implementation order"),
   src("apps/api/src/task/validate-task-fields.ts", 55, 71, "coercePriority: the shape coerceEstimatedMinutes mirrors")],
  fileOut,
  ["no import of ../database", "MAX_ESTIMATED_MINUTES === 525600",
   "normalizeEstimatedMinutes throws HTTPException(400) for 0, -5, 90.5, NaN, Infinity, 525601",
   "normalizeEstimatedMinutes returns null for null and undefined",
   "coerceEstimatedMinutes never throws and returns a warning for every rejected value",
   "null/undefined coerce to null with NO warning"],
  2500));

packets.push(P("tp_cg_003_api_controller", "new_file_add", "api-task",
  "apps/api/src/task/controllers/update-task-estimate.ts",
  `Write the complete new controller apps/api/src/task/controllers/update-task-estimate.ts.
Model it on the sibling update-task-due-date.ts provided, with two deliberate differences:
- NO publishEvent call (approved Gate 1 OQ-5: activitySchema's type is a closed picklist with no estimate member).
- NO taskReminderSentTable deletion (that is due-date specific).
Include a short comment explaining WHY no event is published, since a reader will notice the asymmetry with every sibling controller.`,
  [sec(207, 245, "controller spec"), whole("apps/api/src/task/controllers/update-task-due-date.ts", "the sibling pattern to copy")],
  fileOut,
  ["default-exports an async function taking { id, estimatedMinutes, currentUserId }",
   "404 HTTPException when the task does not exist", "500 HTTPException when the update returns no row",
   "no publishEvent import or call", "a comment explains the omission"],
  1800));

packets.push(P("tp_cg_004_api_route", "existing_file_edit", "api-task",
  "apps/api/src/task/index.ts",
  `Produce the edits that add the PUT /estimate/:id route to apps/api/src/task/index.ts.
Return THREE edits: (1) the import of updateTaskEstimate, placed to keep the existing alphabetical controller-import order; (2) the import of normalizeEstimatedMinutes from "./estimated-minutes", matching how VALID_PRIORITIES is imported from "./validate-task-fields"; (3) the new .put("/estimate/:id", ...) chain link inserted immediately after the closing of the /due-date/:id link.
The middleware order is load-bearing and must be exactly: validator("param") -> validator("json") -> workspaceAccess.fromTask() -> requireWorkspacePermission({ task: ["update"] }) -> requireEntitlement -> handler.
The handler must be THIN: destructure with a default of null, call normalizeEstimatedMinutes, delegate to the controller, return c.json(task).
Each anchor must occur EXACTLY ONCE in the file.`,
  [sec(153, 206, "the new route spec"), src("apps/api/src/task/index.ts", 582, 616, "the /due-date/:id route to clone"),
   src("apps/api/src/task/index.ts", 28, 48, "existing import block")],
  editsOut,
  ["route path is /estimate/:id and operationId is updateTaskEstimate",
   "middleware chain order is exactly as specified",
   "responses 200 uses resolver(taskSchema)",
   "json validator is v.object({ estimatedMinutes: v.optional(v.nullable(v.number())) })",
   "handler body is under 12 lines", "each anchor occurs exactly once"],
  2500));

packets.push(P("tp_cg_005_api_importexport", "existing_file_edit", "api-task",
  "apps/api/src/task/controllers/export-tasks.ts",
  `Thread estimatedMinutes through the import/export round-trip (approved at Gate 1 OQ-1; without this an export->import cycle silently drops every estimate).
Return edits for THREE files:
1) apps/api/src/task/controllers/export-tasks.ts - add estimatedMinutes to the db.select({...}) projection, AND to the emitted per-task object in the returned tasks.map(...). Pass the integer through unchanged; null stays null.
2) apps/api/src/task/controllers/import-tasks.ts - add estimatedMinutes?: number | null to the ImportTask type; import coerceEstimatedMinutes from "../estimated-minutes"; call it alongside the existing coerceStatus/coercePriority calls; push its warning into the existing 'warnings' array (note the existing filter(Boolean) idiom); and write estimatedMinutes into the tx.insert(...).values({...}).
3) apps/api/src/task/index.ts - the /import/:projectId json validator's per-task v.object gains estimatedMinutes: v.optional(v.nullable(v.number())) after dueDate.
An invalid estimate must NEVER fail the whole import - it coerces to null and reports via the existing per-task warning channel.
Each anchor must occur EXACTLY ONCE in its file.`,
  [sec(270, 310, "export and import payload delta"), sec(380, 393, "coerceEstimatedMinutes contract"),
   whole("apps/api/src/task/controllers/export-tasks.ts", "target file"),
   src("apps/api/src/task/controllers/import-tasks.ts", 1, 80, "ImportTask type, coercion calls, insert values"),
   src("apps/api/src/task/index.ts", 435, 452, "import route json validator")],
  editsOut,
  ["export adds estimatedMinutes to BOTH the select projection and the emitted object",
   "ImportTask gains an optional nullable estimatedMinutes",
   "import calls coerceEstimatedMinutes and adds its warning to the existing warnings array",
   "the inserted values include estimatedMinutes",
   "the import route validator accepts optional nullable estimatedMinutes",
   "a bad estimate never throws out of the per-task loop"],
  2500));

fs.writeFileSync(`${RUN}/packets.part1.json`, JSON.stringify(packets, null, 2));
console.log("part1 packets:", packets.length);

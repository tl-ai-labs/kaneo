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
- ALL user-facing copy must use static i18n keys via useTranslation(); never hardcode a visible string.
- Emit ONLY what the output schema asks for. No prose, no markdown fences inside string fields.
- Never invent an import that does not exist in this repo. Only use imports shown in the provided slices.`;

const fileOut = { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] };
const filesOut = { type: "object", properties: { files: { type: "array", items: fileOut } }, required: ["files"] };
const editsOut = { type: "object", properties: { edits: { type: "array", items: { type: "object", properties: { path: { type: "string" }, anchor: { type: "string" }, insert_after: { type: "string" } }, required: ["path", "anchor", "insert_after"] } } }, required: ["edits"] };

const P = (id, phase, task_type, module, artifact_path, instruction, inputs, outputSchema, acceptance, maxOut) => ({
  id, phase, task_type, module, pass_id: PASS, intent: "feature-extend", artifact_path,
  instruction: `${instruction}\n\n${RULES}`, inputs, outputSchema, acceptance,
  budget: { maxInputTokens: 30000, maxOutputTokens: maxOut }, retry_count: 0,
});
const packets = JSON.parse(fs.readFileSync(`${RUN}/packets.part2.json`, "utf8"));

packets.push(P("tp_cg_008_web_popover", "codegen", "new_file_add", "web-task",
  "apps/web/src/components/task/task-estimate-popover.tsx",
  `Write the complete new component apps/web/src/components/task/task-estimate-popover.tsx.
Follow the spec section exactly. The due-date sibling is provided as the contract to preserve.
CRITICAL details:
- 'if (!canEdit) return <>{children}</>;' MUST appear before the Popover, so a user without task:["update"] gets an inert trigger with no popover machinery attached.
- The Input MUST be used as <Input nativeInput ... />. apps/web/src/components/ui/input.tsx is provided: by default it renders a @base-ui/react Input primitive, and only the nativeInput escape hatch gives plain React value/onChange semantics.
- Wrap the field in a <form onSubmit={...}> so Enter submits.
- On open, reset local value from server state via toEstimateHoursInput(task.estimatedMinutes).
- parseEstimateHours returning the string "invalid" must set an inline error and NOT dispatch the mutation.
- Bind the label to the input with useId().
- i18n keys available: tasks:popover.estimate.{title,placeholder,save,clear,invalid,updateSuccess,updateError}.`,
  [sec(519, 553, "component spec"), whole("apps/web/src/components/task/task-due-date-popover.tsx", "the sibling contract to preserve"),
   whole("apps/web/src/components/ui/input.tsx", "why nativeInput is required")],
  fileOut,
  ["default-exports TaskEstimatePopover with props { task, children }",
   "the !canEdit early return precedes the Popover",
   "Input is used with the nativeInput prop",
   "invalid input sets an error and does not call the mutation",
   "clear action only rendered when task.estimatedMinutes != null",
   "every visible string comes from t(...)"], 3500));

packets.push(P("tp_cg_009_web_sidebar", "codegen", "existing_file_edit", "web-task",
  "apps/web/src/components/task/task-properties-sidebar.tsx",
  `Produce the registration of TaskEstimatePopover in task-properties-sidebar.tsx.
This file renders THREE responsive variants of the same property row (compact, mobile, desktop), each already containing a TaskDueDatePopover trigger. The estimate trigger goes immediately after the due-date trigger in all three.
Return exactly two things:
- import_line: the single import statement for ./task-estimate-popover, worded so it can be placed alongside the existing sibling popover imports (which are alphabetically ordered: TaskAssigneePopover, TaskDueDatePopover, TaskLabelsPopover, TaskMovePopover, TaskPriorityPopover, TaskStartDatePopover).
- block: ONE canonical JSX block, indented with a base indent of 16 SPACES for the opening '{task && (' line. I will re-indent it for the compact variant myself. Do not emit three copies.
The block must mirror the neighbouring start-date trigger: {task && (<TaskEstimatePopover task={task}><Button variant="ghost" size="sm" className="justify-start h-7 px-1.5 gap-1.5"> ... </Button></TaskEstimatePopover>)}
Inside the Button: a Clock icon from lucide-react at className="w-3.5 h-3.5 text-muted-foreground", then a span using the same conditional muted styling the start-date trigger uses - showing formatEstimateHours(task.estimatedMinutes) when set, else t("tasks:properties.estimate").
Also return icon_import: the lucide-react named import you used, so I can merge it into the existing lucide import block.`,
  [sec(554, 595, "sidebar registration spec"),
   src("apps/web/src/components/task/task-properties-sidebar.tsx", 1, 48, "existing import block"),
   src("apps/web/src/components/task/task-properties-sidebar.tsx", 264, 327, "the start-date and due-date triggers to mirror")],
  { type: "object", properties: { import_line: { type: "string" }, icon_import: { type: "string" }, block: { type: "string" } }, required: ["import_line", "icon_import", "block"] },
  ["block opens with '{task && (' at exactly 16 spaces of indent",
   "uses formatEstimateHours from ./estimate", "placeholder copy comes from t('tasks:properties.estimate')",
   "Button className matches the sibling triggers exactly", "exactly one block is returned"], 2000));

packets.push(P("tp_cg_010_web_badge", "codegen", "new_file_add", "web-board",
  "apps/web/src/components/kanban-board/task-estimate-badge.tsx",
  `Produce the kanban card estimate badge as a files array plus one edit.
1) NEW apps/web/src/components/kanban-board/task-estimate-badge.tsx - a tiny presentational component, props { minutes: number | null | undefined }. It calls formatEstimateHours from "@/components/task/estimate" and returns null when that returns null, so an unset task renders NOTHING in the DOM. When set it renders a span styled EXACTLY like the sibling badges in the card's badge row: inline-flex items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground. Include a Clock icon from lucide-react at w-3 h-3. It must be exported as a named export AND usable without any provider (it is unit-tested in isolation), so it must NOT call useTranslation - the rendered text is purely the formatted value.
2) NEW apps/web/src/components/kanban-board/task-estimate-badge.test.tsx - vitest/jsdom + @testing-library/react. Assert: minutes={150} renders visible text "2.5h"; minutes={null} and minutes={undefined} render nothing (container.firstChild is null). Use the afterEach(cleanup) idiom from the sibling test.
Return these two as 'files'. Also return 'edit' describing the one-line insertion into task-card.tsx: render <TaskEstimateBadge minutes={task.estimatedMinutes} /> inside the existing badge row, immediately after the due-date block, plus the import. anchor must be an exact substring occurring EXACTLY ONCE in task-card.tsx.`,
  [sec(596, 641, "badge and card spec"), sec(682, 706, "formatEstimateHours output table"),
   src("apps/web/src/components/kanban-board/task-card.tsx", 253, 285, "the badge row and sibling badge styling"),
   whole("apps/web/src/components/kanban-board/task-labels.test.tsx", "sibling leaf-component test style")],
  { type: "object", properties: { files: { type: "array", items: fileOut }, edit: { type: "object", properties: { path: { type: "string" }, anchor: { type: "string" }, insert_after: { type: "string" }, import_line: { type: "string" } }, required: ["path", "anchor", "insert_after", "import_line"] } }, required: ["files", "edit"] },
  ["badge returns null for null and undefined minutes", "badge does not use useTranslation",
   "test asserts container.firstChild is null for the unset cases",
   "card edit anchor occurs exactly once"], 3000));

packets.push(P("tp_cg_011_web_rollup", "codegen", "new_file_add", "web-board",
  "apps/web/src/components/kanban-board/column/column-estimate-total.tsx",
  `Produce the per-lane estimate rollup as a files array plus one edit.
1) NEW apps/web/src/components/kanban-board/column/column-estimate-total.tsx - presentational, props { tasks: Task[] }. It calls sumEstimatedMinutes from "@/components/task/estimate"; when that returns null it returns null so the lane header renders NOTHING AT ALL - not an empty span, not a zero. This is the single most important behaviour in this packet. When non-null it renders a chip styled EXACTLY like the existing task-count chip beside it: rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground, containing formatEstimateHours(sum). Give the chip a title attribute for hover context using t("tasks:kanban.laneEstimate", { value }) - this component MAY use useTranslation since only the title uses copy; keep the visible text purely the formatted value so the test needs no i18n provider.
2) NEW apps/web/src/components/kanban-board/column/column-estimate-total.test.tsx - vitest/jsdom + @testing-library/react. Assert four cases: tasks={[]} renders nothing; two tasks both with null estimates render nothing; one task with 150 renders "2.5h"; [150, null, 90] renders "4h". Mock react-i18next with the { useTranslation: () => ({ t: (key) => key }) } idiom so no provider is needed.
Return these two as 'files'. Also return 'edit' for column-header.tsx: render <ColumnEstimateTotal tasks={column.tasks} /> immediately after the existing task-count chip span, plus the import. anchor must occur EXACTLY ONCE.`,
  [sec(642, 681, "rollup component and header spec"), sec(744, 769, "rollup contract table"),
   whole("apps/web/src/components/kanban-board/column/column-header.tsx", "target file and the count chip to mirror"),
   src("apps/web/src/components/task/task-status-popover.test.tsx", 28, 33, "the react-i18next mock idiom")],
  { type: "object", properties: { files: { type: "array", items: fileOut }, edit: { type: "object", properties: { path: { type: "string" }, anchor: { type: "string" }, insert_after: { type: "string" }, import_line: { type: "string" } }, required: ["path", "anchor", "insert_after", "import_line"] } }, required: ["files", "edit"] },
  ["returns null - rendering nothing - when the lane has no estimates",
   "test covers empty, all-null, one, several", "visible text needs no i18n provider",
   "header edit anchor occurs exactly once"], 3000));

packets.push(P("tp_cg_012_i18n", "codegen", "existing_file_edit", "i18n",
  "i18n/en-US.json",
  `Emit the new i18n keys for this feature as a FLAT map of dotted key paths to English values.
Return exactly the 10 keys specified in the plan section, no more and no fewer. Key paths use dots and start with the namespace, e.g. "tasks.properties.estimate".
Do NOT return JSON file content - return only the flat map. I apply it to i18n/en-US.json with the repo's own scripts/i18n/shared.mjs helpers so formatting and ordering match the repo exactly, and then propagate the same 10 paths to the 16 non-default locales.
The values must read naturally as product UI copy and match the wording style of the existing sibling keys shown.`,
  [sec(775, 814, "the exact key list, values and placement"),
   { path: "i18n/en-US.json", reason: "existing sibling key wording", content: JSON.stringify({ tasks: { properties: JSON.parse(fs.readFileSync("i18n/en-US.json", "utf8")).tasks.properties, popover: { dueDate: JSON.parse(fs.readFileSync("i18n/en-US.json", "utf8")).tasks.popover.dueDate }, kanban: JSON.parse(fs.readFileSync("i18n/en-US.json", "utf8")).tasks.kanban } }, null, 2) }],
  { type: "object", properties: { keys: { type: "object", additionalProperties: { type: "string" } } }, required: ["keys"] },
  ["exactly 10 keys", "all key paths start with 'tasks.'",
   "includes tasks.properties.estimate, tasks.properties.noEstimate, tasks.kanban.laneEstimate",
   "includes the seven tasks.popover.estimate.* keys",
   "tasks.kanban.laneEstimate contains the {{value}} interpolation placeholder"], 1200));

fs.writeFileSync(`${RUN}/packets.json`, JSON.stringify(packets, null, 2));
fs.rmSync(`${RUN}/packets.part1.json`); fs.rmSync(`${RUN}/packets.part2.json`);
console.log("TOTAL packets:", packets.length);
for (const p of packets) console.log(`  ${p.id.padEnd(28)} ${p.phase.padEnd(8)} ${p.artifact_path}`);

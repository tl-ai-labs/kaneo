import fs from "node:fs";

const RUN = ".sdlc/runs/20260825-084051-feature-extend-estimated-hours";
const contract = JSON.parse(fs.readFileSync(".sdlc/local/write-contract.json", "utf8"));
const packets = JSON.parse(fs.readFileSync(`${RUN}/packets.json`, "utf8"));

function globToRegExp(glob) {
  let out = "^";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i++;
      } else {
        out += "[^/]*";
      }
    } else if (".+^${}()|[]\\?".includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return new RegExp(`${out}$`);
}

const allowed = (p) =>
  contract.allowlist.some((g) => globToRegExp(g).test(p)) &&
  !contract.off_limits.some((g) => globToRegExp(g).test(p));

const intended = [
  "apps/api/src/database/schema.ts",
  "apps/api/src/schemas.ts",
  "apps/api/src/task/controllers/get-task.ts",
  "apps/api/src/task/controllers/get-tasks.ts",
  "apps/api/src/task/estimated-minutes.ts",
  "apps/api/src/task/controllers/update-task-estimate.ts",
  "apps/api/src/task/index.ts",
  "apps/api/src/task/controllers/export-tasks.ts",
  "apps/api/src/task/controllers/import-tasks.ts",
  "tests/api/task/estimated-minutes.test.ts",
  "tests/api/task/estimate-import-export.test.ts",
  "apps/web/src/components/task/estimate.ts",
  "apps/web/src/components/task/estimate.test.ts",
  "apps/web/src/types/task/index.ts",
  "apps/web/src/fetchers/task/update-task-estimate.ts",
  "apps/web/src/hooks/mutations/task/use-update-task-estimate.ts",
  "apps/web/src/components/task/task-estimate-popover.tsx",
  "apps/web/src/components/task/task-properties-sidebar.tsx",
  "apps/web/src/components/kanban-board/task-estimate-badge.tsx",
  "apps/web/src/components/kanban-board/task-estimate-badge.test.tsx",
  "apps/web/src/components/kanban-board/task-card.tsx",
  "apps/web/src/components/kanban-board/column/column-estimate-total.tsx",
  "apps/web/src/components/kanban-board/column/column-estimate-total.test.tsx",
  "apps/web/src/components/kanban-board/column/column-header.tsx",
  "i18n/en-US.json",
  "i18n/de-DE.json",
  "i18n/zh-CN.json",
  "i18n/schema.json",
  "apps/api/drizzle/0043_example.sql",
  "apps/api/drizzle/meta/_journal.json",
  "apps/api/drizzle/meta/0043_snapshot.json",
];

let refused = 0;
for (const p of intended) {
  if (!allowed(p)) {
    console.log("REFUSED:", p);
    refused++;
  }
}
console.log(
  refused === 0
    ? `ALLOWED: all ${intended.length} intended write paths are inside the allowlist`
    : `BLOCKED: ${refused} intended paths are outside the allowlist`,
);

console.log("--- negative control: every one of these MUST be refused ---");
const mustRefuse = [
  ".env",
  "biome.json",
  ".gitignore",
  "apps/web/src/lib/estimate.ts",
  "tests/api-integration/task.test.ts",
  "AGENTS.md",
  "CLAUDE.md",
  "apps/web/src/components/list-view/task-row.test.tsx",
  "pnpm-lock.yaml",
  "apps/api/dist/index.js",
];
let leaked = 0;
for (const p of mustRefuse) {
  const bad = allowed(p);
  if (bad) leaked++;
  console.log(`${bad ? "WRONGLY ALLOWED:" : "correctly refused:"} ${p}`);
}
console.log(leaked === 0 ? "negative control clean" : `${leaked} LEAKS`);

console.log("--- packet field completeness ---");
const required = [
  "id", "phase", "task_type", "module", "instruction", "inputs",
  "outputSchema", "acceptance", "budget", "pass_id", "artifact_path", "intent",
];
let problems = 0;
for (const p of packets) {
  const missing = required.filter((k) => p[k] === undefined);
  if (missing.length) {
    console.log("PACKET", p.id, "missing:", missing.join(", "));
    problems++;
  }
  if (!allowed(p.artifact_path)) {
    console.log("PACKET", p.id, "artifact_path REFUSED:", p.artifact_path);
    problems++;
  }
  if (!p.budget || typeof p.budget.maxInputTokens !== "number" || typeof p.budget.maxOutputTokens !== "number") {
    console.log("PACKET", p.id, "malformed budget");
    problems++;
  }
  if (!Array.isArray(p.inputs)) {
    console.log("PACKET", p.id, "inputs is not an array");
    problems++;
  }
}
console.log(
  problems === 0
    ? `all ${packets.length} packets carry every required field and an allowlisted artifact_path`
    : `${problems} packet problems`,
);

const sizes = packets.map((p) => JSON.stringify(p).length);
console.log(
  "packet payload chars: total",
  sizes.reduce((a, b) => a + b, 0),
  "| max",
  Math.max(...sizes),
  "| approx input tokens total",
  Math.round(sizes.reduce((a, b) => a + b, 0) / 3.8),
);

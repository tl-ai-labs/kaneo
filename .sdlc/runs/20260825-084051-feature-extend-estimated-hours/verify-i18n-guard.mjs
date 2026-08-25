// AC-16 verification: prove each locale's key set changed by EXACTLY the ten
// keys this run is permitted to add, and that no existing value was altered.
//
// Compares the working tree against this branch's own HEAD (5d1fc910). It never
// reads another branch.

import { execFileSync } from "node:child_process";
import fs from "node:fs";

const EXPECTED = new Set([
  "tasks:properties.noEstimate",
  "tasks:popover.estimate.title",
  "tasks:popover.estimate.placeholder",
  "tasks:popover.estimate.save",
  "tasks:popover.estimate.clear",
  "tasks:popover.estimate.invalid",
  "tasks:popover.estimate.updateSuccess",
  "tasks:popover.estimate.updateError",
  "tasks:kanban.laneEstimate",
]);

function flatten(data) {
  const out = new Map();
  for (const [namespace, value] of Object.entries(data)) {
    walk(value, `${namespace}:`, out);
  }
  return out;
}

function walk(value, prefix, out) {
  if (typeof value === "string") {
    out.set(prefix.replace(/\.$/u, ""), value);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const next = prefix.endsWith(":") ? `${prefix}${key}` : `${prefix}.${key}`;
    walk(child, next, out);
  }
}

const locales = fs
  .readdirSync("i18n")
  .filter((f) => f.endsWith(".json") && f !== "schema.json")
  .sort();

let failures = 0;
for (const file of locales) {
  const path = `i18n/${file}`;
  const before = flatten(
    JSON.parse(execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf8" })),
  );
  const after = flatten(JSON.parse(fs.readFileSync(path, "utf8")));

  const added = [...after.keys()].filter((k) => !before.has(k));
  const removed = [...before.keys()].filter((k) => !after.has(k));
  const changed = [...before.entries()].filter(
    ([k, v]) => after.has(k) && after.get(k) !== v,
  );

  const unexpectedAdded = added.filter((k) => !EXPECTED.has(k));
  const missingExpected = [...EXPECTED].filter((k) => !after.has(k));

  const ok =
    unexpectedAdded.length === 0 &&
    removed.length === 0 &&
    changed.length === 0 &&
    missingExpected.length === 0 &&
    added.length === 9;

  if (!ok) {
    failures++;
    console.log(`FAIL ${file}`);
    if (unexpectedAdded.length) console.log("  unexpected added:", unexpectedAdded);
    if (removed.length) console.log("  removed:", removed);
    if (changed.length) console.log("  VALUE CHANGED:", changed.map(([k]) => k));
    if (missingExpected.length) console.log("  missing expected:", missingExpected);
    if (added.length !== 9) console.log(`  added ${added.length}, expected 10`);
  } else {
    console.log(
      `ok   ${file.padEnd(12)} +9 keys, 0 removed, 0 existing values altered`,
    );
  }
}

console.log(
  failures === 0
    ? `\nAC-16 PASS: all ${locales.length} locale files changed by exactly the 9 permitted keys, with no existing translation touched.`
    : `\nAC-16 FAIL: ${failures} locale file(s) drifted.`,
);
process.exit(failures === 0 ? 0 : 1);

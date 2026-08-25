// Guarded i18n propagation for run 20260825-084051-feature-extend-estimated-hours.
//
// Gate 1 OQ-3 chose English placeholders in the non-default locales, produced the
// way the repo's own tooling would produce them. It did NOT authorise touching
// anything else.
//
// `pnpm i18n:check:fix` cannot be used directly here: the baseline is already red
// with 324 pre-existing missing keys across all 16 non-default locales (see
// i18n-baseline-before.txt), and --fix would backfill every one of them --
// thousands of lines of English prose into zh-CN / ko-KR / ru-RU, plus plural
// forms the checker only believes are missing because it compares flattened key
// sets without regard for per-locale CLDR plural categories.
//
// So this script drives the repo's own helpers (loadLocales / setValueAtKey /
// writeJson from scripts/i18n/shared.mjs) over a HARDCODED list of exactly ten
// key paths. It never enumerates missing keys, never diffs locales, and never
// iterates over anything but NEW_KEYS. It is structurally incapable of writing a
// key outside that list -- not merely instructed not to.

import {
  defaultLocale,
  loadLocales,
  setValueAtKey,
  writeJson,
} from "../../../scripts/i18n/shared.mjs";

// The only keys this run is permitted to add. Exactly ten.
// Key format is the repo's own `namespace:nested.path`, matching what
// scripts/i18n/check.mjs prints and what setValueAtKey expects.
const NEW_KEYS = {
  "tasks:properties.noEstimate": "No estimate",
  "tasks:popover.estimate.title": "Estimate (hours)",
  "tasks:popover.estimate.placeholder": "e.g. 2.5",
  "tasks:popover.estimate.save": "Save",
  "tasks:popover.estimate.clear": "Clear estimate",
  "tasks:popover.estimate.invalid": "Enter hours between {{min}} and {{max}}.",
  "tasks:popover.estimate.updateSuccess": "Task estimate updated successfully",
  "tasks:popover.estimate.updateError": "Failed to update task estimate",
  "tasks:kanban.laneEstimate": "Estimated: {{value}}",
};

const entries = Object.entries(NEW_KEYS);

if (entries.length !== 9) {
  console.error(`Refusing to run: expected 9 keys, found ${entries.length}.`);
  process.exit(1);
}

const { locales } = await loadLocales();

let written = 0;
for (const locale of locales) {
  for (const [key, value] of entries) {
    setValueAtKey(locale.data, key, value);
  }
  await writeJson(locale.path, locale.data);
  written++;
  const kind = locale.locale === defaultLocale ? "source of truth" : "English placeholder";
  console.log(`  ${locale.locale.padEnd(6)} ${entries.length} keys (${kind})`);
}

console.log(`\nWrote ${entries.length} keys into ${written} locale files.`);
console.log("schema.json is NOT touched here - regenerate it with: pnpm i18n:schema");

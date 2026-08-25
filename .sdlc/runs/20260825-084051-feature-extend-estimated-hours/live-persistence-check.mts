// Scratch verification (NOT a committed test, NOT inside the repo tree).
//
// Exercises the real persistence path against the real kaneo_opus_only database:
// normalizer -> controller -> drizzle UPDATE -> read projection.
//
// This is what turns AC-2 ("persists 150; null clears it") and AC-5 ("both read
// projections return the field") from structurally-covered into executed. It
// does NOT cover the HTTP layer or the middleware chain -- that gap is real and
// stated in change_plan.md §10.3.


const results: string[] = [];
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  results.push(
    `${ok ? "PASS" : "FAIL"}  ${label}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

const { default: updateTaskEstimate } = await import(
  "/home/sangeetha/projects/kaneo/apps/api/src/task/controllers/update-task-estimate"
);
const { normalizeEstimatedMinutes } = await import(
  "/home/sangeetha/projects/kaneo/apps/api/src/task/estimated-minutes"
);
const { default: getTasksReal } = await import(
  "/home/sangeetha/projects/kaneo/apps/api/src/task/controllers/get-task"
);

// 1. Set an estimate on a pre-existing row.
const set = await updateTaskEstimate({
  id: "t_seed_1",
  estimatedMinutes: normalizeEstimatedMinutes(150),
});
check("update persists 150", set.estimatedMinutes, 150);

// 2. getTask projection returns it (AC-5).
const read = await getTasksReal("t_seed_1");
check("getTask projection returns 150", read.estimatedMinutes, 150);

// 3. Untouched sibling rows stay NULL (NFR-1).
const untouched = await getTasksReal("t_seed_2");
check("untouched row stays null", untouched.estimatedMinutes, null);

// 4. Clearing works.
const cleared = await updateTaskEstimate({
  id: "t_seed_1",
  estimatedMinutes: normalizeEstimatedMinutes(null),
});
check("null clears the estimate", cleared.estimatedMinutes, null);

// 5. Invalid values are refused with 400 before any write (AC-3).
for (const bad of [0, -5, 90.5, Number.NaN, 525601, "abc"]) {
  let status: unknown = "did not throw";
  try {
    normalizeEstimatedMinutes(bad);
  } catch (error) {
    status = (error as { status?: number }).status;
  }
  check(`rejects ${JSON.stringify(bad)} with 400`, status, 400);
}

// 6. A rejected value never reached the database.
const afterBad = await getTasksReal("t_seed_1");
check("row still null after rejected writes", afterBad.estimatedMinutes, null);

// 7. Bound is accepted.
const bound = await updateTaskEstimate({
  id: "t_seed_3",
  estimatedMinutes: normalizeEstimatedMinutes(525600),
});
check("accepts the 525600 bound", bound.estimatedMinutes, 525600);

// Restore the seeded rows to NULL so the DB is left as it was found.
await updateTaskEstimate({ id: "t_seed_3", estimatedMinutes: null });

console.log(results.join("\n"));
console.log(
  failures === 0
    ? `\nALL ${results.length} live persistence checks PASSED against kaneo_opus_only`
    : `\n${failures} of ${results.length} checks FAILED`,
);
process.exit(failures === 0 ? 0 : 1);

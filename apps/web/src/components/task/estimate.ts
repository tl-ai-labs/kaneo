// Placement: this module sits under components/task/ rather than lib/ because
// apps/web/src/lib/** is outside this run's write contract. kanban-board imports
// it via @/components/task/estimate.

// Must stay equal to MAX_ESTIMATED_MINUTES in apps/api/src/task/estimated-minutes.ts.
// A genuinely shared constant belongs in packages/libs; both suites assert the
// literal 525600 so a one-sided change fails a test rather than desynchronising
// client-side rejection from server-side rejection.
export const MAX_ESTIMATED_MINUTES = 525600;

type EstimateBearing = {
  estimatedMinutes?: number | null;
};

// Shared guard: a stale client must never paint a chip for 0, a negative, or a
// non-finite value, so every non-storable input collapses to null here.
function toEstimateHours(minutes: number | null | undefined): number | null {
  if (
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    return null;
  }

  return Math.round((minutes / 60) * 100) / 100;
}

export function formatEstimateHours(
  minutes: number | null | undefined,
): string | null {
  const hours = toEstimateHours(minutes);

  return hours === null ? null : `${String(hours)}h`;
}

export function toEstimateHoursInput(
  minutes: number | null | undefined,
): string {
  const hours = toEstimateHours(minutes);

  return hours === null ? "" : String(hours);
}

export function parseEstimateHours(input: string): number | null | "invalid" {
  const trimmed = input.trim();

  if (trimmed === "") {
    return null;
  }

  // Number(), not parseFloat(): "2abc" must be rejected, not partially parsed.
  // 9 of the 17 shipped locales use a comma decimal separator, and Number("2,5")
  // is NaN; replacing only the first comma keeps "1,2,3" unparseable.
  const hours = Number(trimmed.replace(",", "."));

  if (!Number.isFinite(hours) || hours <= 0) {
    return "invalid";
  }

  const minutes = Math.round(hours * 60);

  // A positive input that would store nothing is a rejection, not a clear.
  if (minutes < 1 || minutes > MAX_ESTIMATED_MINUTES) {
    return "invalid";
  }

  return minutes;
}

// Sums minutes and formats once at the end; summing formatted hours would
// compound the 2-dp rounding error per task.
export function sumEstimatedMinutes(
  tasks: ReadonlyArray<EstimateBearing>,
): number | null {
  let total = 0;
  let counted = false;

  for (const task of tasks) {
    const minutes = task.estimatedMinutes;

    if (
      typeof minutes === "number" &&
      Number.isFinite(minutes) &&
      minutes > 0
    ) {
      total += minutes;
      counted = true;
    }
  }

  // null, not 0, is the empty signal: an all-null lane is deliberately
  // indistinguishable from an empty one and renders no element.
  return counted ? total : null;
}

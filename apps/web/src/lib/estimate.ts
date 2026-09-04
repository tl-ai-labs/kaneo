import type Task from "@/types/task";

export const MIN_ESTIMATE_MINUTES = 1;
export const MAX_ESTIMATE_MINUTES = 2147483647;

function toTrimmedHours(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function isStorableEstimate(
  minutes: number | null | undefined,
): minutes is number {
  return (
    typeof minutes === "number" &&
    Number.isInteger(minutes) &&
    minutes >= MIN_ESTIMATE_MINUTES &&
    minutes <= MAX_ESTIMATE_MINUTES
  );
}

/**
 * Renders a stored minute count as decimal hours. Two decimal places, trailing
 * zeros trimmed. Returns null for anything not a storable estimate so callers
 * render nothing rather than "0h".
 */
export function formatEstimateMinutes(
  minutes: number | null | undefined,
): string | null {
  if (!isStorableEstimate(minutes)) return null;
  return `${toTrimmedHours(minutes)}h`;
}

/**
 * Parses a decimal-hours string typed by a user into storable minutes.
 * Returns null for empty, malformed, non-positive, or out-of-range input.
 * Accepts only /^\d+(\.\d+)?$/ — no sign, no exponent, no comma decimal separator.
 */
export function parseEstimateHours(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const hours = Number(trimmed);
  if (!Number.isFinite(hours)) return null;
  const minutes = Math.round(hours * 60);
  return isStorableEstimate(minutes) ? minutes : null;
}

/** Prefill value for the hours input. "" when there is no estimate. No "h" suffix. */
export function estimateMinutesToHoursInput(
  minutes: number | null | undefined,
): string {
  if (!isStorableEstimate(minutes)) return "";
  return toTrimmedHours(minutes);
}

/** Sums raw integer minutes. Null/undefined estimates contribute 0. Never NaN. */
export function sumEstimateMinutes(
  tasks: ReadonlyArray<Pick<Task, "estimatedMinutes">>,
): number {
  return tasks.reduce((total, task) => total + (task.estimatedMinutes ?? 0), 0);
}

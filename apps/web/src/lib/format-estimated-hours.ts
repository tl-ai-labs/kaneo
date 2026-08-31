// Minutes are the storage unit so lane sums stay exact, which is why formatting
// happens only at the display boundary.

// Mirrors ESTIMATED_MINUTES_MAX in apps/api/src/schemas.ts; the API is the authority and rejects anything above this.
export const MAX_ESTIMATED_MINUTES = 525_600;

export function formatEstimatedHours(
  minutes: number | null | undefined,
): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }
  const hours = Math.round((minutes / 60) * 100) / 100;
  return `${hours}h`;
}

export function sumEstimatedMinutes(
  tasks: ReadonlyArray<{ estimatedMinutes?: number | null }>,
): number {
  return tasks.reduce((total, task) => {
    const minutes = task.estimatedMinutes;
    if (minutes != null && Number.isFinite(minutes)) {
      return total + minutes;
    }
    return total;
  }, 0);
}

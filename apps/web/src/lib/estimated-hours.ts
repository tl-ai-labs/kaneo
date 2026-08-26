export const MAX_ESTIMATED_HOURS = 10_000;

export function sumEstimatedHours(
  tasks: Array<{ estimatedHours?: number | null }>,
): number {
  const total = tasks.reduce((sum, task) => {
    return sum + (task.estimatedHours ?? 0);
  }, 0);

  return Math.round(total * 100) / 100;
}

export type ParsedEstimatedHours =
  | { ok: true; value: number | null }
  | { ok: false };

export function parseEstimatedHoursInput(raw: string): ParsedEstimatedHours {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { ok: true, value: null };
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_ESTIMATED_HOURS) {
    return { ok: false };
  }

  return { ok: true, value: Math.round(parsed * 100) / 100 };
}

export function estimatedHoursForRequest(raw: string): number | undefined {
  const parsed = parseEstimatedHoursInput(raw);
  return parsed.ok && parsed.value != null ? parsed.value : undefined;
}

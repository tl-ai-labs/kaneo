import { HTTPException } from "hono/http-exception";

// One year of minutes. Sized so a whole board of tasks cannot overflow the
// PostgreSQL integer column or a client-side sum over Number.
// Must stay equal to MAX_ESTIMATED_MINUTES in
// apps/web/src/components/task/estimate.ts.
export const MAX_ESTIMATED_MINUTES = 60 * 24 * 365;

const TYPE_MESSAGE = "estimatedMinutes must be a number or null";
const RANGE_MESSAGE = `estimatedMinutes must be a whole number of minutes between 1 and ${MAX_ESTIMATED_MINUTES}`;

export function normalizeEstimatedMinutes(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Re-checked here so callers that skip the route validator stay safe.
  if (typeof value !== "number") {
    throw new HTTPException(400, { message: TYPE_MESSAGE });
  }

  // Number.isInteger is false for NaN and Infinity, which Valibot's v.number()
  // accepts, so this single range check covers them alongside 90.5.
  if (!Number.isInteger(value) || value < 1 || value > MAX_ESTIMATED_MINUTES) {
    throw new HTTPException(400, { message: RANGE_MESSAGE });
  }

  return value;
}

export function coerceEstimatedMinutes(value: unknown): {
  estimatedMinutes: number | null;
  warning?: string;
} {
  // An absent estimate is normal import input, not a data problem.
  if (value === null || value === undefined) {
    return { estimatedMinutes: null };
  }

  try {
    return { estimatedMinutes: normalizeEstimatedMinutes(value) };
  } catch {
    return {
      estimatedMinutes: null,
      warning: `Invalid estimatedMinutes ${JSON.stringify(value)} imported as no estimate`,
    };
  }
}

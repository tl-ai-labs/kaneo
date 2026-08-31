import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  ESTIMATED_MINUTES_MAX,
  estimatedMinutesSchema,
} from "../../../apps/api/src/task/validate-task-fields";

describe("estimatedMinutesSchema", () => {
  it("matches ESTIMATED_MINUTES_MAX constant", () => {
    expect(ESTIMATED_MINUTES_MAX).toBe(525600);
  });

  it("accepts valid estimated minutes and null", () => {
    expect(v.safeParse(estimatedMinutesSchema, 0).success).toBe(true);
    expect(v.safeParse(estimatedMinutesSchema, 60).success).toBe(true);
    expect(v.safeParse(estimatedMinutesSchema, 150).success).toBe(true);
    expect(v.safeParse(estimatedMinutesSchema, 525600).success).toBe(true);
    expect(v.safeParse(estimatedMinutesSchema, null).success).toBe(true);
  });

  it("rejects invalid estimated minutes values", () => {
    expect(v.safeParse(estimatedMinutesSchema, -1).success).toBe(false);
    expect(v.safeParse(estimatedMinutesSchema, 525601).success).toBe(false);
    expect(v.safeParse(estimatedMinutesSchema, 2.5).success).toBe(false);
    expect(v.safeParse(estimatedMinutesSchema, 0.5).success).toBe(false);
    expect(v.safeParse(estimatedMinutesSchema, "120").success).toBe(false);
    expect(v.safeParse(estimatedMinutesSchema, undefined).success).toBe(false);
  });
});

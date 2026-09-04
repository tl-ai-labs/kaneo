import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  estimatedMinutesFieldSchema,
  estimatedMinutesSchema,
  MAX_ESTIMATED_MINUTES,
} from "../../../apps/api/src/task/estimate-schema";

describe("estimateSchema", () => {
  it("defines MAX_ESTIMATED_MINUTES as 2147483647", () => {
    expect(MAX_ESTIMATED_MINUTES).toBe(2147483647);
  });

  describe("estimatedMinutesSchema", () => {
    it("accepts valid positive integers within range", () => {
      expect(v.safeParse(estimatedMinutesSchema, 1).success).toBe(true);
      expect(v.safeParse(estimatedMinutesSchema, 90).success).toBe(true);
      expect(v.safeParse(estimatedMinutesSchema, 2147483647).success).toBe(
        true,
      );
    });

    it("rejects 0 and negative integers", () => {
      expect(v.safeParse(estimatedMinutesSchema, 0).success).toBe(false);
      expect(v.safeParse(estimatedMinutesSchema, -5).success).toBe(false);
    });

    it("rejects non-integer numbers", () => {
      expect(v.safeParse(estimatedMinutesSchema, 1.5).success).toBe(false);
    });

    it("rejects values above the upper bound", () => {
      expect(v.safeParse(estimatedMinutesSchema, 2147483648).success).toBe(
        false,
      );
    });

    it("rejects non-finite numbers and strings", () => {
      expect(v.safeParse(estimatedMinutesSchema, Number.NaN).success).toBe(
        false,
      );
      expect(
        v.safeParse(estimatedMinutesSchema, Number.POSITIVE_INFINITY).success,
      ).toBe(false);
      expect(v.safeParse(estimatedMinutesSchema, "90").success).toBe(false);
    });

    it("rejects null", () => {
      expect(v.safeParse(estimatedMinutesSchema, null).success).toBe(false);
    });
  });

  describe("estimatedMinutesFieldSchema", () => {
    it("accepts null for explicit clear", () => {
      expect(v.safeParse(estimatedMinutesFieldSchema, null).success).toBe(true);
    });

    it("accepts undefined for omitted key", () => {
      expect(v.safeParse(estimatedMinutesFieldSchema, undefined).success).toBe(
        true,
      );
    });

    it("accepts valid positive integers", () => {
      expect(v.safeParse(estimatedMinutesFieldSchema, 60).success).toBe(true);
    });

    it("rejects invalid values like 0", () => {
      expect(v.safeParse(estimatedMinutesFieldSchema, 0).success).toBe(false);
    });
  });
});

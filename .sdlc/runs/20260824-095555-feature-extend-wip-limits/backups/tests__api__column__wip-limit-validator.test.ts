import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { wipLimitSchema } from "../../../apps/api/src/column/validators";

const schema = v.object({ wipLimit: wipLimitSchema });

describe("wipLimitSchema", () => {
  it("accepts a valid positive integer", () => {
    expect(v.parse(schema, { wipLimit: 3 })).toEqual({ wipLimit: 3 });
  });

  it("accepts 1 as the lower boundary", () => {
    expect(v.parse(schema, { wipLimit: 1 })).toEqual({ wipLimit: 1 });
  });

  it("accepts null", () => {
    expect(v.parse(schema, { wipLimit: null })).toEqual({ wipLimit: null });
  });

  it("leaves wipLimit undefined when omitted", () => {
    expect(v.parse(schema, {})).toEqual({ wipLimit: undefined });
  });

  it("rejects 0", () => {
    expect(() => v.parse(schema, { wipLimit: 0 })).toThrow();
  });

  it("rejects negative numbers", () => {
    expect(() => v.parse(schema, { wipLimit: -1 })).toThrow();
  });

  it("rejects non-integers", () => {
    expect(() => v.parse(schema, { wipLimit: 2.5 })).toThrow();
  });

  it("rejects strings", () => {
    expect(() => v.parse(schema, { wipLimit: "3" })).toThrow();
  });

  it("rejects booleans", () => {
    expect(() => v.parse(schema, { wipLimit: true })).toThrow();
  });

  it("rejects NaN", () => {
    expect(() => v.parse(schema, { wipLimit: Number.NaN })).toThrow();
  });
});

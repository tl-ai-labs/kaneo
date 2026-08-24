import i18next from "i18next";
import { beforeAll, describe, expect, it } from "vitest";
import enUS from "../../../../../i18n/en-US.json";

// Component tests in this repo mock react-i18next so `t` merely echoes the key
// — `t("x", { count: 2 })` returns the literal "x". That makes plural bugs
// invisible to them. Plural selection and placeholder substitution are
// therefore proved here, against a REAL i18next instance loaded from the
// en-US source of truth.
beforeAll(async () => {
  await i18next.init({
    lng: "en-US",
    resources: { "en-US": enUS },
    ns: Object.keys(enUS),
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
});

describe("estimatedHours i18n", () => {
  it("selects the correct plural form for the hours label", () => {
    expect(i18next.t("tasks:properties.estimatedHours", { count: 1 })).toBe(
      "1 hour",
    );
    expect(i18next.t("tasks:properties.estimatedHours", { count: 2 })).toBe(
      "2 hours",
    );
    expect(i18next.t("tasks:properties.estimatedHours", { count: 0 })).toBe(
      "0 hours",
    );
  });

  it("interpolates the kanban rollup strings", () => {
    expect(
      i18next.t("tasks:kanban.estimate.partial", {
        hours: 12,
        done: 2,
        total: 5,
      }),
    ).toBe("12h estimated across 2 of 5 tasks");
    expect(
      i18next.t("tasks:kanban.estimate.all", { hours: 12, total: 5 }),
    ).toBe("12h estimated across all 5 tasks");
    expect(i18next.t("tasks:kanban.estimate.allShort", { hours: 12 })).toBe(
      "12h",
    );
  });

  it("resolves the none state to non-empty strings", () => {
    expect(i18next.t("tasks:kanban.estimate.none")).toBeTruthy();
    expect(i18next.t("tasks:kanban.estimate.noneShort")).toBeTruthy();
  });

  it("leaves no unsubstituted placeholders in any rollup string", () => {
    const rendered = [
      i18next.t("tasks:properties.estimatedHours", { count: 1 }),
      i18next.t("tasks:properties.estimatedHours", { count: 5 }),
      i18next.t("tasks:properties.noEstimate"),
      i18next.t("tasks:kanban.estimate.partial", {
        hours: 12,
        done: 2,
        total: 5,
      }),
      i18next.t("tasks:kanban.estimate.partialShort", {
        hours: 12,
        done: 2,
        total: 5,
      }),
      i18next.t("tasks:kanban.estimate.all", { hours: 12, total: 5 }),
      i18next.t("tasks:kanban.estimate.allShort", { hours: 12 }),
      i18next.t("tasks:kanban.estimate.none"),
      i18next.t("tasks:kanban.estimate.noneShort"),
      i18next.t("common:modals.createTask.estimatedHours"),
    ];

    for (const str of rendered) {
      expect(str).not.toContain("{{");
    }
  });
});

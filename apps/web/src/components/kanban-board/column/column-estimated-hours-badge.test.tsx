import "@/lib/i18n";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ColumnEstimatedHoursBadge } from "./column-estimated-hours-badge";

afterEach(() => {
  cleanup();
});

describe("ColumnEstimatedHoursBadge", () => {
  it("renders the summed estimate", () => {
    render(
      <ColumnEstimatedHoursBadge
        tasks={[{ estimatedHours: 2.5 }, { estimatedHours: 1.5 }]}
      />,
    );

    expect(screen.getByText("4h")).toBeVisible();
  });

  it("treats missing and null estimates as zero", () => {
    render(
      <ColumnEstimatedHoursBadge
        tasks={[{ estimatedHours: 2.5 }, { estimatedHours: null }, {}]}
      />,
    );

    expect(screen.getByText("2.5h")).toBeVisible();
  });

  it("renders nothing when every estimate is zero", () => {
    render(
      <ColumnEstimatedHoursBadge
        tasks={[{ estimatedHours: 0 }, { estimatedHours: 0 }]}
      />,
    );

    expect(screen.queryByText(/h$/)).toBeNull();
  });

  it("renders nothing when no task has an estimate", () => {
    const { container } = render(
      <ColumnEstimatedHoursBadge tasks={[{}, {}]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("avoids floating point artifacts", () => {
    render(
      <ColumnEstimatedHoursBadge
        tasks={[{ estimatedHours: 0.1 }, { estimatedHours: 0.2 }]}
      />,
    );

    expect(screen.getByText("0.3h")).toBeVisible();
    expect(screen.queryByText("0.30000000000000004h")).toBeNull();
  });
});

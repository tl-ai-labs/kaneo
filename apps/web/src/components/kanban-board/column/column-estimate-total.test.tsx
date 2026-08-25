import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColumnEstimateTotal } from "./column-estimate-total";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
});

function buildTasks(estimates: Array<number | null>) {
  return estimates.map((estimatedMinutes, index) => ({
    id: `task-${String(index)}`,
    title: `Task ${String(index)}`,
    estimatedMinutes,
  }));
}

describe("ColumnEstimateTotal", () => {
  it("renders nothing for an empty lane", () => {
    const { container } = render(<ColumnEstimateTotal tasks={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when every task has no estimate", () => {
    const { container } = render(
      <ColumnEstimateTotal tasks={buildTasks([null, null])} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders the formatted total for a single estimated task", () => {
    render(<ColumnEstimateTotal tasks={buildTasks([150])} />);

    expect(screen.getByText("2.5h")).toBeVisible();
  });

  it("sums the estimated tasks and skips the unestimated ones", () => {
    render(<ColumnEstimateTotal tasks={buildTasks([150, null, 90])} />);

    expect(screen.getByText("4h")).toBeVisible();
  });
});

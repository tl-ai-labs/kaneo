import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TaskEstimateBadge } from "./task-estimate-badge";

afterEach(() => {
  cleanup();
});

describe("TaskEstimateBadge", () => {
  it("renders the formatted estimate when minutes are set", () => {
    render(<TaskEstimateBadge minutes={150} />);

    expect(screen.getByText("2.5h")).toBeVisible();
  });

  it("renders nothing when the estimate is null", () => {
    const { container } = render(<TaskEstimateBadge minutes={null} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the estimate is undefined", () => {
    const { container } = render(<TaskEstimateBadge minutes={undefined} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the estimate is zero", () => {
    const { container } = render(<TaskEstimateBadge minutes={0} />);

    expect(container.firstChild).toBeNull();
  });
});

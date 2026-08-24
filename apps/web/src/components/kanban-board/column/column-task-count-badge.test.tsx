import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColumnTaskCountBadge } from "./column-task-count-badge";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}|${JSON.stringify(options)}` : key,
  }),
}));

afterEach(() => {
  cleanup();
});

describe("ColumnTaskCountBadge", () => {
  it("renders standard count badge when wipLimit is null", () => {
    render(<ColumnTaskCountBadge count={7} wipLimit={null} />);

    const el = screen.getByText("7");
    expect(el).toBeVisible();
    expect(screen.queryByText("7/3")).toBeNull();
    expect(el.className).toBe(
      "rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
    );
    expect(el.getAttribute("data-over-limit")).toBeNull();
    expect(el.getAttribute("aria-label")).toBeNull();
  });

  it("renders standard count badge when wipLimit prop is omitted", () => {
    render(<ColumnTaskCountBadge count={7} />);

    const el = screen.getByText("7");
    expect(el).toBeVisible();
    expect(screen.queryByText("7/3")).toBeNull();
    expect(el.className).toBe(
      "rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
    );
    expect(el.getAttribute("data-over-limit")).toBeNull();
    expect(el.getAttribute("aria-label")).toBeNull();
  });

  it("renders within wipLimit when count is under limit", () => {
    const { container } = render(
      <ColumnTaskCountBadge count={2} wipLimit={5} />,
    );

    expect(screen.getByText("2/5")).toBeVisible();
    const el = container.querySelector("[data-over-limit]");
    expect(el?.getAttribute("data-over-limit")).toBe("false");
    expect(el?.getAttribute("aria-label")).toContain(
      "tasks:kanban.wipLimit.withinLabel",
    );
    expect(el?.getAttribute("aria-label")).toContain(
      JSON.stringify({ current: 2, limit: 5 }),
    );
  });

  it("renders within wipLimit at exact cap boundary", () => {
    const { container } = render(
      <ColumnTaskCountBadge count={5} wipLimit={5} />,
    );

    expect(screen.getByText("5/5")).toBeVisible();
    const el = container.querySelector("[data-over-limit]");
    expect(el?.getAttribute("data-over-limit")).toBe("false");
    const ariaLabel = el?.getAttribute("aria-label");
    expect(ariaLabel).toContain("tasks:kanban.wipLimit.withinLabel");
    expect(ariaLabel).not.toContain("tasks:kanban.wipLimit.overLabel");
  });

  it("renders over wipLimit when count exceeds limit", () => {
    const { container } = render(
      <ColumnTaskCountBadge count={7} wipLimit={5} />,
    );

    expect(screen.getByText("7/5")).toBeVisible();
    const el = container.querySelector("[data-over-limit]");
    expect(el?.getAttribute("data-over-limit")).toBe("true");
    expect(el?.getAttribute("aria-label")).toContain(
      "tasks:kanban.wipLimit.overLabel",
    );
    expect(el?.getAttribute("aria-label")).toContain(
      JSON.stringify({ current: 7, limit: 5 }),
    );
    expect(el?.className).toContain("text-destructive");
  });

  it("satisfies WCAG non-color guard with svg and aria-label when over cap", () => {
    const { container: overCapContainer } = render(
      <ColumnTaskCountBadge count={7} wipLimit={5} />,
    );
    const overCapEl = overCapContainer.querySelector("[data-over-limit]");
    const svg = overCapContainer.querySelector('svg[aria-hidden="true"]');
    expect(svg).not.toBeNull();
    expect(overCapEl?.getAttribute("aria-label")).toBeTruthy();

    cleanup();

    const { container: underCapContainer } = render(
      <ColumnTaskCountBadge count={2} wipLimit={5} />,
    );
    expect(underCapContainer.querySelector("svg")).toBeNull();
  });
});

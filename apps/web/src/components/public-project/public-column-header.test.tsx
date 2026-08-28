import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import { PublicColumnHeader } from "./public-column-header";

afterEach(() => {
  cleanup();
});

describe("PublicColumnHeader", () => {
  const column = {
    id: "in-progress",
    name: "In Progress",
    isFinal: false,
    icon: null,
    tasks: [{}, {}],
  } as unknown as ProjectWithTasks["columns"][number];

  it("renders the column icon", () => {
    const { container } = render(<PublicColumnHeader column={column} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders the column name", () => {
    render(<PublicColumnHeader column={column} />);
    expect(screen.getByText("In Progress")).toBeTruthy();
  });

  it("renders the task count", () => {
    render(<PublicColumnHeader column={column} />);
    expect(screen.getByText("2")).toBeTruthy();
  });
});
